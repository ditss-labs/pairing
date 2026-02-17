const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI;
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

let client;
let clientPromise;

if (!process.env.MONGODB_URI) {
  throw new Error('❌ MONGODB_URI tidak ditemukan di environment variables!');
}

console.log('🔌 Menyambungkan ke MongoDB...');

// Di Vercel, kita perlu caching koneksi
if (process.env.NODE_ENV === 'development') {
  // In development, use a global variable
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect()
      .then(client => {
        console.log('✅ MongoDB connected (development)');
        return client;
      })
      .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        throw err;
      });
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production, it's best to not use a global variable
  client = new MongoClient(uri, options);
  clientPromise = client.connect()
    .then(client => {
      console.log('✅ MongoDB connected (production)');
      return client;
    })
    .catch(err => {
      console.error('❌ MongoDB connection error:', err);
      throw err;
    });
}

// Fungsi untuk mendapatkan database
async function getDatabase() {
  const client = await clientPromise;
  return client.db('pairing_bot'); // nama database
}

// Fungsi untuk mendapatkan koleksi pairing_requests
async function getPairingCollection() {
  const db = await getDatabase();
  return db.collection('pairing_requests');
}

// Fungsi untuk membuat request baru
async function createPairingRequest(phoneNumber) {
  const collection = await getPairingCollection();
  const result = await collection.insertOne({
    phoneNumber,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  return result;
}

// Fungsi untuk mendapatkan request by ID
async function getPairingRequest(id) {
  const collection = await getPairingCollection();
  return collection.findOne({ _id: new ObjectId(id) });
}

// Fungsi untuk update status dan pairing code
async function updatePairingRequest(id, data) {
  const collection = await getPairingCollection();
  return collection.updateOne(
    { _id: new ObjectId(id) },
    { 
      $set: {
        ...data,
        updatedAt: new Date()
      }
    }
  );
}

module.exports = { 
  getDatabase, 
  getPairingCollection,
  createPairingRequest,
  getPairingRequest,
  updatePairingRequest,
  ObjectId 
};
