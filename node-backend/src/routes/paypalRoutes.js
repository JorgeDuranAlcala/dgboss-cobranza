const express = require('express');
const router = express.Router();
const paypalController = require('../controllers/paypalController');

// IPN requires urlencoded body
router.post('/paypal/ipn', (req, res) => {
    console.log('OK', req.body);
    res.send('OK')
});
/* router.get('/paypal/ipn', (req, res) => {
    console.log('OK');
    res.send('OK')
}); */

// APIs
router.get('/api/recargas/:empresa_rif', paypalController.getHistorial);
router.get('/api/saldo/:empresa_rif', paypalController.getSaldo);

module.exports = router;
