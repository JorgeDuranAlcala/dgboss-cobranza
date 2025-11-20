const https = require('https');
const querystring = require('querystring');
const paypalService = require('../services/paypalService');

// Toggle between live and sandbox if needed via env
const PAYPAL_VERIFY_URL = process.env.PAYPAL_IPN_URL || 'https://ipnpb.paypal.com/cgi-bin/webscr';

function verifyWithPayPal(payload) {
  const postData = 'cmd=_notify-validate&' + payload;

  return new Promise((resolve, reject) => {
    const url = new URL(PAYPAL_VERIFY_URL);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data.trim()));
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function ipnHandler(req, res) {
  try {
    const webhookEvent = req.body;

    console.log('paypal webhook headers', req.headers);
    console.log('paypal webhook body', req.body);
    
    // Verify webhook signature (you'll need to implement this)
    // const isValid = await verifyWebhookSignature(req);
    // if (!isValid) {
    //   console.error('Invalid webhook signature');
    //   return res.status(400).send('Invalid signature');
    // }

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

module.exports = {
  ipnHandler,
  getHistorial,
  getSaldo,
};
