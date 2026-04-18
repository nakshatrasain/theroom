import { listAttendees, methodNotAllowed, sendJson } from "./_lib.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    methodNotAllowed(response, ["GET"]);
    return;
  }

  try {
    const attendees = await listAttendees();
    sendJson(response, { attendees });
  } catch (error) {
    sendJson(response, { error: error.message || "Failed to load attendees" }, error.status || 500);
  }
}
