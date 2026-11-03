import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, grantedEnough, listCalendars, ProviderError, revokeTokens, whoIs } from "@/lib/calendars/providers";
import { sameToken } from "@/lib/calendars/seal";
import { adminOrNull, cookieOptions, isProvider, OAUTH_COOKIE, openPending, redirectUri, signedIn } from "@/lib/calendars/server";
import { saveTokens, storeCalendars, type Account } from "@/lib/calendars/sync";

/**
 * The provider sends the browser back here. The state must match the sealed cookie set by /connect, for the same
 * signed-in parent, within ten minutes; the code is redeemed with the PKCE verifier. Then the account and its
 * calendar list are saved — nothing is imported until the parent chooses calendars and who sees them.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/calendars/callback/[provider]">) {
  const { provider } = await ctx.params;
  const pending = openPending(request.cookies.get(OAUTH_COOKIE)?.value);
  const locale = pending?.locale ?? "he";
  const finish = (status: string, account?: string) => {
    const target = new URL(`/${locale}/settings/calendars`, request.url);
    target.searchParams.set("calendars", status);
    if (account) target.searchParams.set("account", account);
    target.hash = "calendars";
    const response = NextResponse.redirect(target);
    response.cookies.set(OAUTH_COOKIE, "", { ...cookieOptions(request), maxAge: 0 });
    return response;
  };

  const params = request.nextUrl.searchParams;
  const state = params.get("state") ?? "";
  if (!isProvider(provider) || !pending || pending.provider !== provider || !state || !sameToken(state, pending.state)) {
    return finish("expired");
  }
  if (params.get("error")) return finish(params.get("error") === "access_denied" ? "denied" : "failed");
  const code = params.get("code");
  if (!code) return finish("failed");

  const session = await signedIn();
  const admin = adminOrNull();
  if (!session || session.user.id !== pending.userId) return finish("expired");
  if (!admin) return finish("unavailable");

  try {
    const tokens = await exchangeCode(provider, code, pending.verifier, redirectUri(request, provider));
    if (!grantedEnough(provider, tokens.scope)) {
      await revokeTokens(provider, tokens);
      return finish("scopes");
    }
    const identity = await whoIs(provider, tokens.access);
    const { data: account, error } = await admin
      .from("calendar_accounts")
      .upsert(
        { user_id: session.user.id, provider, subject: identity.subject, email: identity.email, status: "active", last_error: null },
        { onConflict: "user_id,provider,subject" },
      )
      .select("id, user_id, provider, subject, email, status")
      .single();
    if (error || !account) return finish("failed");
    await saveTokens(admin, account.id, tokens);
    await storeCalendars(admin, account as Account, await listCalendars(provider, tokens.access));
    return finish("connected", account.id);
  } catch (error) {
    if (error instanceof ProviderError) console.warn("[calendars] connect failed", provider, error.failure);
    else console.warn("[calendars] connect failed", provider);
    return finish(error instanceof ProviderError && error.failure === "scope" ? "scopes" : "failed");
  }
}
