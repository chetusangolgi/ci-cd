const { calculateTotals } = require('../src/cart');

test('adds 18% GST using integer cents', () => {
  expect(calculateTotals([{ priceCents: 999, quantity: 2 }])).toEqual({
    subtotalCents: 1998,
    gstCents: 360,
    totalCents: 2358
  });
});

test('rounds fractional GST to the nearest cent', () => {
  expect(calculateTotals([{ priceCents: 3, quantity: 1 }]).gstCents).toBe(1);
});
