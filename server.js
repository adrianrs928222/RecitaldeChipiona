import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import pdf from 'html-pdf';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// ✅ Stripe Checkout
app.post('/create-checkout-session', async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: {
          name: 'Entrada Recital Flamenco Chipiona',
        },
        unit_amount: 100, // 1 €
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: 'https://recitaldechipiona.onrender.com/success',
    cancel_url: 'https://recitaldechipiona.onrender.com/cancel',
  });
  res.json({ url: session.url });
});

// ✅ Ruta éxito
app.get('/success', (req, res) => {
  res.send('<h1 style="text-align:center;">✅ ¡Pago exitoso! Gracias por tu compra.</h1>');
});

// ✅ Ruta cancelado
app.get('/cancel', (req, res) => {
  res.send('<h1 style="text-align:center;">❌ Pago cancelado. Inténtalo de nuevo.</h1>');
});

// ✅ Webhook Stripe + PDF + Email
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  const sig = req.headers['stripe-signature'];
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log('⚠️ Error en la verificación del webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_details.email;

    const html = `
      <div style="font-family:sans-serif; padding:20px;">
        <img src="cid:logo" width="100" />
        <h2>🎫 Entrada Recital Flamenco</h2>
        <p><strong>Fecha:</strong> 6 de agosto de 2025</p>
        <p><strong>Hora:</strong> 21:00 h</p>
        <p><strong>Lugar:</strong> CEIP Maestro Manuel Aparcero</p>
        <p><strong>Organiza:</strong> C.D. Chipiona F.S</p>
        <p style="margin-top:20px; font-weight:bold;">¡Gracias por tu compra!</p>
      </div>
    `;

    const filePath = path.join(__dirname, 'entrada.pdf');
    pdf.create(html).toFile(filePath, async (err, resPDF) => {
      if (err) return console.log('❌ Error creando PDF:', err);

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: `"C.D. Chipiona F.S" <${process.env.EMAIL_USER}>`,
        to: customerEmail,
        subject: 'Tu entrada al Recital Flamenco',
        text: 'Gracias por tu compra. Adjuntamos tu entrada.',
        attachments: [
          {
            filename: 'entrada.pdf',
            path: resPDF.filename,
          },
          {
            filename: 'logo.jpg',
            path: path.join(__dirname, 'public', 'img', 'escudo.jpg'),
            cid: 'logo',
          },
        ],
      });

      fs.unlinkSync(resPDF.filename); // elimina el PDF temporal
    });
  }

  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () => {
  console.log('✅ Servidor funcionando');
});