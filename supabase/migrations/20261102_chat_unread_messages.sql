alter table public.ride_messages
  add column if not exists read_at timestamptz;

create index if not exists ride_messages_unread_by_ride_idx
  on public.ride_messages (ride_id, sender_id)
  where read_at is null;

drop policy if exists ride_messages_recipient_mark_read on public.ride_messages;
create policy ride_messages_recipient_mark_read on public.ride_messages
  for update to authenticated
  using (
    sender_id <> auth.uid()
    and exists (
      select 1
      from public.rides r
      where r.id = ride_messages.ride_id
        and (r.passenger_id = auth.uid() or r.driver_id = auth.uid())
    )
  )
  with check (
    sender_id <> auth.uid()
    and read_at is not null
    and exists (
      select 1
      from public.rides r
      where r.id = ride_messages.ride_id
        and (r.passenger_id = auth.uid() or r.driver_id = auth.uid())
    )
  );

grant update (read_at) on public.ride_messages to authenticated;

create or replace function public.unread_ride_message_count()
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)
  from public.ride_messages m
  where m.sender_id <> auth.uid()
    and m.read_at is null
    and exists (
      select 1
      from public.rides r
      where r.id = m.ride_id
        and (r.passenger_id = auth.uid() or r.driver_id = auth.uid())
    );
$$;

revoke all on function public.unread_ride_message_count() from public;
grant execute on function public.unread_ride_message_count() to authenticated;

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
