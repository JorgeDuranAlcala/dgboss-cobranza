const crypto = require('crypto');

const store = new Map();
let autoId = 1;

async function crearEnlace(polizaId, creadoPorId) {
  if (!polizaId || !creadoPorId) {
    throw new Error('polizaId y creadoPorId son requeridos');
  }
  const token = crypto.randomBytes(24).toString('hex');
  const id = autoId++;
  const record = {
    id,
    poliza_id: polizaId,
    creado_por_id: creadoPorId,
    token,
    message_id: null,
    created_at: new Date().toISOString(),
  };
  store.set(id, record);
  return record;
}

async function actualizarMessageId(id, messageId) {
  const rec = store.get(id);
  if (rec) {
    rec.message_id = messageId;
    store.set(id, rec);
  }
  return true;
}

module.exports = {
  crearEnlace,
  actualizarMessageId,
};
