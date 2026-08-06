/** Shared Playwright helpers for OpenClaw Control UI password auth (ADR-0011). */

export function controlUiPath(path = '/'): string {
  const password = process.env.OPENCLAW_GATEWAY_PASSWORD;
  if (!password) {
    throw new Error(
      'OPENCLAW_GATEWAY_PASSWORD is required (set in secrets/secrets.env or the environment)',
    );
  }
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}password=${encodeURIComponent(password)}`;
}
