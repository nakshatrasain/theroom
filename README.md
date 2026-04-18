# The Room

Functional MVP for event matchmaking.

## Run locally

```bash
python3 server.py
```

Then open `http://127.0.0.1:4173`.

## Environment

Copy `.env.example` to `.env` and fill in the keys you want:

- `OPENAI_API_KEY` enables live AI ranking and intro generation.
- `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_ANON_KEY` enables Supabase-backed attendee storage.

Without keys, the app still works using local mock attendees in `data/mock_attendees.json`.

## Supabase

Run:

- `supabase/schema.sql`
- `supabase/seed.sql`
- `supabase/policies.sql`

against your project SQL editor, then add your keys to `.env`.
