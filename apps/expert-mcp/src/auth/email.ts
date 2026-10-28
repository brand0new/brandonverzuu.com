// Pluggable email sending for magic links. Development prints the message to
// the console; staging and production fail closed until a provider is chosen
// (see the PR for the proposal) and implemented as another EmailSender.

import { isDevelopment } from "../config";
import { GatewayError } from "../errors";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/** Development only: prints the message, including the sign-in link, to the console. */
export class ConsoleEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<void> {
    console.log(`[dev email] ${message.subject}\n${message.text}`);
  }
}

/** Tests: keeps messages in memory. */
export class MemoryEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

let override: EmailSender | undefined;

export function setEmailSender(sender: EmailSender | undefined): void {
  override = sender;
}

export function getEmailSender(env: Env): EmailSender {
  if (override) return override;
  if (isDevelopment(env)) return new ConsoleEmailSender();
  // TODO: the production sender, once Brandon picks the provider.
  throw new GatewayError(
    "not_configured",
    "Email sign-in isn't available yet.",
  );
}
