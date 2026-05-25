import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseKey = supabaseServiceKey || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, type, data } = req.body;

  if (type !== 'payment' || !data || !data.id) {
    return res.status(200).json({ message: 'Event ignored' });
  }

  const paymentId = data.id;

  try {
    const sellerId = req.body.user_id;
    let accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (sellerId) {
      const { data: hostData, error: hostError } = await supabase
        .from('hosts')
        .select('mercadopago_access_token')
        .eq('mercadopago_user_id', String(sellerId))
        .limit(1);

      if (hostData && hostData.length > 0 && hostData[0].mercadopago_access_token) {
        accessToken = hostData[0].mercadopago_access_token;
      }
    }

    if (!accessToken) {
      console.warn(`No Access Token found for seller ID: ${sellerId}. Using default fallback.`);
    }

    const payResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const payment = await payResponse.json();

    if (!payResponse.ok) {
      console.error(`Failed to fetch payment ${paymentId} details:`, payment);
      return res.status(500).json({ error: 'Failed to fetch payment details' });
    }

    const { status, external_reference } = payment;

    if (status === 'approved' && external_reference) {
      const [hostId, playerId] = external_reference.split(':');

      if (hostId && playerId) {
        if (playerId === 'subscription') {
          // Process Host Platform Subscription payment
          const { error: hostError } = await supabase
            .from('hosts')
            .update({
              subscription_type: 'monthly',
              subscription_status: 'active',
              subscription_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            })
            .eq('id', hostId);

          if (hostError) {
            console.error('Failed to update host subscription status in database:', hostError);
            return res.status(500).json({ error: 'Database update failed' });
          }

          console.log(`Successfully activated subscription for Host: ${hostId}`);
          return res.status(200).json({ status: 'subscribed', hostId });
        }

        const { data: leagueState, error: fetchError } = await supabase
          .from('league_state')
          .select('roster')
          .eq('host_id', hostId);

        if (leagueState && leagueState.length > 0 && Array.isArray(leagueState[0].roster)) {
          const updatedRoster = leagueState[0].roster.map(player => {
            if (player.id === playerId || (player.id && player.id.toString() === playerId.toString())) {
              return {
                ...player,
                financial: {
                  ...player.financial,
                  debt: 0,
                  isBanned: false
                }
              };
            }
            return player;
          });

          const { error: updateError } = await supabase
            .from('league_state')
            .update({
              roster: updatedRoster,
              updated_at: new Date().toISOString()
            })
            .eq('host_id', hostId);

          if (updateError) {
            console.error('Failed to update league state roster:', updateError);
            return res.status(500).json({ error: 'Database update failed' });
          }

          console.log(`Successfully reconciled payment. Player ${playerId} debt set to 0.`);
          return res.status(200).json({ status: 'reconciled', playerId });
        } else {
          console.error(`League state or roster array not found for host: ${hostId}`);
          return res.status(404).json({ error: 'League state or roster not found' });
        }
      }
    }

    return res.status(200).json({ message: 'Payment not approved or external_reference missing', status });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: error.message });
  }
}
