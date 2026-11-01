alter table public.profiles
  add column if not exists driver_approval_status text;

update public.profiles p
set driver_approval_status = case
  when p.role <> 'driver' then null
  when v.status = 'active' then 'approved'
  when v.status = 'rejected' then 'rejected'
  else 'pending'
end
from (select p2.id, vd.status from public.profiles p2
  left join public.vehicle_details vd on vd.driver_id = p2.id) v
where p.id = v.id
  and (p.driver_approval_status is null or p.driver_approval_status not in ('pending', 'approved', 'rejected'));

alter table public.rides
  add column if not exists completed_at timestamptz;

update public.rides
set completed_at = created_at
where status = 'completed' and completed_at is null;

create index if not exists rides_driver_completed_at_idx
  on public.rides (driver_id, completed_at desc)
  where status = 'completed';

alter table public.profiles
  alter column driver_approval_status set default null;

do $$ begin
  alter table public.profiles
    add constraint profiles_driver_approval_status_check
    check (
      (role = 'driver' and driver_approval_status is not null and driver_approval_status in ('pending', 'approved', 'rejected'))
      or (role <> 'driver' and driver_approval_status is null)
    );
exception when duplicate_object then null;
end $$;

create table if not exists public.driver_approval_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.driver_approval_admins enable row level security;
revoke all on public.driver_approval_admins from public, anon, authenticated;

create or replace function public.is_driver_approval_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.driver_approval_admins a
      where a.user_id = auth.uid()
    );
$$;

revoke all on function public.is_driver_approval_admin() from public;
grant execute on function public.is_driver_approval_admin() to authenticated;

create or replace function public.guard_profile_driver_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin boolean := public.is_driver_approval_admin();
begin
  if tg_op = 'INSERT' then
    if new.role = 'driver' then
      new.driver_approval_status := 'pending';
      new.is_online := false;
    else
      new.driver_approval_status := null;
    end if;
    return new;
  end if;

  if auth.uid() = old.id and not v_admin then
    new.role := old.role;
    new.rating := old.rating;
    new.driver_approval_status := old.driver_approval_status;
    if new.role = 'driver' and new.driver_approval_status <> 'approved' then
      new.is_online := false;
    end if;
  elsif new.role = 'driver' then
    if new.driver_approval_status is null then
      new.driver_approval_status := 'pending';
    end if;
    if new.driver_approval_status <> 'approved' then
      new.is_online := false;
    end if;
  else
    new.driver_approval_status := null;
    new.is_online := false;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_driver_approval on public.profiles;
create trigger profiles_guard_driver_approval
  before insert or update on public.profiles
  for each row execute function public.guard_profile_driver_approval();

create table if not exists public.ride_reviews (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewed_user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(btrim(comment)) <= 1000),
  created_at timestamptz not null default now(),
  constraint ride_reviews_one_per_reviewer unique (ride_id, reviewer_id),
  constraint ride_reviews_not_self check (reviewer_id <> reviewed_user_id)
);

create index if not exists ride_reviews_reviewed_user_idx
  on public.ride_reviews (reviewed_user_id, created_at desc);
create index if not exists ride_reviews_ride_idx
  on public.ride_reviews (ride_id, created_at);

alter table public.ride_reviews enable row level security;
drop policy if exists ride_reviews_participant_read on public.ride_reviews;
create policy ride_reviews_participant_read on public.ride_reviews
  for select to authenticated
  using (
    exists (
      select 1 from public.rides r
      where r.id = ride_reviews.ride_id
        and (r.passenger_id = auth.uid() or r.driver_id = auth.uid())
    )
  );

drop policy if exists ride_reviews_participant_insert on public.ride_reviews;
create policy ride_reviews_participant_insert on public.ride_reviews
  for insert to authenticated
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1 from public.rides r
      where r.id = ride_reviews.ride_id
        and r.status = 'completed'
        and (
          (r.passenger_id = auth.uid() and ride_reviews.reviewed_user_id = r.driver_id)
          or (r.driver_id = auth.uid() and ride_reviews.reviewed_user_id = r.passenger_id)
        )
    )
  );

revoke all on public.ride_reviews from anon, authenticated;
grant select, insert on public.ride_reviews to authenticated;

create or replace function public.update_profile_rating_from_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p
  set rating = (
    select round(avg(rr.rating)::numeric, 1)
    from public.ride_reviews rr
    where rr.reviewed_user_id = new.reviewed_user_id
  )
  where p.id = new.reviewed_user_id;
  return new;
end;
$$;

drop trigger if exists ride_reviews_update_profile_rating on public.ride_reviews;
create trigger ride_reviews_update_profile_rating
  after insert on public.ride_reviews
  for each row execute function public.update_profile_rating_from_review();

drop policy if exists bids_driver_insert_own on public.bids;
create policy bids_driver_insert_own on public.bids
  for insert to authenticated
  with check (
    driver_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'driver'
        and p.driver_approval_status = 'approved'
    )
    and exists (
      select 1 from public.rides r
      where r.id = ride_id and r.status = 'bidding' and r.expires_at > now()
    )
  );

drop policy if exists rides_driver_open_or_assigned on public.rides;
create policy rides_driver_open_or_assigned on public.rides
  for select to authenticated
  using (
    driver_id = auth.uid()
    or (
      status = 'bidding'
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role = 'driver'
          and p.driver_approval_status = 'approved'
      )
    )
  );

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
  if not exists (
    select 1 from public.profiles p
    where p.id = v_bid.driver_id
      and p.role = 'driver'
      and p.driver_approval_status = 'approved'
  ) then
    raise exception 'driver_not_approved';
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

create or replace function public.list_pending_driver_approvals()
returns table (
  id uuid,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz,
  plate text,
  vehicle_model text,
  vehicle_color text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_driver_approval_admin() then
    raise exception 'not_authorized';
  end if;
  return query
    select p.id, p.full_name, p.phone, p.avatar_url, p.created_at,
      v.plate, v.vehicle_model, v.color
    from public.profiles p
    left join public.vehicle_details v on v.driver_id = p.id
    where p.role = 'driver' and p.driver_approval_status = 'pending'
    order by p.created_at asc;
end;
$$;

create or replace function public.set_driver_approval(
  p_driver_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_driver_approval_admin() then
    raise exception 'not_authorized';
  end if;
  if p_status is null or p_status not in ('approved', 'rejected') then
    raise exception 'invalid_approval_status';
  end if;
  update public.profiles
  set driver_approval_status = p_status,
      is_online = false,
      updated_at = now()
  where id = p_driver_id and role = 'driver';
  if not found then
    raise exception 'driver_not_found';
  end if;
end;
$$;

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
    set status = p_next_status::public.ride_status,
        completed_at = case when p_next_status = 'completed' then now() else null end
    where id = p_ride_id
    returning * into v_ride;

  return v_ride;
end;
$$;

revoke all on function public.transition_ride(uuid, text) from public;
grant execute on function public.transition_ride(uuid, text) to authenticated;

revoke all on function public.list_pending_driver_approvals() from public;
revoke all on function public.set_driver_approval(uuid, text) from public;
grant execute on function public.list_pending_driver_approvals() to authenticated;
grant execute on function public.set_driver_approval(uuid, text) to authenticated;

create or replace function public.driver_earnings_summary()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_driver uuid := auth.uid();
  v_result jsonb;
  v_today timestamptz;
  v_week timestamptz;
  v_month timestamptz;
begin
  if v_driver is null or not exists (
    select 1 from public.profiles p
    where p.id = v_driver and p.role = 'driver'
  ) then
    raise exception 'not_authorized';
  end if;
  v_today := date_trunc('day', now() at time zone 'America/Fortaleza') at time zone 'America/Fortaleza';
  v_week := date_trunc('week', now() at time zone 'America/Fortaleza') at time zone 'America/Fortaleza';
  v_month := date_trunc('month', now() at time zone 'America/Fortaleza') at time zone 'America/Fortaleza';

  select jsonb_build_object(
    'today_amount', coalesce(sum(r.final_price) filter (where coalesce(r.completed_at, r.created_at) >= v_today), 0),
    'week_amount', coalesce(sum(r.final_price) filter (where coalesce(r.completed_at, r.created_at) >= v_week), 0),
    'month_amount', coalesce(sum(r.final_price) filter (where coalesce(r.completed_at, r.created_at) >= v_month), 0),
    'total_amount', coalesce(sum(r.final_price), 0),
    'today_rides', count(*) filter (where coalesce(r.completed_at, r.created_at) >= v_today),
    'week_rides', count(*) filter (where coalesce(r.completed_at, r.created_at) >= v_week),
    'month_rides', count(*) filter (where coalesce(r.completed_at, r.created_at) >= v_month),
    'total_rides', count(*),
    'average_amount', coalesce(avg(r.final_price), 0)
  )
  into v_result
  from public.rides r
  where r.driver_id = v_driver
    and r.status = 'completed'
    and r.final_price is not null;

  return v_result;
end;
$$;

revoke all on function public.driver_earnings_summary() from public;
grant execute on function public.driver_earnings_summary() to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'ride_reviews'
    ) then
      alter publication supabase_realtime add table public.ride_reviews;
    end if;
  end if;
end $$;
