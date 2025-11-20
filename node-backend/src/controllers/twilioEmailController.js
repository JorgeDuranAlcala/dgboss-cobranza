// Asegúrate de que esta ruta sea correcta para tu servicio de correo (SendGrid)
const TwilioEmailService = require('../services/TwilioEmailService'); 

// ⚠️ NOTA: El cuerpo de la petición (req.body) debe contener un array de clientes.
// Ejemplo: [{ asegurado_email: 'correo@ejemplo.com', asegurado_nombre: 'Juan Perez', poliza_fechahasta: '2025-10-31', empresa_nombre: 'Mi Corredor' }, ...]

const sendMassEmail = async (req, res) => {
    // 1. Obtener parámetros de modo de envío (ej: /api/email/masivo?sinrcv=true)
    const { sinrcv, sinauto } = req.query; 

    const esSinRCV = sinrcv === 'true'; 
    const esSinAuto = sinauto === 'true';
    
    const clientes = req.body; 
    
    if (!Array.isArray(clientes) || clientes.length === 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Se requiere una lista de clientes no vacía.' 
        });
    }

    const resultados = [];
    const promesasEnvio = [];

    // 2. Función para definir el ASUNTO, TEXTO y HTML basado en la condición
    const getEmailContent = (cliente) => {
        const nombreCorredor = cliente.empresa_nombre || 'Tu Corredor';
        let subject = '';
        let textBody = '';
        let htmlBody = '';
        
        const enlaceTrackingPlaceholder = `{{LINK_TRACKING}}`;
        // --- Lógica de plantillas similar a WhatsApp ---

        if (esSinRCV) {
            const polizaId = cliente.poliza_id;
            const enlaceCotizacion = `https://demo.dgboss.online/#/renovacion?poliza_id=${polizaId}`; 
            
            subject = `${cliente.asegurado_nombre}, ya tienes carro... ahora solo falta tu RCV`;
            
            textBody = `Hola ${cliente.asegurado_nombre},\n\n` + 
                       `Notamos que ya cuentas con un vehículo asegurado, pero aún no tienes activa tu póliza RCV. Te ofrecemos una cotización personalizada y el proceso 100% en línea. Haz clic aquí: ${enlaceCotizacion}\n\n` +
                       `Saludos,\n${nombreCorredor}`;
                       
            // Se recomienda usar plantillas HTML reales para correos. Aquí solo usamos texto.
            htmlBody = `<p>Hola ${cliente.asegurado_nombre},</p>
                        <p>Notamos que ya cuentas con un vehículo asegurado, pero aún no tienes activa tu póliza RCV, que es la que te protege legalmente ante terceros y evita sanciones.</p>
                        <p>Como cliente registrado, queremos facilitarte todo el proceso:</p>
                        <p>✅ Cotización personalizada con Vértice Seguros</p>
                        <p>✅ Sin papeleo y 100% en línea</p>
                        <p>✅ Apoyo directo de tu corredor de confianza</p>
                        <p>✅ Compra en minutos desde tu celular</p>
                        <p>Solo haz clic aquí y obtén tu RCV hoy:</p>
                        <p><a href="${enlaceCotizacion}">${enlaceCotizacion}</a></p>
                        <p><strong>Tener carro sin RCV es un riesgo. Te damos la solución hoy mismo.</strong></p>
                        <p>Este mensaje ha sido enviado por ${nombreCorredor}, quien ya gestiona tu póliza actual y está aquí para ayudarte.</p>
                        <p>Saludos,<br>${nombreCorredor}</p>
                        <p><strong>${nombreCorredor}</strong></p>
                        <p>Corredor autorizado </p>`;
                       
        } else if (esSinAuto) {
            const enlaceCotizacionAbierta = `https://demo.dgboss.online/#/renovacion?poliza_id=${cliente.poliza_id || '0'}`; 
            
            subject = `${cliente.asegurado_nombre}, ¿tienes un carro o conoces a alguien que lo necesite?`;
            
            textBody = `Hola ${cliente.asegurado_nombre},\n\n` +
                       `Desde Vértice Seguros te damos acceso a una cotización rápida para el RCV obligatorio. Cotiza aquí en segundos: ${enlaceCotizacionAbierta}\n\n` +
                       `Saludos,\n${nombreCorredor}`;
                       
            htmlBody = `<p>Hola ${cliente.asegurado_nombre},</p>
                        <p>Sabemos que aún no tienes registrado un vehículo con nosotros, pero puede que tengas uno... o conozcas a alguien cercano que sí lo tenga.</p>
                        <p>Desde <strong>Vértice Seguros</strong> te damos acceso exclusivo a una <strong>cotización rápida y sin compromiso</strong> para obtener el RCV obligatorio de forma segura y con el respaldo de tu corredor de confianza.</p>
                        <p>✅ Todo el proceso es 100% digital</p>
                        <p>✅ Atención personalizada</p>
                        <p>✅ Compra en minutos desde tu celular</p>
                        <p>✅ Protección legal inmediata</p>
                        <p>Cotiza aquí en segundos:</p>
                        <p>👉 <a href="${enlaceCotizacionAbierta}">${enlaceCotizacionAbierta}</a></p>
                        <p>Este mensaje ha sido enviado por ${nombreCorredor}, quien estará para apoyarte en lo que necesites.</p>
                        <p><strong>Comparte esta oportunidad o úsala para ti. ¡Protegerse siempre vale la pena!</strong></p>
                        <p>Saludos,<br>${nombreCorredor}</p>
                        <p><strong>${nombreCorredor}</strong></p>`;
                       
        } else {
            // Plantilla de Recordatorio de Vencimiento (Default)
            const vencimiento = cliente.poliza_fechahasta || 'pronto';
            subject = `Recordatorio Importante: Tu Póliza Vence Pronto (${vencimiento})`;
            textBody = `Hola ${cliente.asegurado_nombre}, te recordamos que tu póliza vence el ${vencimiento} y debe ser renovada. Contáctanos.`;
            htmlBody = `<p>Hola <strong>${cliente.asegurado_nombre}</strong>, te recordamos que tu póliza vence el <strong>${vencimiento}</strong> y debe ser renovada.</p><p>Contáctanos para gestionarlo.</p>`;
        }
        
        return { subject, textBody, htmlBody };
    };

    // 3. Iterar sobre los clientes y preparar las promesas de envío
    for (const cliente of clientes) {
        const email = cliente.asegurado_email;
        
        // Excluir clientes sin correo electrónico
        if (!email) {
            resultados.push({
                nombre: cliente.asegurado_nombre,
                status: 'Error',
                message: 'Correo electrónico no proporcionado.',
            });
            continue;
        }

        const { subject, textBody, htmlBody } = getEmailContent(cliente);
        
        console.log(`[Modo: ${esSinAuto ? 'Sin Auto' : esSinRCV ? 'Sin RCV' : 'Vencimiento'}] Asunto para ${cliente.asegurado_nombre}: ${subject}`); 
        const polizaId = cliente.poliza_id || 0; 
        const creadoPorId = cliente.creado_por_id || 1;
        // Lanzar la promesa de envío
        // Usamos sendEmail(to, subject, text, html)
        const promesa = TwilioEmailService.sendEmailWithTracking(
        email, 
        subject, 
        textBody, 
        htmlBody,
        polizaId, 
        creadoPorId
        )   
            .then((resultado) => {
                // Éxito (SendGrid no devuelve un SID simple como Twilio Messages)
                resultados.push({
                    nombre: cliente.asegurado_nombre,
                    email: email,
                    status: 'Éxito',
                    message: 'Correo aceptado para envío.',
                    messageId: resultado.messageId, // <-- Registrar el Message ID
                    token: resultado.token,
                    id_registro_enlace: resultado.id_registro_db
                });
            })
            .catch(error => {
                // Fallo de SendGrid
                resultados.push({
                    nombre: cliente.asegurado_nombre,
                    email: email,
                    status: 'Error',
                    message: error.message,
                });
            });
            
        promesasEnvio.push(promesa);
    }
    
    // 4. Esperar a que todos los envíos terminen
    await Promise.allSettled(promesasEnvio); // Usamos allSettled para asegurar que todos los resultados se recolecten
    console.log(resultados);
    
    // 5. Devolver el resumen
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

module.exports = {
    sendMassEmail
};