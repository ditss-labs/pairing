require('dotenv').config();
const express = require('express');
const path = require('path');
const { 
  createPairingRequest, 
  getPairingRequest, 
  updatePairingRequest,
  ObjectId 
} = require('../lib/mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// Set view engine ke EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ==================== ROUTES ====================

// Halaman utama
app.get('/', (req, res) => {
  res.render('index', { 
    title: 'Pairing Bot WhatsApp',
    error: null,
    success: null 
  });
});

// Halaman waiting untuk cek status
app.get('/waiting/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validasi ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).send('ID tidak valid');
    }

    const request = await getPairingRequest(id);
    
    if (!request) {
      return res.status(404).send('Request tidak ditemukan');
    }

    res.render('waiting', { 
      title: 'Menunggu Kode Pairing',
      requestId: id,
      phoneNumber: request.phoneNumber,
      error: null 
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Terjadi kesalahan server');
  }
});

// ==================== API ROUTES ====================

// API: request pairing (simpan ke MongoDB)
app.post('/api/request-pairing', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    // Validasi nomor
    if (!phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nomor WhatsApp wajib diisi' 
      });
    }

    // Hapus semua karakter non-digit
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    // Validasi format (10-15 digit)
    if (!cleanNumber.match(/^\d{10,15}$/)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nomor WhatsApp tidak valid. Harus 10-15 digit angka' 
      });
    }

    // Cek apakah nomor sudah pernah request dan masih pending
    const collection = require('../lib/mongodb').getPairingCollection();
    const existing = await (await collection).findOne({
      phoneNumber: cleanNumber,
      status: 'pending'
    });

    if (existing) {
      return res.json({ 
        success: true, 
        requestId: existing._id.toString(),
        redirectUrl: `/waiting/${existing._id}`,
        message: 'Permintaan sudah ada, silakan tunggu'
      });
    }

    // Simpan ke MongoDB
    const result = await createPairingRequest(cleanNumber);

    res.json({ 
      success: true, 
      requestId: result.insertedId.toString(),
      redirectUrl: `/waiting/${result.insertedId}`
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Terjadi kesalahan server: ' + error.message 
    });
  }
});

// API: cek status pairing
app.get('/api/check-status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validasi ID
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID tidak valid' 
      });
    }
    
    const request = await getPairingRequest(id);

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        error: 'Request tidak ditemukan' 
      });
    }

    // Kirim status terbaru
    res.json({
      success: true,
      status: request.status,
      pairingCode: request.pairingCode || null,
      phoneNumber: request.phoneNumber,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Terjadi kesalahan server' 
    });
  }
});

// ==================== FORM SUBMISSION ====================

// Untuk form submission via POST biasa
app.post('/request-pairing', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.render('index', { 
        title: 'Pairing Bot WhatsApp',
        error: 'Nomor WhatsApp wajib diisi',
        success: null 
      });
    }

    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    if (!cleanNumber.match(/^\d{10,15}$/)) {
      return res.render('index', { 
        title: 'Pairing Bot WhatsApp',
        error: 'Nomor WhatsApp tidak valid. Harus 10-15 digit angka',
        success: null 
      });
    }

    // Cek existing
    const collection = require('../lib/mongodb').getPairingCollection();
    const existing = await (await collection).findOne({
      phoneNumber: cleanNumber,
      status: 'pending'
    });

    if (existing) {
      return res.redirect(`/waiting/${existing._id}`);
    }

    const result = await createPairingRequest(cleanNumber);
    res.redirect(`/waiting/${result.insertedId}`);

  } catch (error) {
    console.error('Error:', error);
    res.render('index', { 
      title: 'Pairing Bot WhatsApp',
      error: 'Terjadi kesalahan server: ' + error.message,
      success: null 
    });
  }
});

// ==================== TEST ROUTE ====================
app.get('/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server berjalan dengan baik',
    mongodb_uri: process.env.MONGODB_URI ? '✅ Terset' : '❌ Tidak terset'
  });
});

// ==================== 404 HANDLER ====================
app.use((req, res) => {
  res.status(404).send('Halaman tidak ditemukan');
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Export untuk Vercel
module.exports = app;

// Untuk running lokal
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
    console.log(`📝 Test endpoint: http://localhost:${PORT}/test`);
    console.log(`🌐 Halaman utama: http://localhost:${PORT}/`);
  });
        }
