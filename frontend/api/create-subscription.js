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

  const { hostId, redirectUrl } = req.body;

  if (!hostId) {
    return res.status(400).json({ error: 'Missing parameter: hostId is required' });
  }

  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!accessToken) {
      return res.status(500).json({ error: 'Platform payment gateway is not configured on the cloud server. Missing MERCADOPAGO_ACCESS_TOKEN.' });
    }

    const mpResponse = await fetch('https://api.mercadopago.com/v1/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [
          {
            title: 'Suscripción Mensual - FULBO Pro',
            quantity: 1,
            unit_price: 9999.00,
            currency_id: 'ARS'
          }
        ],
        back_urls: {
          success: redirectUrl || 'https://link.mercadopago.com.ar',
          failure: redirectUrl || 'https://link.mercadopago.com.ar',
          pending: redirectUrl || 'https://link.mercadopago.com.ar'
        },
        auto_return: 'approved',
        external_reference: `${hostId}:subscription`
      })
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('Mercado Pago Subscription Error:', mpData);
      return res.status(500).json({ error: 'Failed to create subscription preference in Mercado Pago', details: mpData });
    }

    return res.status(200).json({
      preferenceId: mpData.id,
      initPoint: mpData.init_point,
      sandboxInitPoint: mpData.sandbox_init_point
    });

  } catch (error) {
    console.error('Create Subscription error:', error);
    return res.status(500).json({ error: error.message });
  }
}
