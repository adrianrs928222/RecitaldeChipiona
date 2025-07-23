import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 👉 Página de éxito
app.get('/success', (req, res) => {
  res.send('<h1>✅ Pago exitoso. Te hemos enviado tu entrada por email.</h1>');
});

// 👉 Página de cancelación
app.get('/cancel', (req, res) => {
  res.send('<h1>❌ Pago cancelado.</h1>');
});

// 👉 Checkout
app.post('/create-checkout-session', async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: {
          name: 'Entrada Recital Flamenco – Chipiona',
        },
        unit_amount: 100, // 1€
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${process.env.DOMAIN}/success`,
    cancel_url: `${process.env.DOMAIN}/cancel`,
    customer_email: req.body.email,
    metadata: {
      evento: 'Recital Flamenco – Chipiona',
    }
  });

  res.json({ id: session.id });
});

// 👉 Webhook de Stripe
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('⚠️ Error en webhook', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_email;
    enviarEntradaPDF(email);
  }

  res.json({ received: true });
});

// 👉 Envío del PDF por correo
function enviarEntradaPDF(email) {
  const doc = new PDFDocument();
  const filePath = path.join(__dirname, 'entrada.pdf');
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  doc.image(path.join(__dirname, 'public/img/escudo.jpg'), 220, 50, { width: 150 });
  doc.fontSize(20).text('Entrada Oficial', { align: 'center', underline: true });
  doc.moveDown();
  doc.fontSize(16).text('🎶 Recital Flamenco – Chipiona', { align: 'center' });
  doc.moveDown();
  doc.text('📅 Fecha: 6 de agosto · 21:00 h', { align: 'center' });
  doc.text('📍 Lugar: CEIP Maestro Manuel Aparcero', { align: 'center' });
  doc.moveDown();
  doc.fontSize(18).text('🎟️ Entrada: 1€', { align: 'center', bold: true });
  doc.moveDown();
  doc.fontSize(14).text('Organiza: C.D. Chipiona F.S · Ayuntamiento de Chipiona', { align: 'center' });
  doc.moveDown();
  doc.fontSize(14).fillColor('green').text('✅ Gracias por tu compra', { align: 'center' });
  doc.end();

  stream.on('finish', () => {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: `"Recital Flamenco" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🎫 Tu entrada para el Recital Flamenco',
      text: 'Gracias por tu compra. Adjuntamos tu entrada en PDF.',
      attachments: [{
        filename: 'entrada.pdf',
        path: filePath,
      }],
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) return console.error('❌ Error al enviar email:', error);
      console.log('✅ Entrada enviada a:', email);
    });
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));