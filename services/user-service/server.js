const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Impor rute-rute baru
const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/teams');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'User Service (REST)',
    timestamp: new Date().toISOString()
  });
});

// Gunakan rute-rute baru
app.use('/api/auth', authRoutes); // Ini yang penting untuk /register
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);

app.use(errorHandler);

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

app.listen(PORT, () => {
  console.log(`🚀 User Service (REST) running on port ${PORT}`);
});

module.exports = app;