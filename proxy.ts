import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Single-project, hostname-based routing:
//   trade.incantr.com/*              -> /app/*   (the trading terminal)
//   incantr.com, www.*, previews, localhost -> /home/*  (the marketing landing page)
// Both /app and /home stay directly reachable so local dev and preview
// deployments can hit either subtree explicitly without a "trade." host.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/app") || pathname.startsWith("/home")) {
    return NextResponse.next();
  }

  const host = req.headers.get("host") ?? "";
  const url = req.nextUrl.clone();
  url.pathname = (host.startsWith("trade.") ? "/app" : "/home") + pathname;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
