import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type RideRecord = {
  id: string;
  status: string;
  expires_at: string;
};

type RideWebhook = {
  type: 'INSERT' | 'UPDATE';
  table: string;
  schema: string;
  record: RideRecord;
};

type FirebaseAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

const encoder = new TextEncoder();

function base64Url(input: Uint8Array): string {
  let binary = '';
  input.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function encodeJson(value: unknown): string {
  return base64Url(encoder.encode(JSON.stringify(value)));
}

function privateKeyBytes(pem: string): Uint8Array {
  const contents = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const binary = atob(contents);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getFirebaseAccessToken(account: FirebaseAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encodeJson({ alg: 'RS256', typ: 'JWT' })}.${encodeJson({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned))
  );
  const assertion = `${unsigned}.${base64Url(signature)}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error(`Firebase OAuth failed with HTTP ${response.status}`);
  }
  const result = await response.json();
  if (typeof result.access_token !== 'string') {
    throw new Error('Firebase OAuth response did not contain an access token.');
  }
  return result.access_token;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown push delivery error';
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!webhookSecret || request.headers.get('x-vaimoto-push-secret') !== webhookSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: RideWebhook;
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON payload', { status: 400 });
  }
  if (
    payload.schema !== 'public'
    || payload.table !== 'rides'
    || !payload.record?.id
    || !['INSERT', 'UPDATE'].includes(payload.type)
  ) {
    return new Response('Unsupported webhook event', { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const accountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!supabaseUrl || !serviceRoleKey || !accountJson) {
    return new Response('Push service is not configured', { status: 500 });
  }

  let account: FirebaseAccount;
  try {
    account = JSON.parse(accountJson);
  } catch {
    return new Response('Invalid Firebase service account secret', { status: 500 });
  }

  const rideId = payload.record.id;
  const isNewRide = payload.type === 'INSERT' && payload.record.status === 'bidding';
  const isCancellation = payload.type === 'UPDATE' && payload.record.status === 'cancelled';
  if (!isNewRide && !isCancellation) return new Response('No push required', { status: 200 });

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (isNewRide) {
      if (Date.parse(payload.record.expires_at) <= Date.now()) {
        return new Response('Ride is already expired', { status: 200 });
      }

      const { data: rideState, error: rideError } = await supabase
        .from('rides')
        .select('status, expires_at')
        .eq('id', rideId)
        .maybeSingle();
      if (rideError) throw rideError;
      if (!rideState || rideState.status !== 'bidding' || Date.parse(rideState.expires_at) <= Date.now()) {
        return new Response('Ride is no longer available', { status: 200 });
      }

      const [{ data: drivers, error: driverError }, { data: bids, error: bidError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id')
          .eq('role', 'driver')
          .eq('is_online', true)
          .eq('driver_approval_status', 'approved'),
        supabase.from('bids').select('driver_id').eq('ride_id', rideId),
      ]);
      if (driverError) throw driverError;
      if (bidError) throw bidError;

      const driversWithBids = new Set((bids ?? []).map((bid) => bid.driver_id));
      const eligibleDriverIds = (drivers ?? [])
        .map((driver) => driver.id)
        .filter((driverId) => !driversWithBids.has(driverId));
      if (eligibleDriverIds.length === 0) return new Response('No eligible drivers', { status: 200 });

      const { data: tokens, error: tokenError } = await supabase
        .from('driver_push_tokens')
        .select('driver_id, token')
        .in('driver_id', eligibleDriverIds);
      if (tokenError) throw tokenError;
      if (!tokens?.length) return new Response('No registered driver devices', { status: 200 });

      const targetRows = tokens.map((token) => ({
        ride_id: rideId,
        driver_id: token.driver_id,
        token: token.token,
      }));
      const { error: targetError } = await supabase
        .from('ride_push_targets')
        .upsert(targetRows, { onConflict: 'ride_id,token', ignoreDuplicates: true });
      if (targetError) throw targetError;
    }

    const { data: targets, error: targetReadError } = await supabase
      .from('ride_push_targets')
      .select('driver_id, token, request_sent_at, cancel_sent_at')
      .eq('ride_id', rideId);
    if (targetReadError) throw targetReadError;

    const accessToken = await getFirebaseAccessToken(account);
    const claimColumn = isNewRide ? 'request_claimed_at' : 'cancel_claimed_at';
    const sentColumn = isNewRide ? 'request_sent_at' : 'cancel_sent_at';
    const errorColumn = isNewRide ? 'request_error' : 'cancel_error';
    const retryBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const pendingTargets = (targets ?? [])
      .filter((target) => !target[sentColumn])
      .filter((target) => !target[claimColumn] || Date.parse(target[claimColumn]) < Date.parse(retryBefore));
    const claims = await Promise.all(pendingTargets.map(async (target) => {
      const { data, error } = await supabase
        .from('ride_push_targets')
        .update({ [claimColumn]: new Date().toISOString() })
        .eq('ride_id', rideId)
        .eq('token', target.token)
        .is(sentColumn, null)
        .or(`${claimColumn}.is.null,${claimColumn}.lt.${retryBefore}`)
        .select('driver_id, token')
        .maybeSingle();
      if (error) throw error;
      return data;
    }));
    const claimedTargets = claims.filter((target) => target !== null);
    if (claimedTargets.length === 0) {
      return new Response('All target notifications already processed or claimed', { status: 200 });
    }

    const results = await Promise.all(claimedTargets.map(async (device) => {
      const isCancel = isCancellation;
      try {
        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`,
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${accessToken}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              message: {
                token: device.token,
                notification: {
                  title: isCancel ? 'Corrida cancelada' : 'Nova solicitação de corrida',
                  body: isCancel
                    ? 'O passageiro cancelou esta solicitação.'
                    : 'Há uma nova corrida disponível. Toque para ver os detalhes.',
                },
                android: {
                  priority: 'HIGH',
                  notification: {
                    channel_id: 'rides',
                    tag: `ride-${rideId}`,
                    sound: 'default',
                  },
                },
                data: {
                  ride_id: rideId,
                  action: isCancel ? 'cancelled' : 'new_ride',
                },
              },
            }),
          }
        );
        if (!response.ok) throw new Error(`FCM returned HTTP ${response.status}`);

        const { error: updateError } = await supabase
          .from('ride_push_targets')
          .update({
            [claimColumn]: null,
            [sentColumn]: new Date().toISOString(),
            [errorColumn]: null,
          })
          .eq('ride_id', rideId)
          .eq('token', device.token);
        if (updateError) throw updateError;
        return null;
      } catch (error) {
        const { error: updateError } = await supabase
          .from('ride_push_targets')
          .update({
            [claimColumn]: null,
            [errorColumn]: getErrorMessage(error).slice(0, 500),
          })
          .eq('ride_id', rideId)
          .eq('token', device.token);
        if (updateError) console.error('Could not store push delivery error:', updateError.message);
        return `${device.driver_id}: ${getErrorMessage(error)}`;
      }
    }));

    const failures = results.filter((result): result is string => result !== null);
    if (failures.length > 0) {
      console.error('Push delivery failures:', failures);
      return new Response(JSON.stringify({ sent: results.length - failures.length, failed: failures.length }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ sent: results.length }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    console.error('Ride push webhook failed:', getErrorMessage(error));
    return new Response('Push processing failed', { status: 500 });
  }
});
