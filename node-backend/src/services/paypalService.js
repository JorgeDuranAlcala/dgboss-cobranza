const db = require('../config/db');
const { default: axios } = require('axios');

const PAYPAL_API_URL = (process.env.PAYPAL_API_URL || 'https://api.sandbox.paypal.com').replace(/\/v1\/?$/, '');
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

async function getAccessToken() {
  const response = await axios.post(PAYPAL_API_URL + '/v1/oauth2/token', {
    grant_type: 'client_credentials'
  }, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(PAYPAL_CLIENT_ID + ':' + PAYPAL_CLIENT_SECRET).toString('base64')
    }
  });
  return response.data.access_token;
}

async function createOrder(monto_usd, return_url, cancel_url) {
  const token = await getAccessToken();
  const payload = {
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: 'USD',
        value: monto_usd
      }
    }],
    application_context: {
      return_url: return_url,
      cancel_url: cancel_url
    }
  };
  console.log('Creating PayPal Order with payload:', JSON.stringify(payload, null, 2));

  try {
    const order = await axios.post(PAYPAL_API_URL + '/v2/checkout/orders', payload, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    });
    console.log('PayPal Order Created:', JSON.stringify(order.data, null, 2));
    return order.data;
  } catch (error) {
    console.error('Error creating PayPal order:', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function captureOrder(order_id) {
  const token = await getAccessToken();
  console.log(`Capturing PayPal Order: ${order_id}`);

  try {
    const response = await axios.post(PAYPAL_API_URL + `/v2/checkout/orders/${order_id}/capture`, {}, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    });
    console.log('PayPal Order Captured:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error capturing PayPal order:', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function registrarRecarga({ empresa_rif, paypal_txn_id, monto_usd }) {
  const mensajes_asignados = Math.round(Number(monto_usd) * 10);
  // Idempotencia: si ya existe la transacción, no volver a registrar
  const [exists] = await db.execute(
    `SELECT 1 FROM recargas_paypal WHERE paypal_txn_id = ? LIMIT 1`,
    [paypal_txn_id]
  );
  if (exists.length) {
    return { ok: true, mensajes_asignados, duplicated: true };
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO recargas_paypal (empresa_rif, paypal_txn_id, monto_usd, mensajes_asignados, estado)
       VALUES (?, ?, ?, ?, 'completado')`,
      [empresa_rif, paypal_txn_id, monto_usd, mensajes_asignados]
    );

    // Sumar saldo de mensajes (crea fila si no existe)
    await conn.execute(
      `INSERT INTO empresa_mensajes (empresa_rif, mensajes_disponibles, actualizado_en)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE mensajes_disponibles = mensajes_disponibles + VALUES(mensajes_disponibles), actualizado_en = NOW()`,
      [empresa_rif, mensajes_asignados]
    );

    await conn.execute(
      `INSERT INTO log_mensajes (empresa_rif, tipo, cantidad, referencia)
       VALUES (?, 'recarga', ?, ?)`,
      [empresa_rif, mensajes_asignados, paypal_txn_id]
    );

    await conn.commit();
    return { ok: true, mensajes_asignados };
  } catch (err) {
    try { await conn.rollback(); } catch (_) { }
    throw err;
  } finally {
    conn.release();
  }
}

async function obtenerHistorial(empresa_rif) {
  const [rows] = await db.execute(
    `SELECT fecha_recarga, monto_usd, mensajes_asignados, estado, paypal_txn_id
     FROM recargas_paypal
     WHERE empresa_rif = ?
     ORDER BY fecha_recarga DESC`,
    [empresa_rif]
  );
  return rows.map(r => ({
    fecha: r.fecha_recarga,
    monto: Number(r.monto_usd),
    mensajes: Number(r.mensajes_asignados),
    estado: r.estado,
    transaccion: r.paypal_txn_id,
  }));
}

async function obtenerSaldo(empresa_rif) {
  const [rows] = await db.execute(
    `SELECT mensajes_disponibles FROM empresa_mensajes WHERE empresa_rif = ?`,
    [empresa_rif]
  );
  const mensajes = rows.length ? Number(rows[0].mensajes_disponibles) : 0;
  return { empresa_rif, mensajes_disponibles: mensajes };
}

module.exports = {
  registrarRecarga,
  obtenerHistorial,
  obtenerSaldo,
  createOrder,
  captureOrder
};
