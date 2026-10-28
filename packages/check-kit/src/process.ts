import { Validator } from "@cfworker/json-schema";
import type { Schema } from "@cfworker/json-schema";
import schemaJson from "../schemas/process-description.schema.json";
import { CheckKitError } from "./errors.ts";
import type { CheckKitIssue } from "./errors.ts";
import { formatPath, parsePointer } from "./jsonpath.ts";
import type { PathSegment } from "./jsonpath.ts";
import { LIMITS } from "./limits.ts";
import { parseSource } from "./yaml.ts";
import type { SourceFormat } from "./yaml.ts";

export const PROCESS_DESCRIPTION_SCHEMA_ID =
  "https://brandonverzuu.com/schemas/process-description/v1.json";
export const processDescriptionSchema = schemaJson as unknown as Schema;

// ---------------------------------------------------------------------------
// Document types, mirroring schemas/process-description.schema.json
// ---------------------------------------------------------------------------

type Extensions = { [key: `x-${string}`]: unknown };

export type TaskType =
  | "task"
  | "user"
  | "manual"
  | "service"
  | "script"
  | "send"
  | "receive"
  | "businessRule";
export type EventPosition =
  "start" | "end" | "intermediateCatch" | "intermediateThrow" | "boundary";
export type EventTrigger =
  | "none"
  | "message"
  | "timer"
  | "error"
  | "escalation"
  | "cancel"
  | "compensation"
  | "conditional"
  | "link"
  | "signal"
  | "terminate"
  | "multiple"
  | "parallelMultiple";
export type GatewayType =
  "exclusive" | "parallel" | "inclusive" | "eventBased" | "complex";

export interface Participant extends Extensions {
  id: string;
  name: string;
  description?: string;
  external?: boolean;
}
export interface Lane extends Extensions {
  id: string;
  name: string;
  description?: string;
  participant?: string;
}
export interface Task extends Extensions {
  id: string;
  name: string;
  description?: string;
  lane?: string;
  type?: TaskType;
  inputs?: string[];
  outputs?: string[];
  loop?:
    "none" | "standard" | "multiInstanceSequential" | "multiInstanceParallel";
  implementation?: string;
}
export interface ProcessEvent extends Extensions {
  id: string;
  name?: string;
  description?: string;
  lane?: string;
  position: EventPosition;
  trigger?: EventTrigger;
  attachedTo?: string;
  interrupting?: boolean;
  timer?: { duration?: string; date?: string; cycle?: string };
  condition?: string;
  code?: string;
}
export interface Gateway extends Extensions {
  id: string;
  name?: string;
  description?: string;
  lane?: string;
  type: GatewayType;
  direction?: "unspecified" | "diverging" | "converging" | "mixed";
  default?: string;
}
export interface SequenceFlow extends Extensions {
  id: string;
  name?: string;
  source: string;
  target: string;
  condition?: string;
}
export interface MessageFlow extends Extensions {
  id: string;
  name?: string;
  description?: string;
  source: string;
  target: string;
  payload?: string[];
  channel?: string;
}
export interface DataObject extends Extensions {
  id: string;
  name: string;
  description?: string;
  collection?: boolean;
  state?: string;
}
export interface ProcessDefinition extends Extensions {
  id: string;
  name: string;
  description?: string;
  version?: string;
  participants?: Participant[];
  lanes?: Lane[];
  tasks?: Task[];
  events?: ProcessEvent[];
  gateways?: Gateway[];
  flows?: SequenceFlow[];
  messages?: MessageFlow[];
  dataObjects?: DataObject[];
}
export interface Raci extends Extensions {
  task: string;
  responsible?: string[];
  accountable: string;
  consulted?: string[];
  informed?: string[];
}
export interface Control extends Extensions {
  id: string;
  name: string;
  description?: string;
  type?: "preventive" | "detective" | "corrective" | "directive";
  automation?: "manual" | "automated" | "itDependentManual";
  appliesTo?: string[];
  performedBy?: string;
  frequency?: string;
  evidence?: string[];
  references?: { catalog?: string; controlId: string }[];
}
export interface ProcessException extends Extensions {
  id: string;
  name: string;
  description?: string;
  raisedAt?: string[];
  handling?: string;
  handledBy?: string;
  escalateTo?: string;
}
export interface Sla extends Extensions {
  id: string;
  name: string;
  description?: string;
  from?: string;
  to?: string;
  target: string;
  calendar?: "business" | "calendar";
  attainment?: number;
  owner?: string;
}
export interface Kpi extends Extensions {
  id: string;
  name: string;
  description?: string;
  formula?: string;
  unit?: string;
  target?: number | string;
  direction?: "increase" | "decrease" | "maintain";
  frequency?: string;
  source?: string;
  owner?: string;
}
export interface SystemOfRecord extends Extensions {
  id: string;
  name: string;
  description?: string;
  records?: string[];
  owner?: string;
}
export interface Evidence extends Extensions {
  id: string;
  name: string;
  description?: string;
  producedBy?: string[];
  storedIn?: string;
  retention?: string;
}
export interface Governance extends Extensions {
  owner?: { name: string; role?: string; contact?: string };
  reviewCadence?: string;
  lastReviewed?: string;
  raci?: Raci[];
  controls?: Control[];
  exceptions?: ProcessException[];
  slas?: Sla[];
  kpis?: Kpi[];
  systemsOfRecord?: SystemOfRecord[];
  evidence?: Evidence[];
}
export interface ProcessDescription extends Extensions {
  $schema?: string;
  processDescription: "1.0";
  process: ProcessDefinition;
  governance?: Governance;
}

// ---------------------------------------------------------------------------
// In-memory model
// ---------------------------------------------------------------------------

export type ElementKind =
  | "process"
  | "participant"
  | "lane"
  | "task"
  | "event"
  | "gateway"
  | "flow"
  | "message"
  | "dataObject"
  | "control"
  | "exception"
  | "sla"
  | "kpi"
  | "systemOfRecord"
  | "evidence";

export interface ElementRef {
  id: string;
  kind: ElementKind;
  /** JSONPath of the element in the document. */
  path: string;
  data: Record<string, unknown>;
}

export type FlowNode =
  | { kind: "task"; id: string; data: Task }
  | { kind: "event"; id: string; data: ProcessEvent }
  | { kind: "gateway"; id: string; data: Gateway };

export interface ProcessModel {
  document: ProcessDescription;
  process: ProcessDefinition;
  participants: Participant[];
  lanes: Lane[];
  tasks: Task[];
  events: ProcessEvent[];
  gateways: Gateway[];
  flows: SequenceFlow[];
  messages: MessageFlow[];
  dataObjects: DataObject[];
  governance: Required<
    Pick<
      Governance,
      | "raci"
      | "controls"
      | "exceptions"
      | "slas"
      | "kpis"
      | "systemsOfRecord"
      | "evidence"
    >
  > &
    Pick<Governance, "owner" | "reviewCadence" | "lastReviewed">;
  /** Every element with an id, by id. */
  elements: Map<string, ElementRef>;
  /** Tasks, events and gateways by id. */
  nodes: Map<string, FlowNode>;
  outgoing: Map<string, SequenceFlow[]>;
  incoming: Map<string, SequenceFlow[]>;
  /** Boundary events by the task they're attached to. */
  boundaryEvents: Map<string, ProcessEvent[]>;
  /** Lane id → ids of the nodes in it. */
  laneMembers: Map<string, string[]>;
  /** RACI entry by task id. */
  raciByTask: Map<string, Raci>;
  /** The participant a node belongs to, through its lane. */
  participantOf(nodeId: string): string | undefined;
}

export interface ParsedProcess {
  format: SourceFormat;
  document: ProcessDescription;
  model: ProcessModel;
  lineOf(path: readonly PathSegment[]): number | undefined;
}

export interface ParseProcessOptions {
  format?: SourceFormat;
  maxBytes?: number;
}

let validator: Validator | undefined;

/** Validate data against the Process Description JSON Schema (structure only). */
export function validateProcessSchema(data: unknown): CheckKitIssue[] {
  validator ??= new Validator(processDescriptionSchema, "2020-12", false);
  const result = validator.validate(data);
  if (result.valid) return [];
  const structural = new Set([
    "$ref",
    "allOf",
    "anyOf",
    "oneOf",
    "properties",
    "items",
    "if",
    "then",
    "else",
    "patternProperties",
  ]);
  const issues: CheckKitIssue[] = [];
  const seen = new Set<string>();
  for (const error of result.errors) {
    if (structural.has(error.keyword)) continue;
    const at = pointerToPath(error.instanceLocation);
    const key = `${at}|${error.error}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push({ at, message: error.error });
  }
  return issues.length > 0
    ? issues
    : [{ at: "$", message: "Document does not match the schema" }];
}

function pointerToPath(location: string): string {
  try {
    return formatPath(
      parsePointer(location).map((s) => (/^\d+$/.test(s) ? Number(s) : s)),
    );
  } catch {
    return location;
  }
}

/**
 * Parse and validate a Process Description (YAML or JSON) into an in-memory model.
 * Validation covers the schema and referential integrity (unique ids, references
 * that point at the right kind of element). Whether the process is any good is
 * not this function's business.
 */
export function parseProcessDescription(
  text: string,
  options: ParseProcessOptions = {},
): ParsedProcess {
  const parsed = parseSource(text, {
    maxBytes: options.maxBytes ?? LIMITS.process.maxBytes,
    format: options.format,
    label: "Process description",
  });
  const schemaIssues = validateProcessSchema(parsed.value);
  if (schemaIssues.length > 0) {
    throw new CheckKitError(
      "schema_invalid",
      "Process description does not match the Process Description schema",
      schemaIssues.slice(0, 50),
    );
  }
  const document = parsed.value as ProcessDescription;
  const { model, issues } = buildModel(document);
  if (issues.length > 0) {
    throw new CheckKitError(
      "invalid_document",
      "Process description has broken references",
      issues.slice(0, 50),
    );
  }
  return { format: parsed.format, document, model, lineOf: parsed.lineOf };
}

const ROLE: ElementKind[] = ["lane", "participant"];
const FLOW_NODE: ElementKind[] = ["task", "event", "gateway"];
const PROCESS_ELEMENT: ElementKind[] = [
  "process",
  "participant",
  "lane",
  "task",
  "event",
  "gateway",
  "flow",
  "message",
  "dataObject",
];

/** Build the model and report referential problems. Exported for tests and tools. */
export function buildModel(document: ProcessDescription): {
  model: ProcessModel;
  issues: CheckKitIssue[];
} {
  const p = document.process;
  const g = document.governance ?? {};
  const issues: CheckKitIssue[] = [];
  const elements = new Map<string, ElementRef>();

  const register = (
    kind: ElementKind,
    data: { id: string },
    path: PathSegment[],
  ) => {
    const at = formatPath(path);
    const existing = elements.get(data.id);
    if (existing) {
      issues.push({
        at,
        message: `Duplicate id "${data.id}" (also used at ${existing.path})`,
      });
      return;
    }
    elements.set(data.id, {
      id: data.id,
      kind,
      path: at,
      data: data as Record<string, unknown>,
    });
  };

  register("process", p, ["process"]);
  const processLists = [
    ["participants", "participant"],
    ["lanes", "lane"],
    ["tasks", "task"],
    ["events", "event"],
    ["gateways", "gateway"],
    ["flows", "flow"],
    ["messages", "message"],
    ["dataObjects", "dataObject"],
  ] as const;
  for (const [key, kind] of processLists) {
    (p[key] ?? []).forEach((item, i) =>
      register(kind, item, ["process", key, i]),
    );
  }
  const governanceLists = [
    ["controls", "control"],
    ["exceptions", "exception"],
    ["slas", "sla"],
    ["kpis", "kpi"],
    ["systemsOfRecord", "systemOfRecord"],
    ["evidence", "evidence"],
  ] as const;
  for (const [key, kind] of governanceLists) {
    (g[key] ?? []).forEach((item, i) =>
      register(kind, item, ["governance", key, i]),
    );
  }

  const ref = (
    id: string | undefined,
    kinds: ElementKind[],
    path: PathSegment[],
  ): void => {
    if (id === undefined) return;
    const el = elements.get(id);
    if (!el)
      issues.push({
        at: formatPath(path),
        message: `"${id}" is not an element in this document`,
      });
    else if (!kinds.includes(el.kind)) {
      issues.push({
        at: formatPath(path),
        message: `"${id}" is a ${el.kind}; expected ${kinds.join(" or ")}`,
      });
    }
  };
  const refs = (
    ids: string[] | undefined,
    kinds: ElementKind[],
    path: PathSegment[],
  ) => ids?.forEach((id, i) => ref(id, kinds, [...path, i]));

  p.lanes?.forEach((l, i) =>
    ref(l.participant, ["participant"], ["process", "lanes", i, "participant"]),
  );
  p.tasks?.forEach((t, i) => {
    ref(t.lane, ["lane"], ["process", "tasks", i, "lane"]);
    refs(t.inputs, ["dataObject"], ["process", "tasks", i, "inputs"]);
    refs(t.outputs, ["dataObject"], ["process", "tasks", i, "outputs"]);
  });
  p.events?.forEach((e, i) => {
    ref(e.lane, ["lane"], ["process", "events", i, "lane"]);
    ref(e.attachedTo, ["task"], ["process", "events", i, "attachedTo"]);
  });
  p.gateways?.forEach((gw, i) => {
    ref(gw.lane, ["lane"], ["process", "gateways", i, "lane"]);
    if (gw.default !== undefined) {
      const flow = p.flows?.find((f) => f.id === gw.default);
      if (!flow) {
        issues.push({
          at: formatPath(["process", "gateways", i, "default"]),
          message: `"${gw.default}" is not a sequence flow`,
        });
      } else if (flow.source !== gw.id) {
        issues.push({
          at: formatPath(["process", "gateways", i, "default"]),
          message: `Default flow "${gw.default}" doesn't leave this gateway`,
        });
      }
    }
  });
  p.flows?.forEach((f, i) => {
    ref(f.source, FLOW_NODE, ["process", "flows", i, "source"]);
    ref(f.target, FLOW_NODE, ["process", "flows", i, "target"]);
  });
  p.messages?.forEach((m, i) => {
    ref(
      m.source,
      ["task", "event", "participant"],
      ["process", "messages", i, "source"],
    );
    ref(
      m.target,
      ["task", "event", "participant"],
      ["process", "messages", i, "target"],
    );
    refs(m.payload, ["dataObject"], ["process", "messages", i, "payload"]);
  });

  const raciByTask = new Map<string, Raci>();
  g.raci?.forEach((r, i) => {
    const base = ["governance", "raci", i];
    ref(r.task, ["task"], [...base, "task"]);
    if (raciByTask.has(r.task)) {
      issues.push({
        at: formatPath(base),
        message: `Task "${r.task}" has more than one RACI entry`,
      });
    } else raciByTask.set(r.task, r);
    ref(r.accountable, ROLE, [...base, "accountable"]);
    refs(r.responsible, ROLE, [...base, "responsible"]);
    refs(r.consulted, ROLE, [...base, "consulted"]);
    refs(r.informed, ROLE, [...base, "informed"]);
  });
  g.controls?.forEach((c, i) => {
    const base = ["governance", "controls", i];
    refs(c.appliesTo, PROCESS_ELEMENT, [...base, "appliesTo"]);
    ref(c.performedBy, ROLE, [...base, "performedBy"]);
    refs(c.evidence, ["evidence"], [...base, "evidence"]);
  });
  g.exceptions?.forEach((x, i) => {
    const base = ["governance", "exceptions", i];
    refs(x.raisedAt, PROCESS_ELEMENT, [...base, "raisedAt"]);
    ref(x.handledBy, [...FLOW_NODE, "flow"], [...base, "handledBy"]);
    ref(x.escalateTo, ROLE, [...base, "escalateTo"]);
  });
  g.slas?.forEach((s, i) => {
    const base = ["governance", "slas", i];
    ref(s.from, FLOW_NODE, [...base, "from"]);
    ref(s.to, FLOW_NODE, [...base, "to"]);
    ref(s.owner, ROLE, [...base, "owner"]);
  });
  g.kpis?.forEach((k, i) => {
    const base = ["governance", "kpis", i];
    ref(k.source, ["systemOfRecord"], [...base, "source"]);
    ref(k.owner, ROLE, [...base, "owner"]);
  });
  g.systemsOfRecord?.forEach((s, i) => {
    const base = ["governance", "systemsOfRecord", i];
    refs(s.records, ["dataObject"], [...base, "records"]);
    ref(s.owner, ROLE, [...base, "owner"]);
  });
  g.evidence?.forEach((e, i) => {
    const base = ["governance", "evidence", i];
    refs(
      e.producedBy,
      [...PROCESS_ELEMENT, "control"],
      [...base, "producedBy"],
    );
    ref(e.storedIn, ["systemOfRecord"], [...base, "storedIn"]);
  });

  const nodes = new Map<string, FlowNode>();
  for (const t of p.tasks ?? [])
    nodes.set(t.id, { kind: "task", id: t.id, data: t });
  for (const e of p.events ?? [])
    nodes.set(e.id, { kind: "event", id: e.id, data: e });
  for (const gw of p.gateways ?? [])
    nodes.set(gw.id, { kind: "gateway", id: gw.id, data: gw });

  const outgoing = new Map<string, SequenceFlow[]>();
  const incoming = new Map<string, SequenceFlow[]>();
  for (const id of nodes.keys()) {
    outgoing.set(id, []);
    incoming.set(id, []);
  }
  for (const f of p.flows ?? []) {
    outgoing.get(f.source)?.push(f);
    incoming.get(f.target)?.push(f);
  }
  const boundaryEvents = new Map<string, ProcessEvent[]>();
  for (const e of p.events ?? []) {
    if (e.position === "boundary" && e.attachedTo) {
      boundaryEvents.set(e.attachedTo, [
        ...(boundaryEvents.get(e.attachedTo) ?? []),
        e,
      ]);
    }
  }
  const laneMembers = new Map<string, string[]>();
  for (const l of p.lanes ?? []) laneMembers.set(l.id, []);
  for (const node of nodes.values()) {
    const lane = node.data.lane;
    if (lane) laneMembers.get(lane)?.push(node.id);
  }
  const laneParticipant = new Map(
    (p.lanes ?? []).map((l) => [l.id, l.participant]),
  );

  const model: ProcessModel = {
    document,
    process: p,
    participants: p.participants ?? [],
    lanes: p.lanes ?? [],
    tasks: p.tasks ?? [],
    events: p.events ?? [],
    gateways: p.gateways ?? [],
    flows: p.flows ?? [],
    messages: p.messages ?? [],
    dataObjects: p.dataObjects ?? [],
    governance: {
      owner: g.owner,
      reviewCadence: g.reviewCadence,
      lastReviewed: g.lastReviewed,
      raci: g.raci ?? [],
      controls: g.controls ?? [],
      exceptions: g.exceptions ?? [],
      slas: g.slas ?? [],
      kpis: g.kpis ?? [],
      systemsOfRecord: g.systemsOfRecord ?? [],
      evidence: g.evidence ?? [],
    },
    elements,
    nodes,
    outgoing,
    incoming,
    boundaryEvents,
    laneMembers,
    raciByTask,
    participantOf(nodeId) {
      const node = nodes.get(nodeId);
      let lane = node?.data.lane;
      if (!lane && node?.kind === "event" && node.data.attachedTo) {
        lane = nodes.get(node.data.attachedTo)?.data.lane;
      }
      return lane ? laneParticipant.get(lane) : undefined;
    },
  };
  return { model, issues };
}
