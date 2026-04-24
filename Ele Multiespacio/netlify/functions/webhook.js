const { MercadoPagoConfig, Payment } = require('mercadopago');
const { Resend } = require('resend');
const QRCode = require('qrcode');

exports.handler = async (event, context) => {
  // Solo POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { type, data } = JSON.parse(event.body);

    // Solo nos interesan las notificaciones de pago
    if (type !== 'payment') {
      return { statusCode: 200, body: 'Ignored' };
    }

    // Inicializamos APIs con variables de entorno
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const payment = new Payment(client);
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Obtenemos los detalles reales del pago en MP
    const paymentData = await payment.get({ id: data.id });

    // Si el pago fue aprobado, generamos y enviamos los QR
    if (paymentData.status === 'approved') {
      const metadata = paymentData.metadata || {};
      const buyerEmail = metadata.buyer_email || paymentData.payer.email;
      const buyerName = metadata.buyer_name || 'Invitado';

      // Creamos la lista de items comprados
      const itemsHtml = paymentData.additional_info.items.map(i => `<li>${i.quantity}x ${i.title}</li>`).join('');

      // Generamos un QR de seguridad
      const qrData = `ELE-${paymentData.id}-${buyerName}`;
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, { width: 300, color: { dark: '#000000', light: '#ffffff' } });

      // Enviamos el email usando Resend
      await resend.emails.send({
        from: 'ELE Multiespacio <entradas@tu-dominio.com>', // Se debe configurar el dominio en Resend
        to: buyerEmail,
        subject: '¡Tus entradas para ELE Multiespacio están listas! 🎉',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #D4AF37;">¡Hola ${buyerName}!</h2>
            <p>Tu pago ha sido confirmado exitosamente. Aquí tienes el detalle de tu compra:</p>
            <ul>${itemsHtml}</ul>
            <div style="text-align: center; margin: 30px 0;">
              <p><strong>ESTE ES TU CÓDIGO DE INGRESO:</strong></p>
              <img src="${qrCodeDataUrl}" alt="QR Code" style="width: 250px; height: 250px; border: 5px solid #000; border-radius: 10px;" />
              <p style="font-size: 12px; color: #666;">ID de Pago: ${paymentData.id}</p>
            </div>
            <p><strong>Importante:</strong></p>
            <ul>
              <li>Lleva tu DNI. Evento exclusivo para mayores de 18 años.</li>
              <li>Presenta este código QR en la puerta desde tu celular.</li>
            </ul>
            <p>¡Nos vemos el viernes!</p>
          </div>
        `
      });

      console.log(`Email enviado con éxito a ${buyerEmail}`);
    }

    return { statusCode: 200, body: 'OK' };

  } catch (error) {
    console.error('Error en Webhook:', error);
    return { statusCode: 500, body: 'Error' };
  }
};
