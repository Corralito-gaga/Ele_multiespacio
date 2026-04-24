const { MercadoPagoConfig, Preference } = require('mercadopago');

exports.handler = async (event, context) => {
  // Solo aceptamos peticiones POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Inicializamos Mercado Pago con el token que configuraremos en Netlify
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const preference = new Preference(client);

    // Parseamos los datos enviados desde el carrito
    const body = JSON.parse(event.body);
    const { buyer, items } = body;

    // Formateamos los items del carrito para Mercado Pago
    const mpItems = items.map(item => ({
      id: item.name.substring(0, 15), // Un ID corto
      title: item.name,
      quantity: Number(item.qty),
      unit_price: Number(item.price),
      currency_id: 'ARS'
    }));

    // Creamos la preferencia
    const result = await preference.create({
      body: {
        items: mpItems,
        payer: {
          name: buyer.name,
          email: buyer.email
        },
        back_urls: {
          success: process.env.URL || 'https://tu-sitio.netlify.app',
          failure: process.env.URL || 'https://tu-sitio.netlify.app',
          pending: process.env.URL || 'https://tu-sitio.netlify.app'
        },
        auto_return: 'approved',
        // Esto es CRÍTICO: Aquí es donde MP avisará cuando el pago se apruebe
        notification_url: `${process.env.URL}/.netlify/functions/webhook`,
        metadata: {
          buyer_email: buyer.email,
          buyer_name: buyer.name
        }
      }
    });

    // Devolvemos el link de pago al frontend
    return {
      statusCode: 200,
      body: JSON.stringify({
        id: result.id,
        init_point: result.init_point
      })
    };

  } catch (error) {
    console.error('Error al crear preferencia:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno del servidor al crear preferencia.' })
    };
  }
};
