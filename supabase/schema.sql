create table if not exists attendees (
  id text primary key,
  name text not null,
  role text not null,
  skills jsonb not null default '[]'::jsonb,
  event_goal text not null,
  build_interest text not null,
  bio text not null,
  build_style text not null,
  pace text not null,
  collaboration text not null,
  strength_zone text not null,
  looking_for text not null,
  contact_handle text not null,
  created_at timestamptz not null default now()
);

create index if not exists attendees_strength_zone_idx on attendees (strength_zone);

alter table attendees enable row level security;
