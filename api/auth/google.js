import { getSupabaseConfig, methodNotAllowed, sendJson } from "../_lib.js";

function requestOrigin(request) {
  const proto = request.headers["x-forwarded-proto"] || "https";
  const host = request.headers.host;
  return `${proto}://${host}`;
}

function safeRedirectTarget(request, candidate) {
  const origin = requestOrigin(request);

  if (!candidate) {
    return `${origin}/`;
  }

  try {
    const url = new URL(candidate, origin);
    if (url.origin !== origin) {
      return `${origin}/`;
    }
    url.hash = "";
    return url.toString();
  } catch (_error) {
    return `${origin}/`;
  }
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    methodNotAllowed(response, ["GET"]);
    return;
  }

  const config = getSupabaseConfig();
  if (!config) {
    sendJson(response, { error: "Supabase is not configured" }, 503);
    return;
  }

  const requestUrl = new URL(request.url, requestOrigin(request));
  const redirectTo = safeRedirectTarget(request, requestUrl.searchParams.get("redirect_to"));
  const authorizeUrl = new URL("/auth/v1/authorize", config.url);

  authorizeUrl.searchParams.set("provider", "google");
  authorizeUrl.searchParams.set("redirect_to", redirectTo);

  response.statusCode = 302;
  response.setHeader("Location", authorizeUrl.toString());
  response.end();
}
