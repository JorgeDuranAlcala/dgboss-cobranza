const express = require('express');
const cors = require('cors');
const twilioRoutes = require('./routes/twilioRoutes');
const reciboRoutes = require('./routes/recibosRoutes');
const paypalRoutes = require('./routes/paypalRoutes');
const pool = require('./config/db');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/whatsapp', twilioRoutes);
app.use('/api/recibos', reciboRoutes);
// Mount PayPal routes: includes POST /paypal/ipn, GET /api/recargas/:empresa_rif, GET /api/saldo/:empresa_rif
app.use('/f', paypalRoutes);

app.get('/', (req, res) => {
  res.send('API VENTASS');
});

const PORT = process.env.PORT || 3250;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

pool.getConnection()
  .then(connection => {
    console.log('¡Conexión exitosa a la base de datos MySQL!');
    connection.release();
  })
  .catch(err => {
    console.error('Error al conectar a la base de datos MySQL:', err.message);
    console.warn('El servidor seguirá ejecutándose, pero las métricas/consultas devolverán 0 o listas vacías hasta que la BD esté disponible.');
  });
