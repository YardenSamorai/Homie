import { NextResponse } from "next/server";

const clip = (value: unknown, length: number) => (typeof value === "string" ? value.slice(0, length) : undefined);

/** Crashes from phones and browsers, written to the server log (Vercel → Logs) where they can be read. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return new NextResponse(null, { status: 204 });
  console.error(
    "[client]",
    JSON.stringify({
      message: clip(body.message, 500),
      stack: clip(body.stack, 2000),
      path: clip(body.path, 200),
      app: body.app === true,
      agent: clip(request.headers.get("user-agent"), 200),
    }),
  );
  return new NextResponse(null, { status: 204 });
}
