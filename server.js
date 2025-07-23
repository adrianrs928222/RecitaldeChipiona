import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bodyParser from 'body-parser';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors({ origin: 'https://adrianrs928222.github.io' }));
app.use(bodyParser.json());

// HTML success y cancel
app.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/success.html'));
});

app.get('/cancel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/cancel.html'));
});

// Crear sesión de checkout
app.post('/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Entrada Recital Flamenco - Chipiona',
              description: '6 de agosto, 21:00h',
            },
            unit_amount: 500,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'https://recitaldechipiona.onrender.com/success',
      cancel_url: 'https://recitaldechipiona.onrender.com/cancel',
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creando sesión:', error.message);
    res.status(500).json({ error: 'Error creando la sesión de pago' });
  }
});

// Webhook de Stripe
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    stripe.customers.retrieve(session.customer).then((customer) => {
      const email = customer.email;

      const doc = new PDFDocument();
      const filePath = path.join(__dirname, 'entrada.pdf');
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      doc.fontSize(20).text('Entrada Recital Flamenco', { align: 'center' });
      doc.moveDown();
      doc.fontSize(16).text(`🎤 Lugar: Chipiona`);
      doc.text(`📅 Fecha: 6 de agosto`);
      doc.text(`⏰ Hora: 21:00h`);
      doc.text(`🎟️ Comprador: ${email}`);
      doc.end();

      stream.on('finish', () => {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_FROM,
            pass: process.env.EMAIL_PASS,
          },
        });

        const mailOptions = {
          from: process.env.EMAIL_FROM,
          to: email,
          subject: 'Tu entrada para el Recital Flamenco 🎟️',
          text: 'Gracias por tu compra. Adjuntamos tu entrada en PDF.',
          attachments: [
            {
              filename: 'entrada.pdf',
              path: filePath,
            },
          ],
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Error al enviar email:', error);
          } else {
            console.log('Correo enviado:', info.response);
            fs.unlinkSync(filePath); // Borra el PDF temporal
          }
        });
      });
    });
  }

  res.send();
});

// Puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor funcionando en puerto ${PORT}`);
});