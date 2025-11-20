const express = require('express');
const router = express.Router();
const reciboController = require('../controllers/reciboController.js');
const { sendWhatsAppMessage } = require('../utils/messangi.js'); 

// Endpoint para obtener los recibos por vencer y validar que se este trayendo la información requerida
router.get('/', reciboController.getRecibosPorVencer);

router.get('/programados', reciboController.getRecibosProgramados);

router.get('/twilio/programados/:rif', reciboController.getRecibosProgramadosByRif);

// Endpoint para enviar notificaciones de recibos por vencer usando api Messangi  
router.post('/', reciboController.notificarRecibos);

router.post('/enviar-notificaciones', reciboController.enviarNotificacionesFrontend);

module.exports = router;
