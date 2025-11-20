require('dotenv').config();
const sgMail = require('@sendgrid/mail');
const EnlaceService = require('./enlacesService'); // Asegúrate de que la ruta sea correcta
const { URL } = require('url');
// 1. Configurar la clave de API de SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// 2. Definir el email del remitente (debe estar verificado en SendGrid)
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'default@tudominio.com';

class TwilioEmailService {

    static async sendEmailWithTracking(to, subject, text, html, polizaId, creadoPorId) {
        let nuevoEnlace;
        
        if (!polizaId || !creadoPorId) {
            throw new Error('polizaId y creadoPorId son requeridos para el tracking.');
        }

        try {
            // =============================================================
            // PASO 1: CREAR TOKEN CON EXPIRACIÓN DE 1 HORA E INSERTAR EN DB
            // =============================================================
            // La función crearEnlace contiene la lógica de DB INSERT
            nuevoEnlace = await EnlaceService.crearEnlace(polizaId, creadoPorId);
            const token = nuevoEnlace.token;
            

            // 💡 Definir Custom Args con el ID del registro de tu DB
            const customArgs = {
                // Usamos el ID de la tabla de enlaces para el rastreo
                id_rastreo_enlace: String(nuevoEnlace.id) 
                // Convertimos a string por si el ID es un número, ya que custom_args suele requerir strings.
            };

            const msg = {
                to: to,
                from: SENDER_EMAIL,
                subject: subject,
                text: text, 
                html: html,
                custom_args: customArgs,
            };

            // =============================================================
            // PASO 2: ENVIAR EMAIL CON SENDGRID
            // =============================================================
            const [response] = await sgMail.send(msg);
            
            if (response.statusCode >= 200 && response.statusCode < 300) {
                // Envío aceptado por SendGrid
                
                // =============================================================
                // PASO 3: OBTENER Y ACTUALIZAR MESSAGE_ID EN DB
                // =============================================================
                const sg_message_id = response.headers['x-message-id'];
                
                if (sg_message_id) {
                    // La actualización es asíncrona, no bloquea el retorno
                    EnlaceService.actualizarMessageId(nuevoEnlace.id, sg_message_id); 
                }
                
                return { success: true, token: token, messageId: sg_message_id, id_registro_db: nuevoEnlace.id };
            } else {
                // El envío falló (ej: error 401 de límite excedido)
                console.error(`❌ SendGrid falló con estatus ${response.statusCode}`);
                // Aquí podrías agregar lógica para marcar el registro de DB (nuevoEnlace) como 'FALLIDO_ENVIO'
                throw new Error(`SendGrid falló con estatus ${response.statusCode}`);
            }

        } catch (error) {
            console.error('❌ Error en el proceso de tracking:', error.message);
            throw error;
        }
    }

    /**
     * Envía un correo electrónico simple o HTML.
     * @param {string} to - El destinatario del correo.
     * @param {string} subject - El asunto del correo.
     * @param {string} text - El cuerpo del correo en texto plano.
     * @param {string} [html=''] - El cuerpo del correo en formato HTML (opcional).
     */
    static async sendEmail(to, subject, text, html = '') {
        if (!to || !subject || !text) {
            throw new Error('Destinatario, asunto y cuerpo de texto son requeridos.');
        }
        
        const msg = {
            to: to,
            from: SENDER_EMAIL, // Email del remitente configurado y verificado
            subject: subject,
            text: text,
            html: html || `<strong>${text}</strong>`, // Usa el texto si no se proporciona HTML
        };

        try {
            // SendGrid devuelve una respuesta (ej: [response, body])
            
            const [response] = await sgMail.send(msg);
            console.log(response);
            
            if (response.statusCode >= 200 && response.statusCode < 300) {
                console.log(`✅ Email enviado a ${to}. Estatus: ${response.statusCode}`);
                return true;
            } else {
                console.error(`❌ Error al enviar email. Estatus: ${response.statusCode}`);
                // Aquí podrías agregar lógica para manejar errores específicos del cuerpo de la respuesta
                throw new Error(`SendGrid falló con estatus ${response.statusCode}`);
            }
        } catch (error) {
            console.error('❌ Error general al intentar enviar email con SendGrid:', error.message);
            // Twilio/SendGrid puede arrojar errores si la API Key es inválida o el formato es incorrecto
            throw error;
        }
    }

    /**
     * Envía un correo con adjuntos.
     * @param {string} to - El destinatario del correo.
     * @param {string} subject - El asunto del correo.
     * @param {string} text - El cuerpo del correo en texto plano.
     * @param {Array<Object>} attachments - Array de objetos con { content, filename, type, disposition }.
     */
    static async sendEmailWithAttachment(to, subject, text, attachments) {
        if (!to || !subject || !text || !attachments || attachments.length === 0) {
            throw new Error('Destinatario, asunto, texto y adjuntos son requeridos.');
        }

        const msg = {
            to: to,
            from: SENDER_EMAIL,
            subject: subject,
            text: text,
            attachments: attachments,
        };

        return await sgMail.send(msg);
    }
}

module.exports = TwilioEmailService;