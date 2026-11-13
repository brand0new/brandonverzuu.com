// What does the work in a /setups step: a person, an event, a written procedure, code, or a
// model. Shared by the `setup` schema (src/content.config.ts), which only accepts these keys,
// and by SetupLoop and the page key, which draw them. Order here is the order they're drawn in.
export const KINDS = {
  manual: { label: "Manual", icon: "mage:user" },       // a person does it
  hook: { label: "Hook", icon: "mage:zap" },            // fires on an event: CI, a webhook, an agent hook
  skill: { label: "Skill", icon: "mage:book-text" },    // a written procedure in skills/
  script: { label: "Script", icon: "mage:play-circle" }, // code that runs the same way every time
  agent: { label: "Agent", icon: "mage:robot" },        // a model does the work
} as const;

export type Kind = keyof typeof KINDS;
export const KIND_KEYS = Object.keys(KINDS) as [Kind, ...Kind[]];

// Steps list their kinds in any order; draw them in the canonical one.
export const sortKinds = (ks: readonly Kind[]) => KIND_KEYS.filter((k) => ks.includes(k));
