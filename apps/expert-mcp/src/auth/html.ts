// Minimal server-rendered pages for sign-in, consent and the device flow.
// Every interpolated value goes through `escape`, client metadata above all:
// DCR and CIMD clients choose their own names.

export function escape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

const STYLE = `
:root { color-scheme: light dark; --fg: #1f1b18; --bg: #f7f3ee; --muted: #5c534c; --accent: #a8462b; --line: #d9d0c7; }
@media (prefers-color-scheme: dark) { :root { --fg: #f3ede6; --bg: #1b1816; --muted: #b9aea4; --accent: #e8825f; --line: #3a332e; } }
* { box-sizing: border-box; }
body { margin: 0; font: 16px/1.5 system-ui, sans-serif; color: var(--fg); background: var(--bg); }
main { max-width: 32rem; margin: 3rem auto; padding: 0 1rem; }
h1 { font-size: 1.4rem; line-height: 1.3; }
p, li { color: var(--fg); }
.muted { color: var(--muted); font-size: 0.95rem; }
input[type=email], input[type=text] { width: 100%; padding: 0.6rem; font: inherit; color: var(--fg); background: transparent; border: 1px solid var(--line); border-radius: 6px; }
button { padding: 0.6rem 1.1rem; font: inherit; border-radius: 6px; border: 1px solid var(--accent); cursor: pointer; }
button.primary { background: var(--accent); color: var(--bg); }
button.secondary { background: transparent; color: var(--fg); border-color: var(--line); }
label { display: block; margin: 0.75rem 0; }
.warn { border-left: 3px solid var(--accent); padding-left: 0.75rem; }
a { color: var(--accent); }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
`;

export function page(
  title: string,
  body: string,
  init: { status?: number; headers?: Headers } = {},
): Response {
  const headers = init.headers ?? new Headers();
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  );
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title><style>${STYLE}</style></head>
<body><main>${body}</main></body></html>`;
  return new Response(html, { status: init.status ?? 200, headers });
}

export function errorPage(message: string, status = 400): Response {
  return page(
    "Something went wrong",
    `<h1>Something went wrong</h1><p>${escape(message)}</p>`,
    { status },
  );
}

export function emailForm(
  action: string,
  continuePath: string,
  intro: string,
): string {
  return `<h1>Sign in to Brandon Verzuu's expertise checks</h1>
<p>${escape(intro)}</p>
<form method="post" action="${escape(action)}">
  <input type="hidden" name="continue" value="${escape(continuePath)}">
  <label>Email address<input type="email" name="email" required autocomplete="email"></label>
  <p><button class="primary" type="submit">Email me a sign-in link</button></p>
</form>
<p class="muted">The link works once, for 15 minutes, in this browser.</p>`;
}

export function termsCheckbox(
  termsUrl: string,
  version: string,
  previouslyAccepted?: string,
): string {
  const changed = previouslyAccepted && previouslyAccepted !== version;
  return `${changed ? `<p class="warn">The terms changed since you last accepted them (version ${escape(previouslyAccepted)}).</p>` : ""}
<label><input type="checkbox" name="accept_terms" value="${escape(version)}" required>
I accept the <a href="${escape(termsUrl)}" target="_blank" rel="noopener">terms</a> (version ${escape(version)}).</label>`;
}
