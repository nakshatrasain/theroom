import { generateMatches, methodNotAllowed, normalizeProfile, readJson, sendJson } from "./_lib.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    methodNotAllowed(response, ["POST"]);
    return;
  }

  try {
    const payload = await readJson(request);
    const profile = normalizeProfile(payload.profile || {});
    const result = await generateMatches(profile);
    sendJson(response, {
      profile,
      matches: result.matches,
      summary: result.summary,
    });
  } catch (error) {
    sendJson(
      response,
      { error: error.message || "Failed to generate matches" },
      error.status || 500
    );
  }
}
