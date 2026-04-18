import { readFile } from "node:fs/promises";

const MOCK_ATTENDEES_PATH = new URL("../data/mock_attendees.json", import.meta.url);

function tokenize(value = "") {
  return String(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function normalizeList(values) {
  if (Array.isArray(values)) {
    return values.map((value) => String(value).trim()).filter(Boolean);
  }

  return String(values || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

export async function readJson(request) {
  if (!request) {
    return {};
  }

  if (typeof request.json === "function") {
    try {
      return await request.json();
    } catch (_error) {
      return {};
    }
  }

  if (request.body && typeof request.body === "object") {
    return request.body;
  }

  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch (_error) {
      return {};
    }
  }

  try {
    return await new Promise((resolve) => {
      let raw = "";
      request.on("data", (chunk) => {
        raw += chunk;
      });
      request.on("end", () => {
        if (!raw) {
          resolve({});
          return;
        }

        try {
          resolve(JSON.parse(raw));
        } catch (_error) {
          resolve({});
        }
      });
      request.on("error", () => resolve({}));
    });
  } catch (_error) {
    return {};
  }
}

export function sendJson(response, payload, status = 200) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

export function methodNotAllowed(response, methods) {
  response.setHeader("Allow", methods.join(", "));
  sendJson(response, { error: "Method not allowed" }, 405);
}

export async function loadMockAttendees() {
  const raw = await readFile(MOCK_ATTENDEES_PATH, "utf-8");
  return JSON.parse(raw);
}

export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ""),
    key,
  };
}

export async function supabaseRequest(path, { method = "GET", body, accessToken, headers: extraHeaders } = {}) {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("Supabase is not configured");
  }

  const headers = {
    apikey: config.key,
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else {
    headers.Authorization = `Bearer ${config.key}`;
  }

  let payload;
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }

  Object.assign(headers, extraHeaders || {});

  const response = await fetch(`${config.url}${path}`, {
    method,
    headers,
    body: payload,
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_error) {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || "Request failed";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function supabaseReady() {
  try {
    await supabaseRequest("/rest/v1/attendees?select=id&limit=1");
    return true;
  } catch (_error) {
    return false;
  }
}

export async function listAttendees() {
  const config = getSupabaseConfig();
  if (!config) {
    return loadMockAttendees();
  }

  try {
    const attendees = await supabaseRequest("/rest/v1/attendees?select=*&order=created_at.desc");
    return attendees?.length ? attendees : loadMockAttendees();
  } catch (_error) {
    return loadMockAttendees();
  }
}

export async function upsertAttendee(profile) {
  const config = getSupabaseConfig();
  if (!config) {
    return profile;
  }

  await supabaseRequest("/rest/v1/attendees?on_conflict=id", {
    method: "POST",
    body: profile,
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
  });

  return profile;
}

export async function signUp({ name, email, password }) {
  return supabaseRequest("/auth/v1/signup", {
    method: "POST",
    body: {
      email,
      password,
      data: { name },
    },
  });
}

export async function signIn({ email, password }) {
  return supabaseRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: {
      email,
      password,
    },
  });
}

export async function signOut(accessToken) {
  try {
    await supabaseRequest("/auth/v1/logout", {
      method: "POST",
      accessToken,
    });
  } catch (_error) {
    return null;
  }
  return null;
}

export function normalizeProfile(profile = {}) {
  const required = [
    "name",
    "role",
    "event_goal",
    "build_interest",
    "bio",
    "looking_for",
    "contact_handle",
  ];

  for (const key of required) {
    if (!String(profile[key] || "").trim()) {
      const error = new Error(`Missing required field: ${key}`);
      error.status = 400;
      throw error;
    }
  }

  return {
    id:
      profile.id ||
      `profile-${String(profile.name || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")}`,
    name: String(profile.name).trim(),
    role: String(profile.role).trim(),
    skills: normalizeList(profile.skills),
    event_goal: String(profile.event_goal).trim(),
    build_interest: String(profile.build_interest).trim(),
    bio: String(profile.bio).trim(),
    build_style: String(profile.build_style || "visionary").trim(),
    pace: String(profile.pace || "fast-moving").trim(),
    collaboration: String(profile.collaboration || "balanced").trim(),
    strength_zone: String(profile.strength_zone || "product").trim(),
    looking_for: String(profile.looking_for).trim(),
    contact_handle: String(profile.contact_handle).trim(),
  };
}

export function scoreCandidate(profile, attendee) {
  let score = 25;
  const reasons = [];

  const profileSkills = new Set(normalizeList(profile.skills).map((item) => item.toLowerCase()));
  const attendeeSkills = new Set(normalizeList(attendee.skills).map((item) => item.toLowerCase()));
  const sharedSkills = [...profileSkills].filter((item) => attendeeSkills.has(item));

  if (sharedSkills.length) {
    score += Math.min(20, sharedSkills.length * 6);
    reasons.push(`Shared skills around ${sharedSkills.slice(0, 3).join(", ")}.`);
  }

  const profileInterest = new Set(tokenize(profile.build_interest));
  const attendeeInterest = new Set(tokenize(attendee.build_interest));
  const sharedInterest = [...profileInterest].filter((item) => attendeeInterest.has(item));

  if (sharedInterest.length) {
    score += Math.min(15, sharedInterest.length);
    reasons.push("You care about similar problems or industries.");
  }

  const profileGoal = new Set(tokenize(profile.event_goal));
  const attendeeGoal = new Set(tokenize(attendee.event_goal));
  const goalOverlap = [...profileGoal].some((item) => attendeeGoal.has(item));
  if (goalOverlap) {
    score += 10;
    reasons.push("Your event goals overlap.");
  }

  const lookingFor = new Set(tokenize(profile.looking_for));
  const attendeeRoleTokens = new Set(tokenize(attendee.role));
  const attendeeStrengthTokens = new Set(tokenize(attendee.strength_zone));
  const attendeeSkillTokens = new Set(tokenize(normalizeList(attendee.skills).join(" ")));
  const targetHit = [...lookingFor].some(
    (item) =>
      attendeeRoleTokens.has(item) || attendeeStrengthTokens.has(item) || attendeeSkillTokens.has(item)
  );

  if (targetHit) {
    score += 18;
    reasons.push("This person matches who you said you want to meet.");
  }

  if (profile.build_style === attendee.build_style) {
    score += 7;
    reasons.push("You work with a similar build style.");
  }

  if (profile.pace === attendee.pace) {
    score += 6;
    reasons.push("You move at a compatible pace.");
  }

  if (profile.collaboration === attendee.collaboration) {
    score += 6;
    reasons.push("Your collaboration preferences line up.");
  }

  if (profile.strength_zone !== attendee.strength_zone) {
    score += 10;
    reasons.push("Their strengths can complement your own.");
  }

  return {
    score: Math.min(score, 98),
    why: reasons.slice(0, 3).join(" ") || "Relevant experience and goals.",
  };
}

export function fallbackMatchSummary(matches) {
  if (!matches.length) {
    return "No good matches were found yet.";
  }

  return `Top people to meet first: ${matches
    .slice(0, 3)
    .map((match) => match.attendee.name)
    .join(", ")}.`;
}

export function fallbackIntro(profile, attendee) {
  return `Hey ${attendee.name}, I’m ${profile.name}. The Room suggested we meet because your ${attendee.strength_zone} strengths and ${attendee.role} background seem like a great fit for what I’m looking for at this event. I’m exploring ${profile.build_interest}. Want to connect for 10 minutes?`;
}

function extractOutputText(raw) {
  if (raw.output_text) {
    return raw.output_text;
  }

  for (const item of raw.output || []) {
    if (item.type !== "message") {
      continue;
    }

    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) {
        return content.text;
      }
    }
  }

  return null;
}

async function openaiResponse(payload) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.json();
  if (!response.ok) {
    return null;
  }
  return raw;
}

export async function openaiJson(payload) {
  const raw = await openaiResponse(payload);
  if (!raw) {
    return null;
  }

  const text = extractOutputText(raw);
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

export async function openaiText(payload) {
  const raw = await openaiResponse(payload);
  if (!raw) {
    return null;
  }
  return extractOutputText(raw);
}

export async function aiEnhanceMatches(profile, preliminaryMatches) {
  if (!preliminaryMatches.length || !process.env.OPENAI_API_KEY) {
    return null;
  }

  const candidates = preliminaryMatches.slice(0, 6).map((match) => ({
    id: match.attendee.id,
    name: match.attendee.name,
    role: match.attendee.role,
    strength_zone: match.attendee.strength_zone,
    skills: match.attendee.skills,
    event_goal: match.attendee.event_goal,
    build_interest: match.attendee.build_interest,
    working_style: {
      build_style: match.attendee.build_style,
      pace: match.attendee.pace,
      collaboration: match.attendee.collaboration,
    },
  }));

  const result = await openaiJson({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    input: [
      {
        role: "system",
        content:
          "You are ranking event attendees for networking relevance. Return concise, specific reasoning in plain English.",
      },
      {
        role: "user",
        content: JSON.stringify({
          profile,
          candidates,
          task:
            "Choose the best 3 people to meet first. Prefer complementary skills, relevant goals, and compatible working style.",
        }),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "match_bundle",
        strict: true,
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            matches: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  score: { type: "integer" },
                  why: { type: "string" },
                },
                required: ["id", "score", "why"],
                additionalProperties: false,
              },
            },
          },
          required: ["summary", "matches"],
          additionalProperties: false,
        },
      },
    },
  });

  if (!result) {
    return null;
  }

  const byId = Object.fromEntries(preliminaryMatches.map((match) => [match.attendee.id, match]));
  const matches = (result.matches || [])
    .slice(0, 3)
    .map((item) => {
      const base = byId[item.id];
      if (!base) {
        return null;
      }

      return {
        attendee: base.attendee,
        score: Math.max(1, Math.min(99, Number(item.score || base.score))),
        why: item.why || base.why,
      };
    })
    .filter(Boolean);

  if (!matches.length) {
    return null;
  }

  return {
    matches,
    summary: result.summary || fallbackMatchSummary(matches),
  };
}

export async function aiIntro(profile, attendee) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  return openaiText({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    input: [
      {
        role: "system",
        content:
          "Write one warm, concise networking intro message. Keep it under 90 words and make it feel human, not salesy.",
      },
      {
        role: "user",
        content: JSON.stringify({
          sender: profile,
          recipient: attendee,
          goal: "Start a relevant event conversation with context from the match.",
        }),
      },
    ],
  });
}

export async function generateMatches(profile) {
  const attendees = (await listAttendees()).filter((attendee) => attendee.id !== profile.id);

  const preliminary = attendees
    .map((attendee) => {
      const scored = scoreCandidate(profile, attendee);
      return {
        attendee,
        score: scored.score,
        why: scored.why,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  const enhanced = await aiEnhanceMatches(profile, preliminary);
  if (enhanced) {
    return enhanced;
  }

  return {
    matches: preliminary.slice(0, 3),
    summary: fallbackMatchSummary(preliminary.slice(0, 3)),
  };
}
