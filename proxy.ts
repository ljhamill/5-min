import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

// Single-project, hostname-based routing:
//   trade.incantr.com/*              -> /app/*   (the trading terminal)
//   incantr.com, www.*, previews, localhost -> /home/*  (the marketing landing page)
// Both /app and /home stay directly reachable so local dev and preview
// deployments can hit either subtree explicitly without a "trade." host.
//
// On top of that, every request resolving to /app is gated: no session ->
// redirect to sign-in; session but not yet approved (closed beta) ->
// redirect to a pending-approval page; approved -> let it through.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /auth/* is never rewritten and never gated. This is critical — without
  // it, the gate's own redirect target (/auth/sign-in) would get rewritten
  // by the host branch below into /app/auth/sign-in, which the gate then
  // sees as an /app request and redirects again: an infinite loop.
  if (pathname.startsWith("/auth")) {
    return NextResponse.next();
  }

  const host = req.headers.get("host") ?? "";

  // Resolve which subtree this request targets, and the rewrite destination
  // if any, as plain data. The actual NextResponse is (re)built by
  // buildResponse() below so that cookie mutations from the Supabase client
  // (session token refresh) never clobber a pending rewrite.
  let targetIsApp: boolean;
  let rewriteUrl: URL | null = null;

  if (pathname.startsWith("/app")) {
    targetIsApp = true;
  } else if (pathname.startsWith("/home")) {
    targetIsApp = false;
  } else {
    targetIsApp = host.startsWith("trade.");
    rewriteUrl = req.nextUrl.clone();
    rewriteUrl.pathname = (targetIsApp ? "/app" : "/home") + pathname;
  }

  function buildResponse() {
    return rewriteUrl ? NextResponse.rewrite(rewriteUrl!) : NextResponse.next({ request: req });
  }

  let response = buildResponse();

  // /home is never gated.
  if (!targetIsApp) return response;

  // Auth gate for /app. Bind a Supabase server client to this request/response
  // pair — any session-token refresh (setAll) rides along on whichever
  // response we ultimately return, including the redirects below. Never
  // construct an independent NextResponse after calling getUser() without
  // copying this response's cookies onto it, or a refreshed session cookie
  // gets silently dropped.
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = buildResponse();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() (not getSession()) revalidates the JWT against Supabase Auth's
  // server rather than trusting a possibly-stale local cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const signInUrl = req.nextUrl.clone();
    signInUrl.pathname = "/auth/sign-in";
    signInUrl.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(signInUrl);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("approved")
    .eq("id", user.id)
    .single();

  if (!profile?.approved) {
    const pendingUrl = req.nextUrl.clone();
    pendingUrl.pathname = "/auth/pending";
    const redirect = NextResponse.redirect(pendingUrl);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
