# VaiMoto

Urban mobility app for motorcycle taxis and deliveries. Single integrated client: the interface switches by user role (`passenger` | `driver`).

## Stack

- React 18 + TypeScript + Vite
- Ionic React + Capacitor Android
- Tailwind CSS (no preflight, Ionic tokens remain the source of truth)
- Supabase client ready (Auth, Postgres, Realtime)

## Folder structure

```
src/
  App.tsx
  main.tsx
  types/
  theme/
  data/
  services/          # supabase, auth, rides
  contexts/          # AuthContext
  hooks/
  layouts/           # PassengerTabs, DriverTabs
  components/
    shared/
    passenger/
    driver/
  pages/
    LoginPage.tsx
    passenger/
    driver/
```

## Scripts

```bash
npm install
npm run dev
npm run build
npx cap add android
npx cap sync android
```

## Capacitor Android precautions

1. Declare location permissions in `android/app/src/main/AndroidManifest.xml`:
   `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, and `FOREGROUND_SERVICE_LOCATION` if tracking continues in background.
2. Request runtime permission with `@capacitor/geolocation` before any map/radar call. Android 12+ will block silent GPS access.
3. Keep `webDir` as `dist`, run `npm run build` then `npx cap sync` after every web change. Set `android:usesCleartextTraffic="false"` and HTTPS-only Supabase URLs.

Configure keys in `.env` from `.env.example` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

## Supabase ride tracking and chat

After applying `supabase/schema.sql` to a new Supabase project, run migrations in
`supabase/migrations/` in filename order. For an existing project, run
`supabase/migrations/20261031_ride_tracking_and_chat.sql` once in **Supabase
Dashboard → SQL Editor → New query**. It adds persistent ride messages, secure
participant-only message policies, the ride status transition RPC, the ride
payment method, and optional motorcycle color without deleting existing data.

For driver earnings, history, reviews, and approval, execute
`supabase/migrations/20261101_driver_earnings_reviews_approval.sql` after the ride
tracking migration. The Developer account is identified by its Supabase Auth
user UUID; seed that trusted account in the SQL Editor after the migration:

```sql
insert into public.driver_approval_admins (user_id)
values ('<AUTH_USER_UUID>')
on conflict (user_id) do nothing;
```

Replace `<AUTH_USER_UUID>` with the account UUID from **Supabase Dashboard →
Authentication → Users**. Do not grant the role based on an email supplied by
the app. The approval screen only exposes pending driver profiles through
protected RPCs. Unapproved drivers cannot see open requests or submit offers,
and the app keeps them out of the radar. The migration also creates reviews
with participant-only RLS and records `completed_at`; legacy completed rides
without a completion timestamp are assigned their request time as a best
available historical date. Earnings show the recorded final ride fares (gross);
the current database has no commission/fee ledger to calculate net payouts.

After those migrations, execute
`supabase/migrations/20261102_chat_unread_messages.sql` in the same SQL Editor.
It adds `read_at` to the existing `ride_messages` table, an unread-message
index, and recipient-only permission to mark incoming messages read. No second
chat table is created. The app counts unread messages from the authenticated
user's own rides and refreshes the count on Realtime, reconnection, and resume.
Messages are marked read only after the user opens that ride's chat and its
message history loads.

The driver radar uses the supplied `src/notificacao/som_corrida.wav` (8-second
PCM WAV) for new, available Supabase rides while the approved driver is online
and the app is in the foreground. The first interaction with the online control
prepares audio playback to comply with browser autoplay restrictions. A pending
request can repeat its alert at most every 30 seconds; responding, going
offline, or leaving the foreground stops further alerts. This repository does
not play that sound while the app is backgrounded or closed.

## Driver push notifications (Android)

Push notifications use the Capacitor Push Notifications plugin and Firebase
Cloud Messaging (FCM). Apply
`supabase/migrations/20261103_driver_push_notifications.sql` in the Supabase
SQL Editor after the migrations above. It adds device-token storage protected
by driver-only RLS and a server-only delivery ledger; it does not replace the
existing ride/chat tables.

Configure Firebase and Supabase before testing on a physical Android device:

1. In Firebase, register an Android app with package ID `com.vaimotos.app`,
   enable Cloud Messaging, and download `google-services.json` to
   `android/app/google-services.json`. Do not commit this file.
2. Create/deploy the Edge Function with the Supabase CLI:
   `supabase functions deploy send-ride-push`. The included
   `supabase/config.toml` disables Supabase JWT verification for this endpoint;
   the function instead requires a private webhook header.
3. In **Supabase Dashboard → Edge Functions → Secrets**, set
   `FIREBASE_SERVICE_ACCOUNT` to the complete Firebase service-account JSON
   and `PUSH_WEBHOOK_SECRET` to a long random secret. Never put either value in
   the app, SQL migration, or repository.
4. In **Supabase Dashboard → Database → Webhooks**, create two `rides` webhooks
   pointing to
   `https://<PROJECT_REF>.supabase.co/functions/v1/send-ride-push`. Add the
   header `x-vaimoto-push-secret` with the same `PUSH_WEBHOOK_SECRET` value.
   Configure one for `INSERT` (the function only sends for `bidding` rides)
   and the other for `UPDATE` (the function only sends for `cancelled` rides).
   The cancellation webhook should include the new row. Repeated updates are
   safe: each delivered device/ride/event is tracked in
   `ride_push_targets`.
5. Rebuild and install the Android app so the plugin, manifest permission, and
   Firebase configuration are included:
   `npm run build`, `npx cap sync android`, then build/install from Android
   Studio. The Android 13+ notification permission prompt appears when a
   driver explicitly taps **Ficar online**. If permission is denied, the driver
   remains offline and is directed to Android settings.

The function sends a high-priority FCM notification only to registered devices
belonging to approved, online drivers who have not offered on that ride. Clicking
it opens the matching radar request after it is loaded from Supabase. A
cancellation is sent with the same Android notification tag, replacing that
ride's request alert; if the app is active, it also removes the delivered alert
locally. Android does not expose a server API to silently retract an already
delivered notification while the app is force-stopped, so the cancellation
notification replaces the request rather than disappearing without explanation.
Force-stop, disabled Android notifications, device connectivity, and battery
restrictions can delay delivery; an Android device and valid Firebase/Supabase
configuration are required to verify background delivery.

## Passenger place search

The passenger map uses Nominatim/OpenStreetMap with a Matões-area-first search,
accent-insensitive matching, common place-category variants, and a broader
nearby-area fallback. The green primary color is `#15D164`; the seven-digit
value `#15D1646` is not valid CSS hex.

Local landmarks and aliases are maintained in `src/data/localPlaces.ts`.
Coordinates there must come from a verified field survey, an authoritative
source, or an exact OpenStreetMap feature. Do not copy the town map center as a
business address. The current “Centro de Matões” entry is only the existing
approximate map-center reference; no Posto Monalisa coordinates were found in
the public Nominatim results, so that business is not assigned invented
coordinates. Add it to the local list only after its location is verified.
