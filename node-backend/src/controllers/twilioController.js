const TwilioService = require('../services/twilioServices');

const sendMassWhatsApp = async (req, res) => {

    const { sinrcv, sinauto } = req.query; 

    const esSinRCV = sinrcv === 'true'; 
    const esSinAuto = sinauto === 'true';
    // ⚠️ Asumimos que el cuerpo de la petición (req.body) es un array de clientes/pólizas.
    // Ejemplo de req.body: [{ asegurado_telefono: '4121234567', asegurado_nombre: 'Juan Perez', poliza_fechahasta: '2025-10-31' }, ...]
    const clientes = req.body; 
    
    if (!Array.isArray(clientes) || clientes.length === 0) {
        return res.status(400).json({ success: false, error: 'Se requiere una lista de clientes no vacía.' });
    }

    const resultados = [];
    const promesasEnvio = [];

    // 2. Definir la plantilla del mensaje basada en la condición 'sinrcv'
    const getMessageTemplate = (cliente) => {
        const nombreCorredor = cliente.empresa_nombre; 

        if (esSinRCV) {
            // ** PLANTILLA PARA CLIENTES SIN RCV (Basada en image_9f71c4.png) **
            const polizaId = cliente.poliza_id;
            const enlaceCotizacion = `demo.dgboss.online/#/renovacion?poliza_id=${polizaId}`; 
            
            return `Hola ${cliente.asegurado_nombre},
            Notamos que ya cuentas con un vehículo asegurado, pero *aún no tienes activa tu póliza RCV*, que es la que te protege legalmente ante terceros y evita sanciones.

            Como cliente registrado, queremos facilitarte todo el proceso:
            ✅ Cotización personalizada con Vértice Seguros
            ✅ Sin papeleo y 100% en línea
            ✅ Apoyo directo de tu corredor de confianza
            ✅ Compra en minutos desde tu celular

            Solo haz clic aquí y obtén tu RCV hoy:
            ${enlaceCotizacion}

            Este mensaje ha sido enviado por ${nombreCorredor}, quien ya gestiona tu póliza actual y está aquí para ayudarte.

            *Tener carro sin RCV es un riesgo. Te damos la solución hoy mismo.*

            Saludos,
            ${nombreCorredor}
            Corredor autorizado`;
            } else if (esSinAuto) {
            const polizaId = cliente.poliza_id;
            const enlaceCotizacionAbierta = `demo.dgboss.online/#/renovacion?poliza_id=${polizaId}`;  
            
            return `Hola ${cliente.asegurado_nombre},

            Sabemos que aún no tienes registrado un vehículo con nosotros, pero puede que tengas uno... o conozcas a alguien cercano que sí lo tenga.

            Desde *Vértice Seguros* te damos acceso exclusivo a una *cotización rápida y sin compromiso* para obtener el RCV obligatorio de forma segura y con el respaldo de tu corredor de confianza.

            ✅ Todo el proceso es 100% digital
            ✅ Atención personalizada
            ✅ Compra en minutos desde tu celular
            ✅ Protección legal inmediata

            Cotiza aquí en segundos:
            ${enlaceCotizacionAbierta}

            Este mensaje ha sido enviado por ${nombreCorredor}, quien estará para apoyarte en lo que necesites.

            *Comparte esta oportunidad o úsala para ti. ¡Protegerse siempre vale la pena!*

            Saludos,
            ${nombreCorredor}`;
            
        } else {
            // ** PLANTILLA DE RECORDATORIO DE VENCIMIENTO (Plantilla original) **
            const vencimiento = cliente.poliza_fechahasta || 'pronto';
            return `Hola ${cliente.asegurado_nombre}, te recordamos que tu póliza vence el ${vencimiento} y debe ser renovada. Contáctanos.`;
        }
    };

    // 1. Filtrar los clientes que tienen un número y preparar las promesas
    for (const cliente of clientes) {
        const telefono = cliente.asegurado_telefono;
        
        // Excluir clientes sin número de teléfono
        if (!telefono) {
            resultados.push({
                nombre: cliente.asegurado_nombre,
                status: 'Error',
                message: 'Teléfono no proporcionado.',
            });
            continue;
        }

        // Crear el mensaje de recordatorio
        const message = getMessageTemplate(cliente);
        console.log(`[Modo: ${esSinAuto ? 'Sin Auto' : esSinRCV ? 'Sin RCV' : 'Vencimiento'}] Mensaje para ${cliente.asegurado_nombre}: ${message.substring(0, 50)}...`);        
        // Lanzar la promesa de envío
        console.log(message);
        
        const promesa = TwilioService.sendText(telefono, message)
            .then(response => {
                // Éxito
                resultados.push({
                    nombre: cliente.asegurado_nombre,
                    telefono: telefono,
                    status: 'Éxito',
                    sid: response.sid,
                });
            })
            .catch(error => {
                // Fallo de Twilio (ej: formato inválido, número no registrado en WhatsApp)
                resultados.push({
                    nombre: cliente.asegurado_nombre,
                    telefono: telefono,
                    status: 'Error',
                    message: error.message,
                });
            });
            
        promesasEnvio.push(promesa);
    }
    
    // 2. Esperar a que todas las promesas se resuelvan (éxito o fallo)
    // Usamos Promise.allSettled si quieres esperar a todos y obtener todos los resultados,
    // o Promise.all para esperar solo los éxitos. Aquí usamos Promise.all para esperar la resolución de todas las promesas .then/.catch.
    await Promise.all(promesasEnvio);
    
    console.log(resultados);
    
    // 3. Devolver el resumen
    const exitos = resultados.filter(r => r.status === 'Éxito').length;
    const fallos = resultados.filter(r => r.status === 'Error').length;
    const modoEnvio = esSinAuto ? 'Sin Auto' : esSinRCV ? 'Sin RCV' : 'Vencimiento';

    res.status(200).json({ 
        success: true, 
        totalClientes: clientes.length,
        totalIntentados: promesasEnvio.length,
        exitos: exitos,
        fallos: fallos,
        modo: modoEnvio,
        detalles: resultados 
    });
};

const sendTextMessage = async (req, res) => {
    const { to, message } = req.body;

    if (!to || !message) {
        return res.status(400).json({ success: false, error: 'to y message son requeridos' });
    }

    try {
        const response = await TwilioService.sendText(to, message);
        res.status(200).json({ success: true, sid: response.sid });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const sendMediaMessage = async (req, res) => {
    const { to, message, mediaUrl } = req.body;

    if (!to || !mediaUrl) {
        return res.status(400).json({ success: false, error: 'to y mediaUrl son requeridos' });
    }

    try {
        const response = await TwilioService.sendMedia(to, mediaUrl, message);
        res.status(200).json({ success: true, sid: response.sid });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const sendPaymentLink = async (req, res) => {
    const { to, link, message } = req.body;
    if (!to || !link) {
        return res.status(400).json({ success: false, error: 'to y link son requeridos' });
    }
    const text = message || `Hola, te compartimos tu link de pago: ${link}`;
    try {
        const response = await TwilioService.sendText(to, text);
        res.status(200).json({ success: true, sid: response.sid });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = { sendTextMessage, sendMediaMessage, sendPaymentLink, sendMassWhatsApp };
