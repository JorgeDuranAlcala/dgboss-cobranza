const db = require('../config/db');

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
    try { await conn.rollback(); } catch (_) {}
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
};
