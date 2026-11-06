const { MongoClient } = require('mongodb');
const { createApp } = require('./app');

async function main() {
  const client = new MongoClient(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017');
  await client.connect();
  const app = createApp(client.db(process.env.MONGO_DB || 'shopping_cart'));
  app.listen(process.env.PORT || 3000, () => console.log('Shopping cart API listening'));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
