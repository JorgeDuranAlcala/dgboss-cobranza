const db = require('../config/db');
const { sendWhatsAppMessage } = require('../utils/messangi');

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

async function getRecibosPorVencerByRif(rif) {
  const [rows] = await db.execute(
    `
    SELECT DISTINCT
      r.recibo_id,
      r.recibo_numero,
      r.recibo_fechadesde,
      r.recibo_fechahasta,
      r.recibo_monto,

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
      ne.fecha_envio,
      e.empresa_nombre AS empresa_nombre

    FROM recibo r
      LEFT JOIN tiporecibo tr ON tr.tiporecibo_id = r.recibo_tipo_id
      LEFT JOIN certificado c ON r.recibo_certificado_id = c.certificado_id
      LEFT JOIN poliza p ON c.certificado_poliza_id = p.poliza_id
      LEFT JOIN ramo ra ON p.poliza_ramo_cod = ra.ramo_cod
      LEFT JOIN lineanegocio lb ON p.poliza_line_id = lb.line_id
      LEFT JOIN aseguradora ag ON p.poliza_aseguradora_rif = ag.aseguradora_rif
      LEFT JOIN asegurado a ON a.asegurado_cedrif = p.poliza_tomador_cedirf
      LEFT JOIN asegurado a2 ON a2.asegurado_cedrif = c.certificado_asegurado_cedrif
      LEFT JOIN notificaciones_twilio ne ON r.recibo_id = ne.recibo_id
      LEFT JOIN empresa e ON p.poliza_empresa_rif = e.empresa_rif

    WHERE  
      r.recibo_estatus = 'Pendiente'
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
      AND p.poliza_empresa_rif = ?

    ORDER BY 
      STR_TO_DATE(
        CASE 
          WHEN INSTR(r.recibo_fechadesde, '/') > 0 THEN r.recibo_fechadesde
          ELSE REPLACE(r.recibo_fechadesde, '-', '/')
        END, '%d/%m/%Y'
      ) ASC
    `,
    [rif]
  );

  return rows.map(r => ({
    ...r,
    cliente_telefono: normalizarTelefono(r.cliente_telefono),
  }));
}

/**
 * Verifica si se puede volver a notificar un recibo.
 * Máx. 3 intentos y cada 5 días como mínimo.
 */
async function puedeNotificar(recibo_id) {
  const [rows] = await db.execute(
    `
    SELECT
      MAX(fecha_envio) AS ultima_fecha,
      MAX(intento) AS max_intento
    FROM notificaciones_twilio
    WHERE recibo_id = ? AND canal = 'whatsapp'
    `,
    [recibo_id]
  );

  const registro = rows[0];
  if (!registro) return true; // No hay registros → puede notificar

  // Si ya se intentó más de 5 veces, no se puede notificar
  if (registro.max_intento > 2) return false;

  // Si hay una fecha de último envío, comprobar los días transcurridos directamente en JS o SQL
  if (registro.ultima_fecha) {
    const [[{ dias_transcurridos }]] = await db.execute(
      `SELECT DATEDIFF(CURDATE(), DATE(?)) AS dias_transcurridos`,
      [registro.ultima_fecha]
    );
    return dias_transcurridos >= 5;
  }

  return true;
}

async function programarNotificacionesByRif(rif) {
  const recibos = await getRecibosPorVencerByRif(rif);
  let omitidos = 0;

  const listaPromises = recibos.map(async (r) => {
    const puedeEnviar = await puedeNotificar(r.recibo_id);
    if (!puedeEnviar) {
      omitidos++;
      return null;
    }

    const placeholders = {
        titular: r.cliente_nombre || "Cliente",
        poliza: r.poliza_numero || "N/A",
        aseguradora: r.aseguradora_nombre || "N/A",
        recibo: r.recibo_numero || "N/A",
        monto: r.recibo_monto || "N/A",
        vencimiento: r.recibo_fechadesde || "N/A",
        empresa: r.empresa_nombre || "N/A"
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

module.exports = {
    programarNotificacionesByRif
};