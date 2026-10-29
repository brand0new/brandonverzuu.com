interface TestBindings {
  TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
}

interface Env extends TestBindings {}

declare namespace Cloudflare {
  interface Env extends TestBindings {}
}
