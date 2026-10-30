create extension if not exists "pgcrypto";

do $$ begin
  create type public.user_role as enum ('passenger', 'driver');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.ride_status as enum (
    'bidding', 'awarded', 'en_route', 'in_progress', 'completed', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.bid_status as enum ('pending', 'accepted', 'rejected', 'withdrawn');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.vehicle_status as enum ('pending', 'active', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.cnh_status as enum ('pending', 'valid', 'expired');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text,
  role public.user_role not null default 'passenger',
  rating numeric(2,1) not null default 5.0,
  avatar_url text,
  home_address text,
  work_address text,
  cnh_number text,
  cnh_status public.cnh_status,
  is_online boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_details (
  driver_id uuid primary key references public.profiles (id) on delete cascade,
  plate text not null,
  vehicle_model text not null,
  status public.vehicle_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rides (
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

create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides (id) on delete cascade,
  driver_id uuid not null references public.profiles (id),
  amount numeric(10,2) not null check (amount > 0),
  eta_minutes integer not null check (eta_minutes > 0),
  status public.bid_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (ride_id, driver_id)
);

do $$ begin
  alter table public.rides
    add constraint rides_accepted_bid_fk
    foreign key (accepted_bid_id) references public.bids (id);
exception when duplicate_object then null;
end $$;

create index if not exists bids_ride_id_idx on public.bids (ride_id);
create index if not exists bids_driver_id_idx on public.bids (driver_id);
create index if not exists rides_status_idx on public.rides (status);
create index if not exists rides_passenger_id_idx on public.rides (passenger_id);

alter table public.profiles enable row level security;
alter table public.vehicle_details enable row level security;
alter table public.rides enable row level security;
alter table public.bids enable row level security;

drop policy if exists profiles_self_rw on public.profiles;
create policy profiles_self_rw on public.profiles
  for all using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read on public.profiles
  for select using (true);

drop policy if exists vehicle_self_rw on public.vehicle_details;
create policy vehicle_self_rw on public.vehicle_details
  for all using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

drop policy if exists vehicle_public_read on public.vehicle_details;
create policy vehicle_public_read on public.vehicle_details
  for select using (true);

drop policy if exists rides_passenger_own on public.rides;
create policy rides_passenger_own on public.rides
  for select using (passenger_id = auth.uid());

drop policy if exists rides_passenger_insert on public.rides;
create policy rides_passenger_insert on public.rides
  for insert with check (passenger_id = auth.uid());

drop policy if exists rides_passenger_update on public.rides;
create policy rides_passenger_update on public.rides
  for update using (passenger_id = auth.uid());

drop policy if exists rides_driver_open_or_assigned on public.rides;
create policy rides_driver_open_or_assigned on public.rides
  for select using (status = 'bidding' or driver_id = auth.uid());

drop policy if exists bids_passenger_sees_all_for_own_ride on public.bids;
create policy bids_passenger_sees_all_for_own_ride on public.bids
  for select using (
    exists (
      select 1 from public.rides r
      where r.id = bids.ride_id and r.passenger_id = auth.uid()
    )
  );

drop policy if exists bids_driver_own_only on public.bids;
create policy bids_driver_own_only on public.bids
  for select using (driver_id = auth.uid());

drop policy if exists bids_driver_insert_own on public.bids;
create policy bids_driver_insert_own on public.bids
  for insert with check (
    driver_id = auth.uid()
    and exists (
      select 1 from public.rides r
      where r.id = ride_id and r.status = 'bidding' and r.expires_at > now()
    )
  );

drop policy if exists bids_driver_update_own_pending on public.bids;
create policy bids_driver_update_own_pending on public.bids
  for update using (driver_id = auth.uid() and status = 'pending')
  with check (driver_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone',
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'passenger')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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

grant execute on function public.accept_bid(uuid) to authenticated;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

do $$ begin
  alter publication supabase_realtime add table public.rides;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.bids;
exception when duplicate_object then null;
end $$;
