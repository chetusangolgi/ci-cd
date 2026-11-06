const express = require('express');
const { calculateTotals } = require('./cart');

function createApp(database) {
  const app = express();
  const carts = database.collection('carts');
  app.use(express.json());

  app.use((req, res, next) => {
    const cartId = req.get('X-Cart-Id') || 'demo';
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(cartId)) {
      return res.status(400).json({ error: 'Invalid X-Cart-Id' });
    }
    req.cartId = cartId;
    next();
  });

  app.post('/cart/add', async (req, res) => {
    const { name, priceCents, quantity } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || name.length > 100 ||
        !Number.isSafeInteger(priceCents) || priceCents <= 0 || priceCents > 1e9 ||
        !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 100) {
      return res.status(400).json({ error: 'Provide name, positive priceCents, and positive quantity' });
    }
    const item = { name: name.trim(), priceCents, quantity };
    const cart = await carts.findOneAndUpdate(
      { _id: req.cartId },
      { $push: { items: item } },
      { upsert: true, returnDocument: 'after' }
    );
    res.status(201).json({ cartId: req.cartId, items: cart.items, subtotalCents: calculateTotals(cart.items).subtotalCents });
  });

  app.get('/cart', async (req, res) => {
    const cart = await carts.findOne({ _id: req.cartId });
    const items = cart?.items || [];
    res.json({ cartId: req.cartId, items, subtotalCents: calculateTotals(items).subtotalCents });
  });

  app.post('/checkout', async (req, res) => {
    const cart = await carts.findOneAndUpdate(
      { _id: req.cartId, 'items.0': { $exists: true } },
      { $set: { items: [] } },
      { returnDocument: 'before' }
    );
    if (!cart) return res.status(400).json({ error: 'Cart is empty' });
    res.json({ cartId: req.cartId, items: cart.items, ...calculateTotals(cart.items) });
  });

  return app;
}

module.exports = { createApp };
