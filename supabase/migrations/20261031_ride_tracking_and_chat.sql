alter table public.vehicle_details
  add column if not exists color text;

alter table public.rides
  add column if not exists payment_method text not null default 'to_agree';

do $$ begin
  alter table public.rides
    add constraint rides_payment_method_check
    check (payment_method in ('cash', 'pix', 'to_agree'));
exception when duplicate_object then null;
end $$;

create table if not exists public.ride_messages (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 1 and 280),
  created_at timestamptz not null default now()
);

create index if not exists ride_messages_ride_created_idx
  on public.ride_messages (ride_id, created_at, id);

alter table public.ride_messages enable row level security;

drop policy if exists ride_messages_participant_read on public.ride_messages;
create policy ride_messages_participant_read on public.ride_messages
  for select to authenticated
  using (
    exists (
      select 1
      from public.rides r
      where r.id = ride_messages.ride_id
        and (r.passenger_id = auth.uid() or r.driver_id = auth.uid())
    )
  );

drop policy if exists ride_messages_participant_insert on public.ride_messages;
create policy ride_messages_participant_insert on public.ride_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.rides r
      where r.id = ride_messages.ride_id
        and (r.passenger_id = auth.uid() or r.driver_id = auth.uid())
    )
  );

revoke all on public.ride_messages from anon, authenticated;
grant select, insert on public.ride_messages to authenticated;

drop policy if exists rides_passenger_update on public.rides;

create or replace function public.accept_bid(p_bid_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bid public.bids;
  v_ride public.rides;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_bid from public.bids where id = p_bid_id;
  if not found then
    raise exception 'bid_not_found';
  end if;

  select * into v_ride from public.rides where id = v_bid.ride_id for update;
  if v_ride.passenger_id <> auth.uid() then
    raise exception 'not_ride_owner';
  end if;
  if v_ride.status <> 'bidding' or v_ride.expires_at <= now() then
    raise exception 'ride_not_open';
  end if;
  if v_bid.status <> 'pending' then
    raise exception 'bid_not_pending';
  end if;

  update public.bids set status = 'accepted' where id = v_bid.id;
  update public.bids
    set status = 'rejected'
    where ride_id = v_ride.id and id <> v_bid.id and status = 'pending';

  update public.rides
    set
      status = 'awarded',
      driver_id = v_bid.driver_id,
      accepted_bid_id = v_bid.id,
      final_price = v_bid.amount
    where id = v_ride.id
    returning * into v_ride;

  return v_ride;
end;
$$;

revoke all on function public.accept_bid(uuid) from public;
grant execute on function public.accept_bid(uuid) to authenticated;

create or replace function public.transition_ride(p_ride_id uuid, p_next_status text)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
  v_allowed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_ride from public.rides where id = p_ride_id for update;
  if not found then
    raise exception 'ride_not_found';
  end if;

  if p_next_status = 'cancelled' then
    v_allowed :=
      (v_ride.passenger_id = auth.uid() and v_ride.status in ('bidding', 'awarded'))
      or (v_ride.driver_id = auth.uid() and v_ride.status in ('awarded', 'en_route', 'in_progress'));
  elsif v_ride.driver_id = auth.uid() then
    v_allowed :=
      (v_ride.status = 'awarded' and p_next_status = 'en_route')
      or (v_ride.status = 'en_route' and p_next_status = 'in_progress')
      or (v_ride.status = 'in_progress' and p_next_status = 'completed');
  end if;

  if not v_allowed then
    raise exception 'invalid_ride_transition';
  end if;

  update public.rides
    set status = p_next_status::public.ride_status
    where id = p_ride_id
    returning * into v_ride;

  return v_ride;
end;
$$;

revoke all on function public.transition_ride(uuid, text) from public;
grant execute on function public.transition_ride(uuid, text) to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'ride_messages'
     ) then
    alter publication supabase_realtime add table public.ride_messages;
  end if;
end $$;
