import { getSupabaseConfig, methodNotAllowed, sendJson, supabaseReady } from "./_lib.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    methodNotAllowed(response, ["GET"]);
    return;
  }

  const supabaseConfig = getSupabaseConfig();
  const supabaseEnabled = Boolean(supabaseConfig);
  const supabaseReachable = supabaseEnabled ? await supabaseReady() : false;

  sendJson(response, {
    env: {
      ROOM_EVENT_NAME: Boolean(process.env.ROOM_EVENT_NAME),
      OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
      OPENAI_MODEL: Boolean(process.env.OPENAI_MODEL),
      SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY),
    },
    supabase: {
      enabled: supabaseEnabled,
      ready: supabaseReachable,
      key_source: process.env.SUPABASE_SERVICE_ROLE_KEY
        ? "service_role"
        : process.env.SUPABASE_ANON_KEY
        ? "anon"
        : null,
    },
  });
}
