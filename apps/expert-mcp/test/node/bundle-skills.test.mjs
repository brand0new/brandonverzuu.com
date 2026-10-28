// Runs in Node (node --test), because the bundler reads the filesystem.
// The fixture is the example from the Skills extension spec, so the digests and
// sizes below are the spec's own.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { bundleSkills, renderModule } from "../../scripts/bundle-skills.mjs";

const fixtures = join(
  dirname(fileURLToPath(import.meta.url)),
  "../fixtures/skills",
);

test("matches the extension spec's example manifest", () => {
  const skills = bundleSkills(fixtures);
  assert.equal(skills.length, 1);
  const [skill] = skills;
  assert.equal(skill.path, "pdf-processing");
  assert.deepEqual(skill.frontmatter, {
    name: "pdf-processing",
    description: "Extract, fill, and assemble PDF documents",
  });
  assert.deepEqual(
    skill.files.map(({ path, digest, size }) => ({ path, digest, size })),
    [
      {
        path: "SKILL.md",
        digest:
          "sha256:99b737495721155ece826d57521e2d66141ebdc1344a400487481ea2642ab19e",
        size: 151,
      },
      {
        path: "templates/invoice.md",
        digest:
          "sha256:61f4ea6d2c75fde1b4977219e7e3107d491c3c26aefb6686e84d6281c088d9ee",
        size: 29,
      },
      {
        path: "templates/purchase-order.md",
        digest:
          "sha256:f2ff774b1737ff3dec81c47946f9976f18a1a9f69dda0a81f22eabd95173c158",
        size: 35,
      },
    ],
  );
  assert.match(
    renderModule(skills),
    /export const SKILLS: BundledSkill\[\] = /,
  );
});

function tempSkills(files) {
  const root = mkdtempSync(join(tmpdir(), "skills-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

test("serves nested skill paths and passes frontmatter through verbatim", () => {
  const root = tempSkills({
    "README.md": "not a skill",
    "acme/billing/refunds/SKILL.md":
      "---\nname: refunds\ndescription: Refunds\nlicense: Apache-2.0\nmetadata:\n  team: billing\n---\nBody\n",
  });
  const [skill] = bundleSkills(root);
  assert.equal(skill.path, "acme/billing/refunds");
  assert.deepEqual(skill.frontmatter, {
    name: "refunds",
    description: "Refunds",
    license: "Apache-2.0",
    metadata: { team: "billing" },
  });
});

test("fails the build on a name that doesn't match its folder", () => {
  const root = tempSkills({
    "one/SKILL.md": "---\nname: two\ndescription: d\n---\n",
  });
  assert.throws(() => bundleSkills(root), /must equal the folder name/);
});

test("fails the build without frontmatter", () => {
  const root = tempSkills({ "one/SKILL.md": "# no frontmatter\n" });
  assert.throws(() => bundleSkills(root), /must start with YAML frontmatter/);
});

test("finds no skills in today's products/skills (README only)", () => {
  const products = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../products/skills",
  );
  assert.ok(Array.isArray(bundleSkills(products)));
});
