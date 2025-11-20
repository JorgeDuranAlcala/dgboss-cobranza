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
  // Re-construir el payload desde req.body
  const payload = querystring.stringify(req.body || {});

  try {
/*     const verification = await verifyWithPayPal(payload);
    if (verification !== 'VERIFIED') {
      return res.status(200).send('IGNORED');
    }

    const status = req.body.payment_status;
    if (status !== 'Completed') {
      return res.status(200).send('SKIPPED');
    }

    const empresa_rif = req.body.custom_id || req.body.custom;
    const paypal_txn_id = req.body.txn_id;
    const monto_usd = parseFloat(req.body.mc_gross || '0');

    if (!empresa_rif || !paypal_txn_id || !monto_usd) {
      return res.status(400).json({ error: 'Campos obligatorios faltantes' });
    }

    await paypalService.registrarRecarga({ empresa_rif, paypal_txn_id, monto_usd });
    return res.status(200).send('OK'); 
    */
   console.log('RESPONSE: ',JSON.stringify({type: 'paypal-webhook', jsonbody: payload}));
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
