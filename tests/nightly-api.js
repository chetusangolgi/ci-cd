const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const baseUrl = process.env.STAGING_URL?.replace(/\/$/, '');
if (!baseUrl) throw new Error('STAGING_URL is required');
const headers = { 'Content-Type': 'application/json', 'X-Cart-Id': `nightly_${randomUUID()}` };

async function call(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const body = await response.json();
  assert.ok(response.ok, `${path}: HTTP ${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  const added = await call('/cart/add', {
    method: 'POST', body: JSON.stringify({ name: 'Nightly item', priceCents: 1000, quantity: 2 })
  });
  assert.equal(added.subtotalCents, 2000);
  const cart = await call('/cart');
  assert.equal(cart.items.length, 1);
  const checkout = await call('/checkout', { method: 'POST' });
  assert.equal(checkout.gstCents, 360);
  assert.equal(checkout.totalCents, 2360);
  assert.deepEqual((await call('/cart')).items, []);
  console.log('Staging API test passed');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
