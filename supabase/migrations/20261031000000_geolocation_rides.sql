-- Geolocalizacao das corridas.
-- Os campos origin_lat/origin_lng/dest_lat/dest_lng ja existem em public.rides (double precision);
-- eles sao reutilizados. Esta migration e incremental e nao apaga dados.

-- Corridas antigas podem nao ter coordenadas reais: permite NULL.
alter table public.rides alter column origin_lat drop not null;
alter table public.rides alter column origin_lng drop not null;
alter table public.rides alter column dest_lat drop not null;
alter table public.rides alter column dest_lng drop not null;

-- Validacao de faixa (NOT VALID: nao reprova linhas antigas; vale para novas/alteradas).
do $$ begin
  alter table public.rides add constraint rides_origin_lat_range check (origin_lat is null or origin_lat between -90 and 90) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.rides add constraint rides_origin_lng_range check (origin_lng is null or origin_lng between -180 and 180) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.rides add constraint rides_dest_lat_range check (dest_lat is null or dest_lat between -90 and 90) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.rides add constraint rides_dest_lng_range check (dest_lng is null or dest_lng between -180 and 180) not valid;
exception when duplicate_object then null; end $$;

-- RLS continua ativo. O passageiro so altera a propria corrida e nao pode
-- transferi-la para outro usuario (WITH CHECK).
alter table public.rides enable row level security;

drop policy if exists rides_passenger_update on public.rides;
create policy rides_passenger_update on public.rides
  for update using (passenger_id = auth.uid())
  with check (passenger_id = auth.uid());

-- Motoristas continuam lendo apenas corridas abertas (leilao) ou atribuidas a eles
-- (policy rides_driver_open_or_assigned). Corridas encerradas/canceladas deixam de expor
-- a localizacao a terceiros.
