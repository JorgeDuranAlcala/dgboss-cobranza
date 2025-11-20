const express = require('express');
const router = express.Router();
const { sendTextMessage, sendMediaMessage, sendPaymentLink, sendMassWhatsApp } = require('../controllers/twilioController');
const { sendMassEmail } = require('../controllers/twilioEmailController');

router.post('/test-email', sendMassEmail);

router.post('/test', sendTextMessage);
router.post('/media', sendMediaMessage);
router.post('/link-pago', sendPaymentLink);
router.post('/send-mass-wa', sendMassWhatsApp);

module.exports = router;
