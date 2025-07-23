import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

dotenv.config();
const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors({ origin: 'https://adrianrs928222.github.io' }));
app.use(express.json());

const DOMAIN = process.env.DOMAIN || 'https://recitaldechipiona.onrender.com';

// Ruta para crear la sesión de pago
app.post('/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Entrada Recital Flamenco – Chipiona',
          },
          unit_amount: 100, // 1 €
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${DOMAIN}/success`,
      cancel_url: `${DOMAIN}/cancel`,
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creando sesión de Stripe:', error);
    res.status(500).json({ error: 'Error al crear la sesión' });
  }
});

// Webhook de Stripe
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_details.email;

    // Crear PDF
    const doc = new PDFDocument();
    const pdfPath = `entrada-${session.id}.pdf`;
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Cabecera
    doc.image('img/escudo.jpg', { fit: [100, 100], align: 'center' });
    doc.fontSize(20).text('🎶 Recital Flamenco – Chipiona', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text('📍 CEIP Maestro Manuel Aparcero', { align: 'center' });
    doc.text('🗓️ 6 de agosto de 2025 – 21:00h', { align: 'center' });
    doc.moveDown();
    doc.text('🎟️ Entrada válida para 1 persona', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text('Gracias por tu compra', { align: 'center' });
    doc.end();

    // Esperar que se guarde el PDF y enviarlo
    stream.on('finish', async () => {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: `"Recital Flamenco Chipiona" <${process.env.EMAIL_USER}>`,
        to: customerEmail,
        subject: '🎟️ Tu entrada para el Recital Flamenco',
        text: 'Adjunto encontrarás tu entrada en formato PDF. ¡Nos vemos el 6 de agosto!',
        attachments: [{
          filename: 'entrada.pdf',
          path: pdfPath,
        }],
      });

      // Elimina el archivo temporal tras enviar
      fs.unlinkSync(pdfPath);
    });
  }

  res.status(200).json({ received: true });
});

app.get('/success', (req, res) => {
  res.send('✅ ¡Gracias por tu compra! Te hemos enviado la entrada por correo.');
});

app.get('/cancel', (req, res) => {
  res.send('❌ El pago fue cancelado. Inténtalo de nuevo cuando quieras.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});