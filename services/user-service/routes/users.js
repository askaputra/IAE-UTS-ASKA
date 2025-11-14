const express = require('express');
const { users } = require('../db/inMemoryDb');
const jwt = require('jsonwebtoken'); // Diperlukan untuk membuat token baru

const router = express.Router();

// Ambil kunci dari variabel lingkungan (harus sama dengan auth.js)
const PRIVATE_KEY = process.env.PRIVATE_KEY.replace(/\\n/g, '\n');
const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'RS256';

// GET /api/users - Get all users
router.get('/', (req, res) => {
  // Mengembalikan data user yang aman (tanpa password)
  const safeUsers = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    teamId: u.teamId,
    role: u.role
  }));
  res.json(safeUsers);
});

// GET /api/users/:id - Get user by ID
router.get('/:id', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Kirim data yang aman
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    teamId: user.teamId,
    role: user.role
  });
});

// RUTE BARU: PUT /api/users/join-team
// Ini dipanggil oleh frontend saat user baru login
router.put('/join-team', (req, res) => {
  // Dapatkan ID user dari header yang disisipkan gateway (dari token)
  const userId = req.headers['x-user-id']; 
  const { teamId } = req.body; //misal: 'team-1'

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Update teamId di "database"
  user.teamId = teamId;
  console.log(`User ${user.email} joined team ${teamId}`);

  // Buat token BARU dengan teamId yang sudah di-update
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    teamId: user.teamId, // teamId baru
    role: user.role // sertakan peran
  };
  
  const token = jwt.sign(payload, PRIVATE_KEY, {
    algorithm: JWT_ALGORITHM,
    expiresIn: '7d' // Samakan dengan login
  });

  // Kirim kembali data user dan token baru
  res.json({
    message: 'Team joined successfully',
    token, // Kirim token baru
    user: payload // Kirim data user baru
  });
});

// Rute PUT dan DELETE lama yang menyebabkan error sudah dihapus.

module.exports = router;