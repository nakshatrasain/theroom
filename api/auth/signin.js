import { methodNotAllowed, readJson, sendJson, signIn } from "../_lib.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    methodNotAllowed(response, ["POST"]);
    return;
  }

  try {
    const payload = await readJson(request);
    const email = String(payload.email || "").trim();
    const password = String(payload.password || "").trim();

    if (!email || !password) {
      sendJson(response, { error: "Email and password are required" }, 400);
      return;
    }

    const result = await signIn({ email, password });
    const user = result.user || {};

    sendJson(response, {
      user: {
        id: user.id || "",
        email: user.email || email,
        name: user.user_metadata?.name || "",
      },
      session: {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_in: result.expires_in,
        token_type: result.token_type,
      },
      requires_confirmation: false,
    });
  } catch (error) {
    sendJson(response, { error: error.message || "Sign in failed" }, error.status || 500);
  }
}
