import express from "express";
import Stripe from "stripe";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

app.post("/create-checkout-session", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Entrada Recital Flamenco – Chipiona",
            },
            unit_amount: 500, // 5€ en céntimos
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "https://adrianrs928222.github.io/flamenco/success.html",
      cancel_url: "https://adrianrs928222.github.io/flamenco/cancel.html",
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor en puerto", PORT));