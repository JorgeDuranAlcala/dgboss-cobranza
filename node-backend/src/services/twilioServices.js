require('dotenv').config();
const client = require('../config/twilio');


const formatVenezuelanPhoneNumber = (rawNumber) => {
    // 1. Limpiar el número: eliminar espacios, guiones, paréntesis o cualquier otro caracter no numérico,
    //    excepto el '+', que puede estar al inicio.
    let cleanedNumber = String(rawNumber).replace(/[^\d+]/g, ''); // Ejemplo: '(424)2020134' -> '4242020134'

    // 2. Verificar si ya está en formato internacional (+58)
    if (cleanedNumber.startsWith('+58')) {
        return cleanedNumber;
    }

    // 3. Caso: Comienza con '04' (Ej: 04121234567)
    // Se elimina el '0' y se antepone '+58'.
    if (cleanedNumber.startsWith('04')) {
        // Elimina el '0' inicial y agrega '+58'
        return '+58' + cleanedNumber.substring(1); 
    }

    // 4. Caso: Si el número tiene 10 dígitos (Formato: 4121234567 o 4241234567)
    // Este caso cubre tu ejemplo '4242020134' y lo estandariza.
    if (cleanedNumber.length === 10) {
        // Simplemente agrega '+58'
        return '+58' + cleanedNumber; 
    }
    
    // Si no se pudo limpiar ni estandarizar (ej: número incompleto, o ya tiene código de país incorrecto)
    return cleanedNumber;
};

class TwilioService {
    static async sendText(to, message) {
        if (!to || !message) throw new Error('Número y mensaje son requeridos');
        to = formatVenezuelanPhoneNumber(to);
        return await client.messages.create({
            body: message,
            from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
            to: `whatsapp:${to}`
        });
    }

    // Enviar mensaje multimedia por WhatsApp (imagen, audio, PDF)
    static async sendMedia(to, mediaUrl, message = '') {
        if (!to || !mediaUrl) throw new Error('Número y URL del medio son requeridos');
        to = formatVenezuelanPhoneNumber(to);
        return await client.messages.create({
            body: message,
            from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
            to: `whatsapp:${to}`,
            mediaUrl: [mediaUrl]
        });
    }
}

module.exports= TwilioService;