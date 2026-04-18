import { fetchAuthUser, methodNotAllowed, readJson, sendJson } from "../_lib.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    methodNotAllowed(response, ["POST"]);
    return;
  }

  try {
    const payload = await readJson(request);
    const accessToken = String(payload.access_token || "").trim();

    if (!accessToken) {
      sendJson(response, { error: "Access token is required" }, 400);
      return;
    }

    const user = await fetchAuthUser(accessToken);
    sendJson(response, {
      user: {
        id: user?.id || "",
        email: user?.email || "",
        name: user?.user_metadata?.name || user?.email?.split("@")[0] || "Guest",
      },
    });
  } catch (error) {
    sendJson(response, { error: error.message || "Failed to load session" }, error.status || 500);
  }
}
