import { methodNotAllowed, readJson, sendJson, signOut } from "../_lib.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    methodNotAllowed(response, ["POST"]);
    return;
  }

  const payload = await readJson(request);
  const accessToken = String(payload.access_token || "").trim();

  if (accessToken) {
    await signOut(accessToken);
  }

  sendJson(response, { ok: true });
}
