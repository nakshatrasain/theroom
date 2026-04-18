#!/usr/bin/env python3

from __future__ import annotations

import json
import mimetypes
import os
import re
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib import error, request


ROOT = Path(__file__).parent
DATA_PATH = ROOT / "data" / "mock_attendees.json"
ENV_PATH = ROOT / ".env"


def load_env_file() -> None:
    if not ENV_PATH.exists():
        return

    for raw_line in ENV_PATH.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


load_env_file()


def load_mock_attendees() -> list[dict[str, Any]]:
    return json.loads(DATA_PATH.read_text())


def tokenize(value: str) -> list[str]:
    return [item for item in re.split(r"[^a-z0-9]+", value.lower()) if item]


def normalize_list(values: list[str]) -> list[str]:
    return [value.strip() for value in values if value.strip()]


def score_candidate(profile: dict[str, Any], attendee: dict[str, Any]) -> tuple[int, list[str]]:
    score = 25
    reasons: list[str] = []

    profile_skills = {item.lower() for item in profile.get("skills", [])}
    attendee_skills = {item.lower() for item in attendee.get("skills", [])}
    shared_skills = sorted(profile_skills & attendee_skills)
    if shared_skills:
        score += min(20, len(shared_skills) * 6)
        reasons.append(f"Shared skills around {', '.join(shared_skills[:3])}.")

    profile_interest = set(tokenize(profile.get("build_interest", "")))
    attendee_interest = set(tokenize(attendee.get("build_interest", "")))
    shared_interest = profile_interest & attendee_interest
    if shared_interest:
        score += min(15, len(shared_interest))
        reasons.append("You care about similar problems or industries.")

    profile_goal = set(tokenize(profile.get("event_goal", "")))
    attendee_goal = set(tokenize(attendee.get("event_goal", "")))
    if profile_goal & attendee_goal:
        score += 10
        reasons.append("Your event goals overlap.")

    looking_for = set(tokenize(profile.get("looking_for", "")))
    attendee_role_tokens = set(tokenize(attendee.get("role", "")))
    attendee_strength_tokens = set(tokenize(attendee.get("strength_zone", "")))
    if looking_for & (attendee_role_tokens | attendee_strength_tokens | attendee_skills):
        score += 18
        reasons.append("This person matches who you said you want to meet.")

    if profile.get("build_style") == attendee.get("build_style"):
        score += 7
        reasons.append("You work with a similar build style.")

    if profile.get("pace") == attendee.get("pace"):
        score += 6
        reasons.append("You move at a compatible pace.")

    if profile.get("collaboration") == attendee.get("collaboration"):
        score += 6
        reasons.append("Your collaboration preferences line up.")

    if profile.get("strength_zone") != attendee.get("strength_zone"):
        score += 10
        reasons.append("Their strengths can complement your own.")

    return min(score, 98), reasons


def fallback_match_summary(matches: list[dict[str, Any]]) -> str:
    if not matches:
        return "No good matches were found yet."
    top_names = ", ".join(match["attendee"]["name"] for match in matches[:3])
    return f"Top people to meet first: {top_names}."


def fallback_intro(profile: dict[str, Any], attendee: dict[str, Any]) -> str:
    return (
        f"Hey {attendee['name']}, I’m {profile['name']}. The Room suggested we meet because "
        f"your {attendee['strength_zone']} strengths and {attendee['role']} background seem like a "
        f"great fit for what I’m looking for at this event. I’m exploring {profile['build_interest']}. "
        f"Want to connect for 10 minutes?"
    )


def fetch_openai_json(payload: dict[str, Any]) -> dict[str, Any] | None:
    output_text = fetch_openai_text(payload)
    if not output_text:
        return None

    try:
        return json.loads(output_text)
    except json.JSONDecodeError:
        return None


def fetch_openai_text(payload: dict[str, Any]) -> str | None:
    raw = fetch_openai_response(payload)
    if not raw:
        return None
    return extract_output_text(raw)


def fetch_openai_response(payload: dict[str, Any]) -> dict[str, Any] | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    req = request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=25) as response:
            raw = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        print("OpenAI HTTP error:", detail)
        return None
    except Exception as exc:  # noqa: BLE001
        print("OpenAI request failed:", exc)
        return None

    return raw


def extract_output_text(raw: dict[str, Any]) -> str | None:
    direct = raw.get("output_text")
    if direct:
        return direct

    output_items = raw.get("output", [])
    for item in output_items:
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") == "output_text" and content.get("text"):
                return content["text"]
    return None


def ai_enhance_matches(
    profile: dict[str, Any],
    preliminary_matches: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], str] | None:
    if not preliminary_matches:
        return None

    candidates = [
        {
            "id": match["attendee"]["id"],
            "name": match["attendee"]["name"],
            "role": match["attendee"]["role"],
            "strength_zone": match["attendee"]["strength_zone"],
            "skills": match["attendee"]["skills"],
            "event_goal": match["attendee"]["event_goal"],
            "build_interest": match["attendee"]["build_interest"],
            "working_style": {
                "build_style": match["attendee"]["build_style"],
                "pace": match["attendee"]["pace"],
                "collaboration": match["attendee"]["collaboration"],
            },
        }
        for match in preliminary_matches[:6]
    ]

    payload = {
        "model": os.getenv("OPENAI_MODEL", "gpt-5-mini"),
        "input": [
            {
                "role": "system",
                "content": (
                    "You are ranking event attendees for networking relevance. "
                    "Return concise, specific reasoning in plain English."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "profile": profile,
                        "candidates": candidates,
                        "task": (
                            "Choose the best 3 people to meet first. "
                            "Prefer complementary skills, relevant goals, and compatible working style."
                        ),
                    }
                ),
            },
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "match_bundle",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "summary": {"type": "string"},
                        "matches": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "id": {"type": "string"},
                                    "score": {"type": "integer"},
                                    "why": {"type": "string"},
                                },
                                "required": ["id", "score", "why"],
                                "additionalProperties": False,
                            },
                        },
                    },
                    "required": ["summary", "matches"],
                    "additionalProperties": False,
                },
            }
        },
    }

    result = fetch_openai_json(payload)
    if not result:
        return None

    by_id = {match["attendee"]["id"]: match for match in preliminary_matches}
    enhanced_matches = []
    for item in result.get("matches", [])[:3]:
        base = by_id.get(item.get("id"))
        if not base:
            continue
        enhanced_matches.append(
            {
                "attendee": base["attendee"],
                "score": max(1, min(99, int(item.get("score", base["score"])))),
                "why": item.get("why") or base["why"],
            }
        )

    if not enhanced_matches:
        return None

    return enhanced_matches, result.get("summary", fallback_match_summary(enhanced_matches))


def ai_intro(profile: dict[str, Any], attendee: dict[str, Any]) -> str | None:
    payload = {
        "model": os.getenv("OPENAI_MODEL", "gpt-5-mini"),
        "input": [
            {
                "role": "system",
                "content": (
                    "Write one warm, concise networking intro message. "
                    "Keep it under 90 words and make it feel human, not salesy."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "sender": profile,
                        "recipient": attendee,
                        "goal": "Start a relevant event conversation with context from the match.",
                    }
                ),
            },
        ],
    }
    return fetch_openai_text(payload)


@dataclass
class SupabaseClient:
    url: str
    key: str

    @property
    def rest_url(self) -> str:
        return f"{self.url.rstrip('/')}/rest/v1"

    @property
    def auth_url(self) -> str:
        return f"{self.url.rstrip('/')}/auth/v1"

    def _request(
        self,
        method: str,
        path: str,
        body: Any | None = None,
        query: str = "",
        extra_headers: dict[str, str] | None = None,
    ) -> Any:
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
        }
        if body is not None:
            headers["Content-Type"] = "application/json"
            payload = json.dumps(body).encode("utf-8")
        else:
            payload = None

        if extra_headers:
            headers.update(extra_headers)

        req = request.Request(
            f"{self.rest_url}{path}{query}",
            data=payload,
            headers=headers,
            method=method,
        )
        with request.urlopen(req, timeout=20) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else None

    def list_attendees(self) -> list[dict[str, Any]]:
        return self._request("GET", "/attendees", query="?select=*")

    def upsert_attendee(self, attendee: dict[str, Any]) -> None:
        self._request(
            "POST",
            "/attendees",
            body=attendee,
            extra_headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
        )

    def auth_request(
        self,
        method: str,
        path: str,
        body: Any | None = None,
        access_token: str | None = None,
    ) -> Any:
        headers = {
            "apikey": self.key,
        }
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"

        payload = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            payload = json.dumps(body).encode("utf-8")

        req = request.Request(
            f"{self.auth_url}{path}",
            data=payload,
            headers=headers,
            method=method,
        )
        with request.urlopen(req, timeout=20) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else None

    def sign_up(self, email: str, password: str, name: str) -> dict[str, Any]:
        payload = {
            "email": email,
            "password": password,
            "data": {"name": name},
        }
        return self.auth_request("POST", "/signup", body=payload)

    def sign_in(self, email: str, password: str) -> dict[str, Any]:
        payload = {
            "email": email,
            "password": password,
        }
        return self.auth_request("POST", "/token?grant_type=password", body=payload)

    def sign_out(self, access_token: str) -> None:
        self.auth_request("POST", "/logout", access_token=access_token)


def get_supabase_client() -> SupabaseClient | None:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        return None
    return SupabaseClient(url=url, key=key)


def supabase_ready(client: SupabaseClient | None) -> bool:
    if not client:
        return False
    try:
        client.list_attendees()
        return True
    except Exception as exc:  # noqa: BLE001
        print("Supabase not ready yet:", exc)
        return False


class TheRoomHandler(BaseHTTPRequestHandler):
    def _json(self, payload: dict[str, Any], status: int = 200) -> None:
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if not length:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/api/config":
            client = get_supabase_client()
            ready = supabase_ready(client)
            self._json(
                {
                    "event_name": os.getenv("ROOM_EVENT_NAME", "OpenAI Hackathon"),
                    "supabase_enabled": bool(client),
                    "supabase_ready": ready,
                    "openai_enabled": bool(os.getenv("OPENAI_API_KEY")),
                }
            )
            return

        if self.path == "/api/attendees":
            try:
                attendees = self.load_attendees()
                self._json({"attendees": attendees})
            except Exception as exc:  # noqa: BLE001
                self._json({"error": str(exc)}, status=500)
            return

        self.serve_static()

    def do_POST(self) -> None:  # noqa: N802
        try:
            payload = self._read_json()
        except json.JSONDecodeError:
            self._json({"error": "Invalid JSON payload"}, status=400)
            return

        try:
            if self.path == "/api/profile":
                profile = payload.get("profile")
                if not profile:
                    raise ValueError("Missing profile payload")

                profile = self.normalize_profile(profile)
                self.save_profile(profile)
                self._json({"profile": profile})
                return

            if self.path == "/api/match":
                profile = self.normalize_profile(payload.get("profile") or {})
                matches, summary = self.generate_matches(profile)
                self._json({"profile": profile, "matches": matches, "summary": summary})
                return

            if self.path == "/api/intro":
                profile = self.normalize_profile(payload.get("profile") or {})
                attendee = payload.get("attendee") or {}
                if not attendee:
                    raise ValueError("Missing attendee payload")
                message = ai_intro(profile, attendee) or fallback_intro(profile, attendee)
                self._json({"message": message})
                return

            if self.path == "/api/auth/signup":
                self.handle_sign_up(payload)
                return

            if self.path == "/api/auth/signin":
                self.handle_sign_in(payload)
                return

            if self.path == "/api/auth/signout":
                self.handle_sign_out(payload)
                return

            self._json({"error": "Not found"}, status=404)
        except ValueError as exc:
            self._json({"error": str(exc)}, status=400)
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            try:
                payload = json.loads(detail)
            except json.JSONDecodeError:
                payload = {"msg": detail or "Authentication request failed"}
            message = payload.get("msg") or payload.get("message") or "Authentication request failed"
            self._json({"error": message}, status=exc.code)
        except Exception as exc:  # noqa: BLE001
            self._json({"error": str(exc)}, status=500)

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        print(f"{self.address_string()} - {format % args}")

    def normalize_profile(self, profile: dict[str, Any]) -> dict[str, Any]:
        required = ["name", "role", "event_goal", "build_interest", "bio", "looking_for", "contact_handle"]
        for key in required:
            if not str(profile.get(key, "")).strip():
                raise ValueError(f"Missing required field: {key}")

        skills = profile.get("skills", [])
        if isinstance(skills, str):
            skills = [item.strip() for item in skills.split(",")]

        return {
            "id": profile.get("id") or f"profile-{re.sub(r'[^a-z0-9]+', '-', profile['name'].lower()).strip('-')}",
            "name": profile["name"].strip(),
            "role": profile["role"].strip(),
            "skills": normalize_list(skills),
            "event_goal": profile["event_goal"].strip(),
            "build_interest": profile["build_interest"].strip(),
            "bio": profile["bio"].strip(),
            "build_style": profile.get("build_style", "visionary"),
            "pace": profile.get("pace", "fast-moving"),
            "collaboration": profile.get("collaboration", "balanced"),
            "strength_zone": profile.get("strength_zone", "product"),
            "looking_for": profile["looking_for"].strip(),
            "contact_handle": profile["contact_handle"].strip(),
        }

    def require_auth_client(self) -> SupabaseClient:
        client = get_supabase_client()
        if not client:
            raise ValueError("Supabase is not configured")
        return client

    def handle_sign_up(self, payload: dict[str, Any]) -> None:
        client = self.require_auth_client()
        name = str(payload.get("name", "")).strip()
        email = str(payload.get("email", "")).strip()
        password = str(payload.get("password", "")).strip()
        if not name or not email or not password:
            raise ValueError("Name, email, and password are required")

        response = client.sign_up(email=email, password=password, name=name)
        user = response.get("user") or {}
        session = response.get("session")
        self._json(
            {
                "user": {
                    "id": user.get("id"),
                    "email": user.get("email", email),
                    "name": (user.get("user_metadata") or {}).get("name", name),
                },
                "session": session,
                "requires_confirmation": session is None,
            }
        )

    def handle_sign_in(self, payload: dict[str, Any]) -> None:
        client = self.require_auth_client()
        email = str(payload.get("email", "")).strip()
        password = str(payload.get("password", "")).strip()
        if not email or not password:
            raise ValueError("Email and password are required")

        response = client.sign_in(email=email, password=password)
        user = response.get("user") or {}
        self._json(
            {
                "user": {
                    "id": user.get("id"),
                    "email": user.get("email", email),
                    "name": (user.get("user_metadata") or {}).get("name", ""),
                },
                "session": {
                    "access_token": response.get("access_token"),
                    "refresh_token": response.get("refresh_token"),
                    "expires_in": response.get("expires_in"),
                    "token_type": response.get("token_type"),
                },
                "requires_confirmation": False,
            }
        )

    def handle_sign_out(self, payload: dict[str, Any]) -> None:
        client = self.require_auth_client()
        access_token = str(payload.get("access_token", "")).strip()
        if access_token:
            try:
                client.sign_out(access_token)
            except error.HTTPError:
                pass
        self._json({"ok": True})

    def load_attendees(self) -> list[dict[str, Any]]:
        client = get_supabase_client()
        if client:
            try:
                attendees = client.list_attendees()
                if attendees:
                    return attendees
            except Exception as exc:  # noqa: BLE001
                print("Supabase read failed, falling back to mock data:", exc)
        return load_mock_attendees()

    def save_profile(self, profile: dict[str, Any]) -> None:
        client = get_supabase_client()
        if not client:
            attendees = load_mock_attendees()
            for index, attendee in enumerate(attendees):
                if attendee["id"] == profile["id"]:
                    attendees[index] = profile
                    break
            else:
                attendees.insert(0, profile)
            DATA_PATH.write_text(json.dumps(attendees, indent=2))
            return

        client.upsert_attendee(profile)

    def generate_matches(self, profile: dict[str, Any]) -> tuple[list[dict[str, Any]], str]:
        attendees = [attendee for attendee in self.load_attendees() if attendee["id"] != profile["id"]]
        preliminary: list[dict[str, Any]] = []

        for attendee in attendees:
            score, reasons = score_candidate(profile, attendee)
            why = " ".join(reasons[:3]) or "Relevant experience and goals."
            preliminary.append(
                {
                    "attendee": attendee,
                    "score": score,
                    "why": why,
                }
            )

        preliminary.sort(key=lambda item: item["score"], reverse=True)
        preliminary = preliminary[:6]

        enhanced = ai_enhance_matches(profile, preliminary)
        if enhanced:
            matches, summary = enhanced
            return matches, summary

        return preliminary[:3], fallback_match_summary(preliminary[:3])

    def serve_static(self) -> None:
        target = self.path.split("?", 1)[0]
        if target == "/":
            target = "/index.html"

        file_path = (ROOT / target.lstrip("/")).resolve()
        if ROOT not in file_path.parents and file_path != ROOT:
            self.send_error(403)
            return

        if not file_path.exists() or not file_path.is_file():
            self.send_error(404)
            return

        content = file_path.read_bytes()
        mime_type, _ = mimetypes.guess_type(str(file_path))
        self.send_response(200)
        self.send_header("Content-Type", mime_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)


def main() -> None:
    port = int(os.getenv("PORT", "4173"))
    server = ThreadingHTTPServer(("127.0.0.1", port), TheRoomHandler)
    print(f"The Room running on http://127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
