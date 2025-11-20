const db = require('../config/db');
const { sendWhatsAppMessage } = require('../utils/messangi');

const EMPRESAS_PERMITIDAS = ['J-296269246', 'V-987654321'];
const PREFIJOS_VALIDOS = ['412', '414', '424', '416', '426'];

/**
 * Normaliza un número de teléfono venezolano a formato internacional 58XXXXXXXXXX
 */
function normalizarTelefono(raw) {
  if (!raw) return null;
  let t = String(raw).replace(/\D/g, '');

  if (t.startsWith('00')) t = t.replace(/^00+/, '');
  if (t.startsWith('58') && t.length > 12) t = t.slice(-12);
  if (t.length === 11 && t.startsWith('0')) t = '58' + t.slice(1);
  if (t.length === 10 && PREFIJOS_VALIDOS.includes(t.slice(0, 3))) t = '58' + t;

  if (t.length !== 12) return null;
  const pref = t.slice(2, 5);
  const cuerpo = t.slice(5);
  if (!PREFIJOS_VALIDOS.includes(pref) || cuerpo.length !== 7) return null;

  return t;
}

/**
 * Obtiene los recibos por vencer en los próximos 10 días.
 */
async function getRecibosPorVencer() {
  const [rows] = await db.execute(
    `
    SELECT DISTINCT
      r.recibo_id,
      r.recibo_numero,
      r.recibo_fechadesde,
      r.recibo_fechahasta,

      CASE 
        WHEN p.poliza_tipo = 'I' THEN a.asegurado_celular
        WHEN p.poliza_tipo = 'C' AND p.poliza_is_global = 'N' THEN a2.asegurado_celular
        ELSE a.asegurado_celular
      END AS cliente_telefono,

      CASE 
        WHEN p.poliza_tipo = 'I' THEN a.asegurado_nombre
        WHEN p.poliza_tipo = 'C' AND p.poliza_is_global = 'N' THEN a2.asegurado_nombre
        ELSE a.asegurado_nombre
      END AS cliente_nombre,

      r.recibo_estatus,

      ag.aseguradora_nombre AS aseguradora_nombre,
      p.poliza_numero AS poliza_numero,
      ra.ramo_descripcion AS ramo_descripcion,
      tr.tiporecibo_descripcion AS tipo,
      ne.intento,
      ne.fecha_envio

    FROM recibo r
      LEFT JOIN tiporecibo tr ON tr.tiporecibo_id = r.recibo_tipo_id
      LEFT JOIN certificado c ON r.recibo_certificado_id = c.certificado_id
      LEFT JOIN poliza p ON c.certificado_poliza_id = p.poliza_id
      LEFT JOIN ramo ra ON p.poliza_ramo_cod = ra.ramo_cod
      LEFT JOIN lineanegocio lb ON p.poliza_line_id = lb.line_id
      LEFT JOIN aseguradora ag ON p.poliza_aseguradora_rif = ag.aseguradora_rif
      LEFT JOIN asegurado a ON a.asegurado_cedrif = p.poliza_tomador_cedirf
      LEFT JOIN asegurado a2 ON a2.asegurado_cedrif = c.certificado_asegurado_cedrif
      LEFT JOIN notificaciones_enviadas ne ON r.recibo_id = ne.recibo_id

    WHERE  
      r.recibo_estatus = 'Pendiente'
      AND ra.ramo_cod != 'HCM'
      AND r.recibo_isvencido = 0
      AND r.recibo_fechadesde IS NOT NULL
      AND r.recibo_fechadesde != ''
      AND r.recibo_fechadesde NOT IN ('NaN/NaN/NaN', 'Invalid date')
      AND (
        (
          INSTR(r.recibo_fechadesde, '/') > 0 
          AND STR_TO_DATE(r.recibo_fechadesde, '%d/%m/%Y')
              BETWEEN DATE_SUB(CURDATE(), INTERVAL 5 DAY)
              AND DATE_ADD(CURDATE(), INTERVAL 15 DAY)
        )
        OR (
          INSTR(r.recibo_fechadesde, '-') > 0 
          AND STR_TO_DATE(r.recibo_fechadesde, '%d-%m-%Y')
              BETWEEN DATE_SUB(CURDATE(), INTERVAL 5 DAY)
              AND DATE_ADD(CURDATE(), INTERVAL 15 DAY)
        )
      )
      AND p.poliza_empresa_rif IN (?, ?)

    ORDER BY 
      STR_TO_DATE(
        CASE 
          WHEN INSTR(r.recibo_fechadesde, '/') > 0 THEN r.recibo_fechadesde
          ELSE REPLACE(r.recibo_fechadesde, '-', '/')
        END, '%d/%m/%Y'
      ) ASC
    `,
    EMPRESAS_PERMITIDAS
  );

  return rows.map(r => ({
    ...r,
    cliente_telefono: normalizarTelefono(r.cliente_telefono),
  }));
}


/**
 * Verifica si se puede volver a notificar un recibo.
 * Máx. 5 intentos y cada 3 días como mínimo.
 */
async function puedeNotificar(recibo_id) {
  const [rows] = await db.execute(
    `
    SELECT
      MAX(fecha_envio) AS ultima_fecha,
      MAX(intento) AS max_intento
    FROM notificaciones_enviadas
    WHERE recibo_id = ? AND canal = 'whatsapp'
    `,
    [recibo_id]
  );

  const registro = rows[0];
  if (!registro) return true; // No hay registros → puede notificar

  // Si ya se intentó más de 5 veces, no se puede notificar
  if (registro.max_intento > 4) return false;

  // Si hay una fecha de último envío, comprobar los días transcurridos directamente en JS o SQL
  if (registro.ultima_fecha) {
    const [[{ dias_transcurridos }]] = await db.execute(
      `SELECT DATEDIFF(CURDATE(), DATE(?)) AS dias_transcurridos`,
      [registro.ultima_fecha]
    );
    return dias_transcurridos >= 3;
  }

  return true;
}

/**
 * Registra o actualiza el intento de envío en la base de datos.
 */
async function registrarNotificacion({
  canal,
  recibo_id,
  cliente_nombre,
  estado_recibo,
  estado_envio,
  respuesta_api
}) {
  const [rows] = await db.execute(
    `
    SELECT intento 
    FROM notificaciones_enviadas 
    WHERE recibo_id = ? AND canal = ?
    `,
    [recibo_id, canal]
  );

  if (rows.length === 0) {
    await db.execute(
      `
      INSERT INTO notificaciones_enviadas (
        canal, recibo_id, cliente_nombre, fecha_envio,
        intento, estado_recibo, estado_envio, respuesta_api
      )
      VALUES (?, ?, ?, NOW(), ?, ?, ?, ?)
      `,
      [
        canal,
        recibo_id,
        cliente_nombre,
        1,
        estado_recibo,
        estado_envio,
        JSON.stringify(respuesta_api),
      ]
    );
  } else {
    const intentoActual = rows[0].intento || 0;
    await db.execute(
      `
      UPDATE notificaciones_enviadas
      SET fecha_envio = NOW(),
          intento = ?,
          estado_recibo = ?,
          estado_envio = ?,
          respuesta_api = ?
      WHERE recibo_id = ? AND canal = ?
      `,
      [
        intentoActual + 1,
        estado_recibo,
        estado_envio,
        JSON.stringify(respuesta_api),
        recibo_id,
        canal,
      ]
    );
  }
}

/**
 * Envía las notificaciones de WhatsApp a los clientes con recibos próximos a vencer.
 */
async function enviarNotificaciones() {
  const recibos = await getRecibosPorVencer();
  let enviados = 0;
  let omitidos = 0;

  for (const r of recibos) {
    if (!r.cliente_telefono) {
      omitidos++;
      continue;
    }

    const puedeEnviar = await puedeNotificar(r.recibo_id);
    if (!puedeEnviar) {
      omitidos++;
      continue;
    }

    const placeholders = {
      titular: r.cliente_nombre || 'Cliente',
      "tipo recibo": r.tipo ? `${r.tipo}` : "Sin tipo",
      ramo: r.ramo_descripcion || "N/A",
      poliza: r.poliza_numero || "N/A",
      aseguradora: r.aseguradora_nombre || "N/A", 
      desde: r.recibo_fechadesde || "N/A",
      hasta: r.recibo_fechahasta || "N/A"
    };

    try {
      const respuesta = await sendWhatsAppMessage(r.cliente_telefono, placeholders);
      const estado_envio = respuesta ? 'Enviado' : 'Fallido';

      await registrarNotificacion({
        canal: 'whatsapp',
        recibo_id: r.recibo_id,
        cliente_nombre: r.cliente_nombre || '',
        estado_recibo: r.recibo_estatus,
        estado_envio,
        respuesta_api: JSON.stringify(respuesta),
      });

      enviados++;
    } catch (error) {
      await registrarNotificacion({
        canal: 'whatsapp',
        recibo_id: r.recibo_id,
        cliente_nombre: r.cliente_nombre || '',
        estado_recibo: r.recibo_estatus,
        estado_envio: 'Fallido',
        respuesta_api: error.message,
      });
      omitidos++;
    }
  }

  console.log(`✅ Enviados: ${enviados}, ❌ Omitidos: ${omitidos}, 📋 Total: ${recibos.length}`);
  return { enviados, omitidos, total: recibos.length };
}

async function programarNotificaciones() {
  const recibos = await getRecibosPorVencer();
  let omitidos = 0;

  const listaPromises = recibos.map(async (r) => {
    const puedeEnviar = await puedeNotificar(r.recibo_id);
    if (!puedeEnviar) {
      omitidos++;
      return null;
    }

    const placeholders = {
      titular: r.cliente_nombre || "Cliente",
      "tipo recibo": r.tipo ? `${r.tipo}` : "Sin tipo",
      ramo: r.ramo_descripcion || "N/A",
      poliza: r.poliza_numero || "N/A",
      aseguradora: r.aseguradora_nombre || "N/A",
      desde: r.recibo_fechadesde || "N/A",
      hasta: r.recibo_fechahasta || "N/A"
    };

    return {
      recibo_id: r.recibo_id,
      cliente_nombre: r.cliente_nombre,
      cliente_telefono: r.cliente_telefono,
      poliza_numero: r.poliza_numero,
      recibo_numero: r.recibo_numero,
      aseguradora: r.aseguradora_nombre,
      fechaDesde: r.recibo_fechadesde,
      fechaHasta: r.recibo_fechahasta,
      estado: r.recibo_estatus,
      intento: r.intento,
      fechaEnvio: r.fecha_envio,
      placeholders
    };
  });

  const listaParaEnviar = (await Promise.all(listaPromises)).filter(Boolean);

  console.log(`📋 Recibos listos para enviar: ${listaParaEnviar.length}, ❌ Omitidos: ${omitidos}, Total: ${recibos.length}`);

  return {
    omitidos,
    total: recibos.length,
    data: listaParaEnviar,
  };
}

async function enviarNotificacionIndividual({ recibo_id, telefono, placeholders, estado_recibo }) {
  if (!telefono) throw new Error('No se proporcionó teléfono válido');
  const puedeEnviar = await puedeNotificar(recibo_id);
  if (!puedeEnviar) throw new Error('No se puede notificar aún');

  const respuesta = await sendWhatsAppMessage(telefono, placeholders);
  const estado_envio = respuesta ? 'Enviado' : 'Fallido';

  await registrarNotificacion({
    canal: 'whatsapp',
    recibo_id,
    cliente_nombre: placeholders.titular || '',
    estado_recibo,
    estado_envio,
    respuesta_api: JSON.stringify(respuesta),
  });

  return { recibo_id, estado_envio, respuesta };
}

// Exportar funciones con CommonJS
module.exports = {
  getRecibosPorVencer,
  enviarNotificaciones,
  programarNotificaciones,
  enviarNotificacionIndividual
};
