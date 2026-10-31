alter table public.rides
  alter column origin_lat drop not null,
  alter column origin_lng drop not null,
  alter column dest_lat drop not null,
  alter column dest_lng drop not null;

alter table public.rides drop constraint if exists rides_origin_lat_range;
alter table public.rides add constraint rides_origin_lat_range
  check (origin_lat is null or (origin_lat >= -90 and origin_lat <= 90));

alter table public.rides drop constraint if exists rides_origin_lng_range;
alter table public.rides add constraint rides_origin_lng_range
  check (origin_lng is null or (origin_lng >= -180 and origin_lng <= 180));

alter table public.rides drop constraint if exists rides_dest_lat_range;
alter table public.rides add constraint rides_dest_lat_range
  check (dest_lat is null or (dest_lat >= -90 and dest_lat <= 90));

alter table public.rides drop constraint if exists rides_dest_lng_range;
alter table public.rides add constraint rides_dest_lng_range
  check (dest_lng is null or (dest_lng >= -180 and dest_lng <= 180));
