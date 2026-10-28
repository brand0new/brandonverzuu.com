import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import {
  CheckKitError,
  parseProcessDescription,
  processDescriptionSchema,
  PROCESS_DESCRIPTION_SCHEMA_ID,
} from "../src/index.ts";

const examplesDir = fileURLToPath(new URL("../examples/", import.meta.url));
const examples = readdirSync(examplesDir).filter((f) =>
  f.endsWith(".process.yaml"),
);
const read = (name: string) => readFileSync(examplesDir + name, "utf8");

function rejects(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(CheckKitError);
    expect((error as CheckKitError).code).toBe(code);
    return error as CheckKitError;
  }
  throw new Error(`expected a ${code} rejection`);
}

/** Parse an example, apply a mutation to its data, and re-serialise. */
function mutate(name: string, change: (doc: any) => void): string {
  const doc = parse(read(name));
  change(doc);
  return stringify(doc);
}

describe("Process Description schema", () => {
  it("is a 2020-12 schema with the published $id, marked as a draft", () => {
    const schema = processDescriptionSchema as Record<string, unknown>;
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.$id).toBe(PROCESS_DESCRIPTION_SCHEMA_ID);
    expect(String(schema.description)).toMatch(/^DRAFT/);
  });

  it("has examples to test", () => {
    expect(examples.length).toBeGreaterThanOrEqual(2);
  });
});

describe.each(examples)("example %s", (name) => {
  it("validates and builds a model", () => {
    const { model, document, format } = parseProcessDescription(read(name));
    expect(format).toBe("yaml");
    expect(document.processDescription).toBe("1.0");
    expect(model.tasks.length).toBeGreaterThan(0);
    expect(model.elements.get(model.process.id)?.kind).toBe("process");

    for (const f of model.flows) {
      expect(model.nodes.has(f.source)).toBe(true);
      expect(model.outgoing.get(f.source)).toContain(f);
      expect(model.incoming.get(f.target)).toContain(f);
    }
    for (const r of model.governance.raci) {
      expect(model.raciByTask.get(r.task)).toBe(r);
      expect(typeof r.accountable).toBe("string");
    }
    const firstTask = model.tasks[0]!;
    expect(model.participantOf(firstTask.id)).toBeDefined();
    expect(model.elements.get(firstTask.id)?.path).toBe("$.process.tasks[0]");
  });

  it("round-trips through JSON", () => {
    const json = JSON.stringify(parse(read(name)));
    expect(parseProcessDescription(json).format).toBe("json");
  });
});

describe("Process Description validation", () => {
  const name = "invoice-approval.process.yaml";

  it("maps boundary events to their task and lanes to members", () => {
    const { model } = parseProcessDescription(read(name));
    expect(
      model.boundaryEvents.get("Task_ApproveInvoice")?.map((e) => e.id),
    ).toEqual(["Event_ApprovalOverdue"]);
    expect(model.laneMembers.get("Lane_BudgetHolder")).toContain(
      "Task_ApproveInvoice",
    );
    expect(model.participantOf("Event_ApprovalOverdue")).toBe(
      "Participant_Acme",
    );
  });

  it("allows exactly one accountable role per task", () => {
    const err = rejects(
      () =>
        parseProcessDescription(
          mutate(name, (d) => {
            d.governance.raci[0].accountable = [
              "Lane_APClerk",
              "Lane_Controller",
            ];
          }),
        ),
      "schema_invalid",
    );
    expect(
      err.issues.some((i) =>
        i.at?.startsWith("$.governance.raci[0].accountable"),
      ),
    ).toBe(true);
    rejects(
      () =>
        parseProcessDescription(
          mutate(name, (d) => delete d.governance.raci[0].accountable),
        ),
      "schema_invalid",
    );
  });

  it("rejects unknown properties but accepts x- extensions", () => {
    rejects(
      () =>
        parseProcessDescription(
          mutate(name, (d) => (d.process.tasks[0].owner = "x")),
        ),
      "schema_invalid",
    );
    expect(() =>
      parseProcessDescription(
        mutate(name, (d) => (d.process.tasks[0]["x-ticket"] = "FIN-1")),
      ),
    ).not.toThrow();
  });

  it("rejects non-BPMN ids, task types and event triggers", () => {
    rejects(
      () =>
        parseProcessDescription(
          mutate(name, (d) => (d.process.tasks[0].id = "1-task")),
        ),
      "schema_invalid",
    );
    rejects(
      () =>
        parseProcessDescription(
          mutate(name, (d) => (d.process.tasks[0].type = "robot")),
        ),
      "schema_invalid",
    );
    rejects(
      () =>
        parseProcessDescription(
          mutate(name, (d) => (d.process.events[0].trigger = "email")),
        ),
      "schema_invalid",
    );
  });

  it("requires attachedTo on boundary events only", () => {
    rejects(
      () =>
        parseProcessDescription(
          mutate(name, (d) => delete d.process.events[1].attachedTo),
        ),
      "schema_invalid",
    );
    rejects(
      () =>
        parseProcessDescription(
          mutate(
            name,
            (d) => (d.process.events[0].attachedTo = "Task_RegisterInvoice"),
          ),
        ),
      "schema_invalid",
    );
  });

  it("rejects broken and mistyped references", () => {
    const err = rejects(
      () =>
        parseProcessDescription(
          mutate(name, (d) => (d.process.flows[0].target = "Task_Nope")),
        ),
      "invalid_document",
    );
    expect(err.issues[0]!.at).toBe("$.process.flows[0].target");
    rejects(
      () =>
        parseProcessDescription(
          mutate(
            name,
            (d) => (d.governance.raci[0].accountable = "Data_Invoice"),
          ),
        ),
      "invalid_document",
    );
    rejects(
      () =>
        parseProcessDescription(
          mutate(name, (d) => (d.process.gateways[0].default = "Flow_1")),
        ),
      "invalid_document",
    );
  });

  it("rejects duplicate ids across the document", () => {
    const err = rejects(
      () =>
        parseProcessDescription(
          mutate(
            name,
            (d) => (d.governance.controls[0].id = "Task_RegisterInvoice"),
          ),
        ),
      "invalid_document",
    );
    expect(err.issues[0]!.message).toContain("Duplicate id");
  });

  it("needs the format version and a process", () => {
    rejects(
      () =>
        parseProcessDescription(
          mutate(name, (d) => delete d.processDescription),
        ),
      "schema_invalid",
    );
    rejects(
      () => parseProcessDescription('processDescription: "1.0"\n'),
      "schema_invalid",
    );
  });

  it("enforces the size limit", () => {
    rejects(
      () => parseProcessDescription("#".repeat(1024 * 1024 + 1)),
      "too_large",
    );
  });
});
