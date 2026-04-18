import {
  aiIntro,
  fallbackIntro,
  methodNotAllowed,
  normalizeProfile,
  readJson,
  sendJson,
} from "./_lib.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    methodNotAllowed(response, ["POST"]);
    return;
  }

  try {
    const payload = await readJson(request);
    const profile = normalizeProfile(payload.profile || {});
    const attendee = payload.attendee;

    if (!attendee) {
      sendJson(response, { error: "Missing attendee payload" }, 400);
      return;
    }

    const message = (await aiIntro(profile, attendee)) || fallbackIntro(profile, attendee);
    sendJson(response, { message });
  } catch (error) {
    sendJson(response, { error: error.message || "Failed to generate intro" }, error.status || 500);
  }
}
