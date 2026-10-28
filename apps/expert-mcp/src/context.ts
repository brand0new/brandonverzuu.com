import { getAccount } from "./accounts";
import { GatewayError } from "./errors";
import { getServices } from "./services";
import type { AuthProps, ToolContext } from "./types";

/** Builds the context for one authenticated call. The account is re-read each time. */
export async function createToolContext(
  env: Env,
  props: AuthProps | undefined,
  requestId: string,
  waitUntil: (promise: Promise<unknown>) => void,
): Promise<ToolContext> {
  if (!props?.accountId) throw new GatewayError("forbidden", "Not signed in.");
  const account = await getAccount(env, props.accountId);
  if (!account)
    throw new GatewayError("forbidden", "This account no longer exists.");
  const services = getServices(env);
  return {
    account,
    requestId,
    ledger: services.ledger,
    guard: services.guard,
    rules: services.rules,
    usage: services.usage,
    purchases: services.purchases,
    flags: services.flags,
    env,
    waitUntil,
  };
}
