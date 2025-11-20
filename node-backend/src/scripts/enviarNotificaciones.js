// scripts/enviarNotificaciones.js

const path = require('path');

// Ajusta la ruta según tu estructura. Por ejemplo, si el archivo está en /services/
const { enviarNotificaciones } = require(path.join(__dirname, '../services/reciboService'));

(async () => {
  console.log('⏰ [CRON] Iniciando envío automático de notificaciones:', new Date().toISOString());
  try {
    const resultado = await enviarNotificaciones();
    console.log('✅ [CRON] Proceso completado:', resultado);
  } catch (error) {
    console.error('❌ [CRON] Error durante el envío automático:', error);
  } finally {
    console.log('🏁 [CRON] Finalizado:', new Date().toISOString());
    process.exit(0);
  }
})();
