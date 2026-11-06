const request = require('supertest');
const { MongoClient } = require('mongodb');
const { createApp } = require('../src/app');

let client;
let database;
let app;

beforeAll(async () => {
  client = new MongoClient(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017', {
    serverSelectionTimeoutMS: 5000
  });
  await client.connect();
  database = client.db(`cart_test_${Date.now()}_${process.pid}`);
  app = createApp(database);
});

afterAll(async () => {
  if (database) await database.dropDatabase();
  if (client) await client.close();
});

test('adds, views, and checks out a cart against MongoDB', async () => {
  const cartId = 'integration-cart';
  const added = await request(app).post('/cart/add').set('X-Cart-Id', cartId)
    .send({ name: 'Book', priceCents: 1000, quantity: 2 });
  expect(added.status).toBe(201);
  expect(added.body.subtotalCents).toBe(2000);

  const viewed = await request(app).get('/cart').set('X-Cart-Id', cartId);
  expect(viewed.status).toBe(200);
  expect(viewed.body.items).toEqual([{ name: 'Book', priceCents: 1000, quantity: 2 }]);

  const checkedOut = await request(app).post('/checkout').set('X-Cart-Id', cartId);
  expect(checkedOut.status).toBe(200);
  expect(checkedOut.body).toMatchObject({ subtotalCents: 2000, gstCents: 360, totalCents: 2360 });

  const empty = await request(app).get('/cart').set('X-Cart-Id', cartId);
  expect(empty.body.items).toEqual([]);
});

test('rejects invalid item prices', async () => {
  const response = await request(app).post('/cart/add').set('X-Cart-Id', 'invalid-cart')
    .send({ name: 'Book', priceCents: -1, quantity: 1 });
  expect(response.status).toBe(400);
});

test('returns an error when checking out an empty cart', async () => {
  const response = await request(app).post('/checkout').set('X-Cart-Id', 'empty-cart');
  expect(response.status).toBe(400);
  expect(response.body.error).toBe('Cart is empty');
});
