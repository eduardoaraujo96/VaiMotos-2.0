create extension if not exists "pgcrypto";

create type public.user_role as enum ('passenger', 'driver');
create type public.ride_status as enum (
  'bidding',
  'awarded',
  'en_route',
  'in_progress',
  'completed',
  'cancelled'
);
create type public.bid_status as enum ('pending', 'accepted', 'rejected', 'withdrawn');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  phone text,
  role public.user_role not null default 'passenger',
  rating numeric(2,1) not null default 5.0,
  avatar_url text,
  plate text,
  vehicle_model text,
  is_online boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.rides (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references public.profiles (id),
  driver_id uuid references public.profiles (id),
  origin_lat double precision not null,
  origin_lng double precision not null,
  origin_address text not null,
  origin_neighborhood text,
  dest_lat double precision not null,
  dest_lng double precision not null,
  dest_address text not null,
  dest_neighborhood text,
  suggested_price numeric(10,2) not null,
  estimated_minutes integer not null,
  distance_km numeric(6,2) not null,
  final_price numeric(10,2),
  accepted_bid_id uuid,
  status public.ride_status not null default 'bidding',
  expires_at timestamptz not null default (now() + interval '90 seconds'),
  created_at timestamptz not null default now()
);

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides (id) on delete cascade,
  driver_id uuid not null references public.profiles (id),
  amount numeric(10,2) not null check (amount > 0),
  eta_minutes integer not null check (eta_minutes > 0),
  status public.bid_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (ride_id, driver_id)
);

alter table public.rides
  add constraint rides_accepted_bid_fk
  foreign key (accepted_bid_id) references public.bids (id);

create index bids_ride_id_idx on public.bids (ride_id);
create index bids_driver_id_idx on public.bids (driver_id);
create index rides_status_idx on public.rides (status);
create index rides_passenger_id_idx on public.rides (passenger_id);

alter table public.profiles enable row level security;
alter table public.rides enable row level security;
alter table public.bids enable row level security;

create policy profiles_self_rw on public.profiles
  for all using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_public_read on public.profiles
  for select using (true);

create policy rides_passenger_own on public.rides
  for select using (passenger_id = auth.uid());

create policy rides_passenger_insert on public.rides
  for insert with check (passenger_id = auth.uid());

create policy rides_passenger_update on public.rides
  for update using (passenger_id = auth.uid());

create policy rides_driver_open_or_assigned on public.rides
  for select using (
    status = 'bidding'
    or driver_id = auth.uid()
  );

create policy bids_passenger_sees_all_for_own_ride on public.bids
  for select using (
    exists (
      select 1 from public.rides r
      where r.id = bids.ride_id
        and r.passenger_id = auth.uid()
    )
  );

create policy bids_driver_own_only on public.bids
  for select using (driver_id = auth.uid());

create policy bids_driver_insert_own on public.bids
  for insert with check (
    driver_id = auth.uid()
    and exists (
      select 1 from public.rides r
      where r.id = ride_id
        and r.status = 'bidding'
        and r.expires_at > now()
    )
  );

create policy bids_driver_update_own_pending on public.bids
  for update using (driver_id = auth.uid() and status = 'pending')
  with check (driver_id = auth.uid());

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
  select * into v_bid from public.bids where id = p_bid_id;
  if not found then
    raise exception 'bid_not_found';
  end if;

  select * into v_ride from public.rides where id = v_bid.ride_id;
  if v_ride.passenger_id <> auth.uid() then
    raise exception 'not_ride_owner';
  end if;
  if v_ride.status <> 'bidding' then
    raise exception 'ride_not_open';
  end if;
  if v_bid.status <> 'pending' then
    raise exception 'bid_not_pending';
  end if;

  update public.bids
    set status = 'accepted'
    where id = v_bid.id;

  update public.bids
    set status = 'rejected'
    where ride_id = v_ride.id
      and id <> v_bid.id
      and status = 'pending';

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

grant execute on function public.accept_bid(uuid) to authenticated;

alter publication supabase_realtime add table public.rides;
alter publication supabase_realtime add table public.bids;
