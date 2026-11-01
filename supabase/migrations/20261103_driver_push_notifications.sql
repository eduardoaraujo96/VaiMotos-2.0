create table if not exists public.driver_push_tokens (
  token text primary key,
  driver_id uuid not null references public.profiles (id) on delete cascade,
  device_id text not null,
  platform text not null default 'android' check (platform = 'android'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_push_tokens_driver_device_unique unique (driver_id, device_id)
);

create index if not exists driver_push_tokens_driver_idx
  on public.driver_push_tokens (driver_id);

drop policy if exists driver_push_tokens_own_insert on public.driver_push_tokens;
create policy driver_push_tokens_own_insert on public.driver_push_tokens
  for insert to authenticated
  with check (
    driver_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'driver'
    )
  );

alter table public.driver_push_tokens enable row level security;
revoke all on public.driver_push_tokens from public, anon, authenticated;
grant select, insert, update, delete on public.driver_push_tokens to authenticated;

drop policy if exists driver_push_tokens_own_select on public.driver_push_tokens;
create policy driver_push_tokens_own_select on public.driver_push_tokens
  for select to authenticated
  using (driver_id = auth.uid());

drop policy if exists driver_push_tokens_own_update on public.driver_push_tokens;
create policy driver_push_tokens_own_update on public.driver_push_tokens
  for update to authenticated
  using (driver_id = auth.uid())
  with check (
    driver_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'driver'
    )
  );

drop policy if exists driver_push_tokens_own_delete on public.driver_push_tokens;
create policy driver_push_tokens_own_delete on public.driver_push_tokens
  for delete to authenticated
  using (driver_id = auth.uid());

create table if not exists public.ride_push_targets (
  ride_id uuid not null references public.rides (id) on delete cascade,
  driver_id uuid not null references public.profiles (id) on delete cascade,
  token text not null references public.driver_push_tokens (token) on update cascade on delete cascade,
  request_claimed_at timestamptz,
  request_sent_at timestamptz,
  request_error text,
  cancel_claimed_at timestamptz,
  cancel_sent_at timestamptz,
  cancel_error text,
  created_at timestamptz not null default now(),
  primary key (ride_id, token)
);

create index if not exists ride_push_targets_driver_idx
  on public.ride_push_targets (driver_id, created_at desc);

alter table public.ride_push_targets enable row level security;
revoke all on public.ride_push_targets from public, anon, authenticated;
grant all on public.ride_push_targets to service_role;
