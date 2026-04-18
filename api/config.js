import { getSupabaseConfig, methodNotAllowed, sendJson, supabaseReady } from "./_lib.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    methodNotAllowed(response, ["GET"]);
    return;
  }

  const supabaseEnabled = Boolean(getSupabaseConfig());
  const ready = supabaseEnabled ? await supabaseReady() : false;

  sendJson(response, {
    event_name: process.env.ROOM_EVENT_NAME || "OpenAI Hackathon",
    supabase_enabled: supabaseEnabled,
    supabase_ready: ready,
    openai_enabled: Boolean(process.env.OPENAI_API_KEY),
  });
}
