import { methodNotAllowed, normalizeProfile, readJson, sendJson, upsertAttendee } from "./_lib.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    methodNotAllowed(response, ["POST"]);
    return;
  }

  try {
    const payload = await readJson(request);
    const profile = normalizeProfile(payload.profile || {});
    await upsertAttendee(profile);
    sendJson(response, { profile });
  } catch (error) {
    sendJson(response, { error: error.message || "Failed to save profile" }, error.status || 500);
  }
}
