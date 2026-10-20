import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, hasLocale, localeCookie, type Locale } from "@/i18n/config";
import { refreshSupabaseSession } from "@/lib/supabase/session";

function preferredLocale(request: NextRequest): Locale {
  const saved = request.cookies.get(localeCookie)?.value;
  if (hasLocale(saved)) return saved;

  const accepted = (request.headers.get("accept-language") ?? "")
    .split(",")
    .map((part) => part.split(";")[0].trim().toLowerCase().split("-")[0]);
  for (const language of accepted) {
    // "iw" is the legacy code some browsers still send for Hebrew.
    const normalized = language === "iw" ? "he" : language;
    if (hasLocale(normalized)) return normalized;
  }
  return defaultLocale;
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const [, firstSegment, secondSegment] = pathname.split("/");
  const lang = hasLocale(firstSegment) ? firstSegment : preferredLocale(request);

  // A link from the sign-in email can land on any page (Supabase falls back to the Site URL when the
  // callback isn't allow-listed). Finish signing in wherever it lands, or explain that it expired.
  const code = searchParams.get("code");
  if (code) {
    const callback = new URL("/api/auth/callback", request.nextUrl.origin);
    callback.searchParams.set("code", code);
    callback.searchParams.set("lang", lang);
    return NextResponse.redirect(callback);
  }
  if (searchParams.get("error_code") || searchParams.get("error_description")) {
    const door = new URL(`/${lang}/login`, request.nextUrl.origin);
    door.searchParams.set("link", "expired");
    return NextResponse.redirect(door);
  }

  if (hasLocale(firstSegment) && secondSegment === "register") {
    const door = request.nextUrl.clone();
    door.pathname = `/${firstSegment}/login`;
    return NextResponse.redirect(door, 308);
  }
  if (hasLocale(firstSegment)) return refreshSupabaseSession(request);

  const url = request.nextUrl.clone();
  url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
