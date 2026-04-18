import { methodNotAllowed, readJson, sendJson, signUp } from "../_lib.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    methodNotAllowed(response, ["POST"]);
    return;
  }

  try {
    const payload = await readJson(request);
    const name = String(payload.name || "").trim();
    const email = String(payload.email || "").trim();
    const password = String(payload.password || "").trim();

    if (!name || !email || !password) {
      sendJson(response, { error: "Name, email, and password are required" }, 400);
      return;
    }

    const result = await signUp({ name, email, password });
    const user = result.user || {};

    sendJson(response, {
      user: {
        id: user.id || "",
        email: user.email || email,
        name: user.user_metadata?.name || name,
      },
      session: result.session || null,
      requires_confirmation: result.session == null,
    });
  } catch (error) {
    sendJson(response, { error: error.message || "Sign up failed" }, error.status || 500);
  }
}
