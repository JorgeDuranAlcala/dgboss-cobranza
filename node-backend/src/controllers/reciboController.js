const { getRecibosPorVencer: obtenerRecibos, enviarNotificaciones, programarNotificaciones, enviarNotificacionIndividual} = require('../services/reciboService');
const { programarNotificacionesByRif} = require('../services/reciboTwilioService');

async function getRecibosPorVencer(req, res) {
  try {
    const recibos = await obtenerRecibos();
    return res.status(200).json({
      success: true,
      total: recibos.length,
      data: recibos,
    });
  } catch (error) {
    console.error('❌ Error al obtener recibos por vencer:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener los recibos por vencer',
      error: error.message,
    });
  }
}

async function notificarRecibos(req, res) {
  try {
    const resultado = await enviarNotificaciones();
    return res.status(200).json({
      success: true,
      message: 'Proceso de notificación completado',
      ...resultado,
    });
  } catch (error) {
    console.error('❌ Error al enviar notificaciones:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al enviar notificaciones',
      error: error.message,
    });
  }
}

async function getRecibosProgramados(req, res) {
  try {
    const resultado = await programarNotificaciones();
    return res.status(200).json({
      success: true,
      message: 'Proceso de notificación completado',
      ...resultado,
    });
  } catch (error) {
    console.error('❌ Error al enviar notificaciones:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al enviar notificaciones',
      error: error.message,
    });
  }
}

async function getRecibosProgramadosByRif(req, res) {
  if (!req.params.rif) {
    return res.status(400).json({
      success: false,
      message: 'El parámetro "rif" es obligatorio.',
    });
  }
  try {
    const { rif } = req.params;
    const resultado = await programarNotificacionesByRif(rif);
    return res.status(200).json({
      success: true,
      message: 'Proceso de notificación completado',
      ...resultado,
    });
  } catch (error) {
    console.error('❌ Error al enviar notificaciones:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al enviar notificaciones',
      error: error.message,
    });
  }
}
/**
 * Envía notificaciones WhatsApp de forma individual según payload del frontend
 * Payload: [{ recibo_id, telefono, placeholders }]
 */
async function enviarNotificacionesFrontend(req, res) {
  try {
    const recibos = req.body; // Array de recibos

    if (!Array.isArray(recibos) || recibos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se enviaron recibos. El array está vacío o es inválido.',
      });
    }

    // Procesar cada recibo de forma individual
    const resultados = await Promise.all(
      recibos.map(async (r) => {
        try {
          return await enviarNotificacionIndividual(r);
        } catch (error) {
          return {
            recibo_id: r.recibo_id,
            estado_envio: 'Fallido',
            error: error.message,
          };
        }
      })
    );

    return res.status(200).json({
      success: true,
      message: 'Notificaciones procesadas',
      data: resultados, // [{ recibo_id, estado_envio, error? }]
    });
  } catch (error) {
    console.error('❌ Error al enviar notificaciones desde frontend:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al procesar las notificaciones',
      error: error.message,
    });
  }
}

// Exportar funciones con CommonJS
module.exports = {
  getRecibosPorVencer,
  notificarRecibos, 
  getRecibosProgramados,
  enviarNotificacionesFrontend,
  getRecibosProgramadosByRif,
};
