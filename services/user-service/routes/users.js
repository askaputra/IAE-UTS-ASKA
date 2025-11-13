const express = require('express');
const { users } = require('../db/inMemoryDb');
const jwt = require('jsonwebtoken'); // Kita butuh ini untuk buat token baru

const router = express.Router();

// Ambil kunci dari variabel lingkungan (harus sama dengan auth.js)
const PRIVATE_KEY = process.env.PRIVATE_KEY.replace(/\\n/g, '\n');
const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'RS256';

// GET /api/users - Get all users
router.get('/', (req, res) => {
  const safeUsers = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    teamId: u.teamId
  }));
  res.json(safeUsers);
});

// GET /api/users/:id - Get user by ID
router.get('/:id', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    teamId: user.teamId
  });
});

// RUTE BARU: PUT /api/users/join-team
router.put('/join-team', (req, res) => {
  // Dapatkan ID user dari header yang disisipkan gateway (dari token)
  const userId = req.headers['x-user-id']; 
  const { teamId } = req.body;

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
    teamId: user.teamId // teamId baru
  };
  
  const token = jwt.sign(payload, PRIVATE_KEY, {
    algorithm: JWT_ALGORITHM,
    expiresIn: '1h'
  });

  // Kirim kembali data user dan token baru
  res.json({
    message: 'Team joined successfully',
    token, // Kirim token baru
    user: { id: user.id, name: user.name, email: user.email, teamId: user.teamId }
  });
});

module.exports = router;