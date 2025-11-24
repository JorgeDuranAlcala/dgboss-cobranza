const paypalService = require('../services/paypalService');
const { default: axios } = require('axios');

const PAYPAL_API_URL = (process.env.PAYPAL_API_URL || 'https://api.sandbox.paypal.com').replace(/\/v1\/?$/, '');

async function ipnHandler(req, res) {
  try {
    const webhookEvent = req.body;

    const isValid = await verifyWebhookSignature(req.headers, req.body);
    console.log('WEBHOOK IS: ', isValid || 'INVALID');

    if (!isValid) {
      console.error('Invalid webhook signature');
      return res.status(400).send('Invalid signature');
    }

    // Only process completed payment captures
    if (webhookEvent.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
      console.log(`Skipping non-payment event: ${webhookEvent.event_type}`);
      return res.status(200).send('SKIPPED - Not a payment capture event');
    }

    const payment = webhookEvent.resource;
    if (!payment) {
      return res.status(400).send('Missing payment resource');
    }

    const empresa_rif = payment.custom_id;
    const paypal_txn_id = payment.id;
    const monto_usd = parseFloat(payment.amount?.value || '0');

    if (!empresa_rif || !paypal_txn_id || !monto_usd) {
      console.error('Missing required fields:', { empresa_rif, paypal_txn_id, monto_usd });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`Processing payment: ${paypal_txn_id} for ${empresa_rif}, amount: ${monto_usd} USD`);

    await paypalService.registrarRecarga({ empresa_rif, paypal_txn_id, monto_usd });

    return res.status(200).send('OK');
  } catch (err) {
    console.error('Error IPN:', err.message);
    return res.status(500).send('ERROR');
  }
}

async function getHistorial(req, res) {
  try {
    const empresa_rif = req.params.empresa_rif;
    const data = await paypalService.obtenerHistorial(empresa_rif);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getSaldo(req, res) {
  try {
    const empresa_rif = req.params.empresa_rif;
    const data = await paypalService.obtenerSaldo(empresa_rif);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function verifyWebhookSignature(headers, body) {
  const token = await getAccessToken();
  const response = await axios.post(PAYPAL_API_URL + '/v1/notifications/verify-webhook-signature', {
    transmission_id: headers['paypal-transmission-id'],
    transmission_time: headers['paypal-transmission-time'],
    cert_url: headers['paypal-cert-url'],
    auth_algo: headers['paypal-auth-algo'],
    transmission_sig: headers['paypal-transmission-sig'],
    webhook_id: process.env.WEBHOOK_ID,
    webhook_event: body
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    }
  });
  console.log('Webhook signature verified:', response.data);
  return response.data.verification_status === 'SUCCESS';
}

async function getAccessToken() {
  console.log('Getting access token...');
  const response = await axios.post(PAYPAL_API_URL + '/v1/oauth2/token', {
    grant_type: 'client_credentials'
  }, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(process.env.PAYPAL_CLIENT_ID + ':' + process.env.PAYPAL_CLIENT_SECRET).toString('base64')
    }
  });
  return response.data.access_token;
}

async function createOrder(req, res) {
  try {
    const { monto, empresa_rif, return_url, cancel_url } = req.body;
    if (!monto || !empresa_rif) {
      return res.status(400).json({ error: 'Missing monto or empresa_rif' });
    }

    const order = await paypalService.createOrder(monto, return_url, cancel_url);

    const approvalLink = order.links.find(link => link.rel === 'approve');
    if (approvalLink) {
      res.json({ approvalUrl: approvalLink.href });
    } else {
      res.status(500).json({ error: 'No approval link found in PayPal response' });
    }
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: err.message });
  }
}

async function captureOrder(req, res) {
  try {
    const { token, empresa_rif } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Missing token' });
    }

    const captureData = await paypalService.captureOrder(token);

    if (captureData.status === 'COMPLETED') {
      const purchaseUnit = captureData.purchase_units[0];
      const capture = purchaseUnit.payments.captures[0];

      const monto_usd = capture.amount.value;

      console.log(`Registrando recarga: ID=${capture.id}, Monto=${monto_usd}`);

      const result = await paypalService.registrarRecarga({
        empresa_rif: empresa_rif || 'UNKNOWN',
        paypal_txn_id: capture.id,
        monto_usd: monto_usd
      });

      res.json({ status: 'COMPLETED', ...result });
    } else {
      console.warn('Capture status not COMPLETED:', captureData.status);
      res.json({ status: captureData.status });
    }
  } catch (err) {
    console.error('Error capturing order:', err);
    if (err.response) {
      // Axios error from PayPal
      const status = err.response.status;
      const data = err.response.data;

      let message = 'Error al procesar el pago con PayPal.';
      if (data.details && data.details.length > 0) {
        const issue = data.details[0].issue;
        if (issue === 'ORDER_NOT_APPROVED') {
          message = 'El pago no fue aprobado por el usuario. Por favor, intenta nuevamente.';
        } else {
          message = `Error de PayPal: ${issue}`;
        }
      }

      return res.status(status).json({ error: message, details: data });
    }
    res.status(500).json({ error: 'Error interno del servidor al capturar el pago.' });
  }
}

module.exports = {
  ipnHandler,
  getHistorial,
  getSaldo,
  getAccessToken,
  verifyWebhookSignature,
  createOrder,
  captureOrder
};
