import { NextResponse, type NextRequest } from "next/server";
import { hasLocale } from "@/i18n/config";
import { authorizeUrl } from "@/lib/calendars/providers";
import { pkceChallenge } from "@/lib/calendars/seal";
import { calendarSetup, cookieOptions, isProvider, newPending, OAUTH_COOKIE, redirectUri, sealPending, signedIn } from "@/lib/calendars/server";

/**
 * Starts connecting a calendar account: a state value and a PKCE verifier go into a sealed, http-only cookie that
 * only the callback reads, then the browser goes to the provider's own consent screen.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/calendars/connect/[provider]">) {
  const { provider } = await ctx.params;
  const lang = request.nextUrl.searchParams.get("lang") ?? undefined;
  const locale = hasLocale(lang) ? lang : "he";
  const back = (status: string) => NextResponse.redirect(new URL(`/${locale}/settings?calendars=${status}#calendars`, request.url));

  if (!isProvider(provider)) return back("unknown");
  const setup = calendarSetup();
  if (!setup[provider]) return back("unavailable");
  const session = await signedIn();
  if (!session) return NextResponse.redirect(new URL(`/${locale}/login`, request.url));

  const pending = newPending(provider, session.user.id, locale);
  const response = NextResponse.redirect(
    authorizeUrl(provider, { redirectUri: redirectUri(request, provider), state: pending.state, challenge: pkceChallenge(pending.verifier) }),
  );
  response.cookies.set(OAUTH_COOKIE, sealPending(pending), cookieOptions(request));
  return response;
}
