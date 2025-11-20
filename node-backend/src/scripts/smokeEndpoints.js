/*
  Smoke tests para endpoints clave del backend.
  Uso:
    node src/scripts/smokeEndpoints.js

  Variables opcionales (.env o entorno):
    PORT                 -> puerto del backend (por defecto 3250)
    BASE_URL             -> URL base completa (si se define, se ignora PORT)
    TEST_CEDRIF          -> cedrif para probar renovaciones
    TEST_NOMBRE          -> nombre para probar renovaciones
    TEST_WHATSAPP_TO     -> número whatsapp 58XXXXXXXXXX para probar Twilio
    TEST_PAYMENT_LINK    -> URL de pago para Twilio
*/

require('dotenv').config();
const axios = require('axios');

// Base URL: prioriza BASE_URL, luego PORT; por defecto 3001 (estándar del workspace)
const BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;

async function run() {
  console.log(`\n=== Smoke tests contra ${BASE} ===`);

  // 1) Dashboard
  try {
    const { data } = await axios.get(`${BASE}/api/dashboard`);
    console.log('[OK] GET /api/dashboard');
    console.log('     totales:', data?.data?.totales || data);
  } catch (err) {
    console.error('[FAIL] GET /api/dashboard ->', err.response?.status, err.message);
  }

  // 2) Renovaciones por cliente (sin RCV)
  try {
    const params = new URLSearchParams();
    if (process.env.TEST_CEDRIF) params.append('cedrif', process.env.TEST_CEDRIF);
    if (!process.env.TEST_CEDRIF && process.env.TEST_NOMBRE) params.append('nombre', process.env.TEST_NOMBRE);
    params.append('limit', '5');

    if ([...params.keys()].length === 1) {
      // solo tiene limit -> fuerza 400 esperado
      try {
        await axios.get(`${BASE}/api/renovaciones/cliente?${params.toString()}`);
        console.log('[WARN] GET /api/renovaciones/cliente sin filtros no devolvió 400');
      } catch (err) {
        if (err.response?.status === 400) console.log('[OK] Validación 400 en /renovaciones/cliente sin filtros');
        else console.error('[FAIL] /renovaciones/cliente ->', err.response?.status, err.message);
      }
    } else {
      const { data } = await axios.get(`${BASE}/api/renovaciones/cliente?${params.toString()}`);
      console.log(`[OK] GET /api/renovaciones/cliente -> total: ${data.total}`);
    }
  } catch (err) {
    console.error('[FAIL] GET /api/renovaciones/cliente ->', err.response?.status, err.message);
  }

  // 3) Twilio enviar link de pago (validación 400)
  try {
    // Primero probamos validación (falta link)
    await axios.post(`${BASE}/api/whatsapp/link-pago`, { to: '580000000000' });
    console.log('[WARN] POST /api/whatsapp/link-pago sin link no devolvió 400');
  } catch (err) {
    if (err.response?.status === 400) console.log('[OK] Validación 400 en /whatsapp/link-pago (falta link)');
    else console.error('[FAIL] /whatsapp/link-pago validación ->', err.response?.status, err.message);
  }

  // Envío real opcional
  if (process.env.TEST_WHATSAPP_TO && process.env.TEST_PAYMENT_LINK) {
    try {
      const { data } = await axios.post(`${BASE}/api/whatsapp/link-pago`, {
        to: process.env.TEST_WHATSAPP_TO,
        link: process.env.TEST_PAYMENT_LINK,
        message: 'Prueba de link de pago',
      });
      console.log('[OK] POST /api/whatsapp/link-pago real ->', data);
    } catch (err) {
      console.error('[INFO] /whatsapp/link-pago real falló (normal si Twilio no está configurado):', err.response?.status, err.message);
    }
  } else {
    console.log('[INFO] Prueba real Twilio omitida (define TEST_WHATSAPP_TO y TEST_PAYMENT_LINK en .env si deseas probar).');
  }

  console.log('\n=== Smoke tests finalizados ===');
}

run().catch((e) => {
  console.error('Smoke tests abortados:', e.message);
  process.exit(1);
});
