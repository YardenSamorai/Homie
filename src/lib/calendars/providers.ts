import "server-only";
import { fromGoogle, fromGraph, type Change, type Provider } from "./normalize";

/**
 * Read-only access to Google Calendar and Microsoft 365 calendars. Nothing here creates, changes or deletes an
 * event at the source. Endpoints, scopes and sync rules follow the providers' own documentation:
 *   Google:    OAuth 2.0 for web server apps; Calendar API v3 calendarList.list, events.list with syncToken.
 *   Microsoft: identity platform auth code flow with PKCE; Graph v1.0 /me/calendars, calendarView/delta.
 */

export type Tokens = { access: string; refresh: string; expiresAt: number; scope: string };
export type RemoteCalendar = { remoteId: string; name: string; color: string | null; isPrimary: boolean };
export type Batch = { changes: Change[]; cursor: string; full: boolean };

export type ProviderFailure = "reauth" | "scope" | "gone" | "rate" | "unavailable" | "bad";

export class ProviderError extends Error {
  constructor(
    public readonly failure: ProviderFailure,
    public readonly retryAfter?: number,
  ) {
    super(failure);
  }
}

const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
];

/** The narrowest read scopes each provider offers for listing calendars and reading their events. */
export const SCOPES: Record<Provider, string[]> = {
  google: ["openid", "email", ...GOOGLE_CALENDAR_SCOPES],
  microsoft: ["openid", "email", "offline_access", "User.Read", "Calendars.Read"],
};

const env = (name: string) => process.env[name]?.trim() || null;

export function providerConfig(provider: Provider) {
  const prefix = provider === "google" ? "GOOGLE_CALENDAR" : "MICROSOFT_CALENDAR";
  const clientId = env(`${prefix}_CLIENT_ID`);
  const clientSecret = env(`${prefix}_CLIENT_SECRET`);
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

const tenant = () => env("MICROSOFT_CALENDAR_TENANT") ?? "common";
const MICROSOFT_LOGIN = () => `https://login.microsoftonline.com/${encodeURIComponent(tenant())}/oauth2/v2.0`;
const GRAPH = "https://graph.microsoft.com/v1.0";
const GOOGLE_CALENDAR = "https://www.googleapis.com/calendar/v3";

/** Granted scopes come back in the token response; Google lets people untick boxes on the consent screen. */
export function grantedEnough(provider: Provider, granted: string) {
  const have = new Set(granted.toLowerCase().split(/\s+/));
  const need = provider === "google" ? GOOGLE_CALENDAR_SCOPES : ["calendars.read"];
  return need.every((scope) =>
    provider === "google" ? have.has(scope.toLowerCase()) : [...have].some((g) => g === scope || g.endsWith(`/${scope}`)),
  );
}

export function authorizeUrl(provider: Provider, options: { redirectUri: string; state: string; challenge: string }) {
  const config = providerConfig(provider);
  if (!config) throw new ProviderError("unavailable");
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: options.redirectUri,
    response_type: "code",
    scope: SCOPES[provider].join(" "),
    state: options.state,
    code_challenge: options.challenge,
    code_challenge_method: "S256",
  });
  if (provider === "google") {
    params.set("access_type", "offline");
    // A refresh token is only issued with consent; asking every time keeps a reconnect from coming back without one.
    params.set("prompt", "consent");
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }
  params.set("response_mode", "query");
  params.set("prompt", "select_account");
  return `${MICROSOFT_LOGIN()}/authorize?${params}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One request, with the providers' own back-off rules: Retry-After on 429/503, one retry on other 5xx. */
async function send(url: string, init: RequestInit, attempt = 0): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  } catch {
    if (attempt < 1) return sleep(800).then(() => send(url, init, attempt + 1));
    throw new ProviderError("unavailable");
  }
  if (response.status === 429 || response.status === 503) {
    const wait = Number(response.headers.get("retry-after")) || 2 ** attempt;
    if (attempt < 2 && wait <= 5) return sleep(wait * 1000).then(() => send(url, init, attempt + 1));
    throw new ProviderError("rate", wait);
  }
  if (response.status >= 500 && attempt < 1) return sleep(800).then(() => send(url, init, attempt + 1));
  return response;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** A provider API call with an access token. Failures become a ProviderError, never a raw body in a log. */
async function api(url: string, access: string, headers: Record<string, string> = {}) {
  const response = await send(url, { headers: { authorization: `Bearer ${access}`, accept: "application/json", ...headers } });
  const body = await readJson(response);
  if (response.ok) return body;
  if (response.status === 401) throw new ProviderError("reauth");
  if (response.status === 410) throw new ProviderError("gone");
  const text = JSON.stringify(body.error ?? "");
  if (/syncStateNotFound|resyncRequired|fullSyncRequired/i.test(text)) throw new ProviderError("gone");
  if (response.status === 403) {
    if (/rateLimitExceeded|userRateLimitExceeded|quotaExceeded/i.test(text)) throw new ProviderError("rate", 60);
    throw new ProviderError("scope");
  }
  throw new ProviderError(response.status >= 500 ? "unavailable" : "bad");
}

async function tokenCall(provider: Provider, form: Record<string, string>): Promise<Record<string, unknown>> {
  const config = providerConfig(provider);
  if (!config) throw new ProviderError("unavailable");
  const url = provider === "google" ? "https://oauth2.googleapis.com/token" : `${MICROSOFT_LOGIN()}/token`;
  const response = await send(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...form }),
  });
  const body = await readJson(response);
  if (response.ok && typeof body.access_token === "string") return body;
  if (body.error === "invalid_grant" || body.error === "interaction_required" || body.error === "consent_required") {
    throw new ProviderError("reauth");
  }
  throw new ProviderError(response.status >= 500 ? "unavailable" : "bad");
}

const toTokens = (body: Record<string, unknown>, previous?: Tokens): Tokens => ({
  access: String(body.access_token),
  // Microsoft hands out a new refresh token each time and the old one should be dropped; Google usually doesn't.
  refresh: typeof body.refresh_token === "string" ? body.refresh_token : (previous?.refresh ?? ""),
  expiresAt: Date.now() + (Number(body.expires_in) || 3600) * 1000,
  scope: typeof body.scope === "string" ? body.scope : (previous?.scope ?? ""),
});

export async function exchangeCode(provider: Provider, code: string, verifier: string, redirectUri: string) {
  const form: Record<string, string> = { grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirectUri };
  if (provider === "microsoft") form.scope = SCOPES.microsoft.join(" ");
  const tokens = toTokens(await tokenCall(provider, form));
  if (!tokens.refresh) throw new ProviderError("reauth");
  return tokens;
}

export async function refreshTokens(provider: Provider, tokens: Tokens) {
  const form: Record<string, string> = { grant_type: "refresh_token", refresh_token: tokens.refresh };
  if (provider === "microsoft") form.scope = SCOPES.microsoft.join(" ");
  return toTokens(await tokenCall(provider, form), tokens);
}

/** Google's revocation endpoint. Microsoft has none for these tokens; access ends when the app is removed there. */
export async function revokeTokens(provider: Provider, tokens: Tokens) {
  if (provider !== "google") return;
  await send("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: tokens.refresh || tokens.access }),
  }).catch(() => undefined);
}

/** The account's stable id and the address the provider itself verified. */
export async function whoIs(provider: Provider, access: string): Promise<{ subject: string; email: string }> {
  if (provider === "google") {
    const body = await api("https://openidconnect.googleapis.com/v1/userinfo", access);
    if (typeof body.sub !== "string" || typeof body.email !== "string" || body.email_verified !== true) {
      throw new ProviderError("scope");
    }
    return { subject: body.sub, email: body.email.toLowerCase() };
  }
  const body = await api(`${GRAPH}/me?$select=id,mail,userPrincipalName`, access);
  const email = typeof body.mail === "string" && body.mail ? body.mail : body.userPrincipalName;
  if (typeof body.id !== "string" || typeof email !== "string") throw new ProviderError("scope");
  return { subject: body.id, email: email.toLowerCase() };
}

const MAX_PAGES = 60;

export async function listCalendars(provider: Provider, access: string): Promise<RemoteCalendar[]> {
  const calendars: RemoteCalendar[] = [];
  if (provider === "google") {
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({ minAccessRole: "reader", maxResults: "250" });
      if (pageToken) params.set("pageToken", pageToken);
      const body = await api(`${GOOGLE_CALENDAR}/users/me/calendarList?${params}`, access);
      for (const raw of (body.items as Record<string, unknown>[] | undefined) ?? []) {
        if (typeof raw.id !== "string") continue;
        calendars.push({
          remoteId: raw.id,
          name: String(raw.summaryOverride ?? raw.summary ?? raw.id).slice(0, 120),
          color: typeof raw.backgroundColor === "string" ? raw.backgroundColor : null,
          isPrimary: raw.primary === true,
        });
      }
      pageToken = typeof body.nextPageToken === "string" ? body.nextPageToken : undefined;
      if (!pageToken) return calendars;
    }
    throw new ProviderError("bad");
  }
  let next: string | undefined = `${GRAPH}/me/calendars?$select=id,name,hexColor,isDefaultCalendar&$top=100`;
  for (let page = 0; page < MAX_PAGES && next; page++) {
    const body = await api(next, access, { Prefer: 'IdType="ImmutableId"' });
    for (const raw of (body.value as Record<string, unknown>[] | undefined) ?? []) {
      if (typeof raw.id !== "string") continue;
      calendars.push({
        remoteId: raw.id,
        name: String(raw.name ?? "").slice(0, 120) || "Calendar",
        color: typeof raw.hexColor === "string" && raw.hexColor ? raw.hexColor : null,
        isPrimary: raw.isDefaultCalendar === true,
      });
    }
    next = typeof body["@odata.nextLink"] === "string" ? graphLink(body["@odata.nextLink"]) : undefined;
  }
  if (next) throw new ProviderError("bad");
  return calendars;
}

/** Paging and delta links must point back at Graph; anything else in a stored cursor is refused. */
function graphLink(link: string) {
  if (!link.startsWith(`${GRAPH}/`)) throw new ProviderError("bad");
  return link;
}

/**
 * Every change since `cursor`, or everything inside `window` when starting over. All pages are read before
 * anything is returned: a missing page is an error, never a shorter list (a shorter list would read as deletions).
 */
export async function readChanges(
  provider: Provider,
  access: string,
  calendarId: string,
  from: { cursor: string } | { window: { start: Date; end: Date } },
): Promise<Batch> {
  const full = "window" in from;
  const changes: Change[] = [];

  if (provider === "google") {
    const base = new URLSearchParams({ singleEvents: "true", maxResults: "250" });
    if (full) {
      base.set("timeMin", from.window.start.toISOString());
      base.set("timeMax", from.window.end.toISOString());
    } else {
      base.set("syncToken", from.cursor);
    }
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams(base);
      if (pageToken) params.set("pageToken", pageToken);
      const body = await api(`${GOOGLE_CALENDAR}/calendars/${encodeURIComponent(calendarId)}/events?${params}`, access);
      for (const raw of (body.items as unknown[] | undefined) ?? []) {
        const change = fromGoogle(raw);
        if (change) changes.push(change);
      }
      pageToken = typeof body.nextPageToken === "string" ? body.nextPageToken : undefined;
      if (!pageToken) {
        if (typeof body.nextSyncToken !== "string") throw new ProviderError("bad");
        return { changes, cursor: body.nextSyncToken, full };
      }
    }
    throw new ProviderError("bad");
  }

  const headers = { Prefer: 'outlook.timezone="UTC", IdType="ImmutableId", odata.maxpagesize=100' };
  let next: string = full
    ? `${GRAPH}/me/calendars/${encodeURIComponent(calendarId)}/calendarView/delta?${new URLSearchParams({
        startDateTime: from.window.start.toISOString(),
        endDateTime: from.window.end.toISOString(),
      })}`
    : graphLink(from.cursor);
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await api(next, access, headers);
    for (const raw of (body.value as unknown[] | undefined) ?? []) {
      const change = fromGraph(raw);
      if (change) changes.push(change);
    }
    if (typeof body["@odata.deltaLink"] === "string") return { changes, cursor: graphLink(body["@odata.deltaLink"]), full };
    if (typeof body["@odata.nextLink"] !== "string") throw new ProviderError("bad");
    next = graphLink(body["@odata.nextLink"]);
  }
  throw new ProviderError("bad");
}
