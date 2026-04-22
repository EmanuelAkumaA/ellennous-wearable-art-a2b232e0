create table public.client_telemetry (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null,
  session_id text not null,
  user_agent text,
  meta jsonb not null default '{}'::jsonb
);

create index idx_client_telemetry_event_type_created_at
  on public.client_telemetry (event_type, created_at desc);

create index idx_client_telemetry_session_id
  on public.client_telemetry (session_id);

alter table public.client_telemetry enable row level security;

create policy "Anyone can insert client telemetry"
  on public.client_telemetry
  for insert
  to anon, authenticated
  with check (true);

create policy "Admins can view client telemetry"
  on public.client_telemetry
  for select
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));
