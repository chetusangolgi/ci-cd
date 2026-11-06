function calculateTotals(items) {
  const subtotalCents = items.reduce(
    (sum, item) => sum + item.priceCents * item.quantity, 0
  );
  const gstCents = Math.round(subtotalCents * 0.18);
  return { subtotalCents, gstCents, totalCents: subtotalCents + gstCents };
}

module.exports = { calculateTotals };
