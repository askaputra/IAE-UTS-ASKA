const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validateUser, validateLogin } = require('../middleware/validation');
const { users } = require('../db/inMemoryDb');

const router = express.Router();

const PRIVATE_KEY = process.env.PRIVATE_KEY.replace(/\\n/g, '\n');
const PUBLIC_KEY = process.env.PUBLIC_KEY.replace(/\\n/g, '\n');
const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'RS256';

// RUTE: POST /api/auth/register
router.post('/register', validateUser, async (req, res) => {
  const { name, email, password } = req.body;
  if (users.find(u => u.email === email)) {
    return res.status(409).json({ error: 'Email already exists' });
  }
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // LOGIKA PERAN (ROLE) BARU
  // Jika email adalah 'admin@email.com', jadikan 'admin', selain itu 'user'
  const role = (email === 'admin@email.com') ? 'admin' : 'user';

  const newUser = {
    id: uuidv4(),
    name,
    email,
    password: hashedPassword,
    teamId: null,
    role: role, // Tambahkan peran
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  console.log(`User registered: ${newUser.email} (Role: ${newUser.role})`);
  
  res.status(201).json({
    message: 'User created successfully',
    user: { 
      id: newUser.id, 
      name: newUser.name, 
      email: newUser.email, 
      teamId: newUser.teamId,
      role: newUser.role // Kirim peran ke frontend
    }
  });
});

// RUTE: POST /api/auth/login
router.post('/login', validateLogin, async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) {
    console.log('Login failed: user not found', email);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    console.log('Login failed: password mismatch for', email);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // TAMBAHKAN PERAN KE TOKEN
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name, 
    teamId: user.teamId,
    role: user.role // Tambahkan peran ke token JWT
  };

  const token = jwt.sign(payload, PRIVATE_KEY, {
    algorithm: JWT_ALGORITHM,
    expiresIn: '1h'
  });
  console.log('Login successful:', user.email);
  
  // Kirim peran ke frontend
  res.json({
    message: 'Login successful',
    token,
    user: { 
      id: user.id, 
      name: user.name, 
      email: user.email, 
      teamId: user.teamId,
      role: user.role
    }
  });
});

// RUTE: GET /api/auth/public-key
router.get('/public-key', (req, res) => {
  res.json({ publicKey: PUBLIC_KEY });
});

module.exports = router;