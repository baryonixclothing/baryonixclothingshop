require("dotenv").config();
const express = require("express");
const path = require("path");
const Stripe = require("stripe");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

const secretKey = process.env.STRIPE_SECRET_KEY;
const stripe = secretKey ? new Stripe(secretKey) : null;

const catalog = {
  1: { name: "Premium Cotton BARYONIX Tee", price: 2264 },
  2: { name: "Ultimate Training Hoodie", price: 3423 },
  3: { name: "Extreme Training Joggers", price: 2782 }
};

app.post("/create-checkout-session", async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: "Stripe is not configured. Add STRIPE_SECRET_KEY to .env." });
  }

  try {
    const cart = Array.isArray(req.body.cart) ? req.body.cart : [];
    if (!cart.length) return res.status(400).json({ error: "Your basket is empty." });

    const lineItems = [];
    let subtotal = 0;

    for (const item of cart) {
      const product = catalog[item.id];
      const quantity = Math.max(1, Math.min(99, Number(item.qty) || 1));
      if (!product) continue;

      subtotal += product.price * quantity;
      lineItems.push({
        quantity,
        price_data: {
          currency: "gbp",
          unit_amount: product.price,
          product_data: {
            name: product.name,
            description: `Size: ${item.size || "M"}`
          }
        }
      });
    }

    if (!lineItems.length) return res.status(400).json({ error: "No valid products in the basket." });

    if (subtotal < 7500) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: 500,
          product_data: { name: "Delivery" }
        }
      });
    }

    const origin = `${req.protocol}://${req.get("host")}`;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      shipping_address_collection: { allowed_countries: ["GB", "US", "CA", "AU"] },
      success_url: `${origin}/page2 index.html?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/page2 index.html?cancelled=1`,
      customer_email: req.body.email || undefined,
      metadata: {
        first_name: req.body.firstName || "",
        last_name: req.body.lastName || "",
        order_sizes: JSON.stringify(cart.map(item => ({ id: item.id, size: item.size || "M", qty: item.qty })))
      }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not create Stripe Checkout session." });
  }
});

app.listen(port, () => {
  console.log(`BARYONIX store running at http://localhost:${port}`);
});
