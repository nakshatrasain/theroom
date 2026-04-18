create policy "anon can read attendees"
on attendees
for select
to anon
using (true);

create policy "anon can insert attendees"
on attendees
for insert
to anon
with check (true);

create policy "anon can update attendees"
on attendees
for update
to anon
using (true)
with check (true);
