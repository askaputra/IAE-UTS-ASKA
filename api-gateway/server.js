const express = require('express');
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const USER_SERVICE_URL = process.env.USER_SERVICE_URL;
const TASK_SERVICE_URL = process.env.TASK_SERVICE_URL;

let PUBLIC_KEY = null;

const fetchPublicKey = async () => {
  try {
    console.log(`Fetching public key from ${USER_SERVICE_URL}/api/auth/public-key`);
    const response = await axios.get(`${USER_SERVICE_URL}/api/auth/public-key`);
    PUBLIC_KEY = response.data.publicKey;
    console.log('Public key fetched successfully.');
  } catch (error) {
    console.error('Failed to fetch public key. Retrying in 5 seconds...', error.message);
    setTimeout(fetchPublicKey, 5000);
  }
};

app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3002',
    'http://frontend-app:3000'
  ],
  credentials: true
}));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Middleware Verifikasi JWT (DIPERBARUI)
const checkJwt = (req, res, next) => {
  if (!PUBLIC_KEY) {
    return res.status(503).json({ error: 'Service unavailable. Public key not yet fetched.' });
  }
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Malformed token' });
  }
  try {
    // BACA PERAN DARI TOKEN
    const decoded = jwt.verify(token, PUBLIC_KEY, { algorithms: [process.env.JWT_ALGORITHM || 'RS256'] });
    req.user = decoded; // Ini sekarang berisi { id, email, name, teamId, role }
    next();
  } catch (err) {
    console.error('JWT Verification Error:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    services: { 'user-service': USER_SERVICE_URL, 'task-service': TASK_SERVICE_URL }
  });
});

// Proxy Options (DIPERBARUI)
const proxyOptions = (target) => ({
  target,
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    if (req.user) {
      // TERUSKAN PERAN SEBAGAI HEADER
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Email', req.user.email);
      proxyReq.setHeader('X-User-TeamId', req.user.teamId || '');
      proxyReq.setHeader('X-User-Role', req.user.role || 'user'); // Header peran baru
    }
    if (req.body) {
      fixRequestBody(proxyReq, req);
    }
  },
  onError: (err, req, res) => {
    console.error(`Proxy Error to ${target}:`, err.message);
    res.status(502).json({ error: 'Service unavailable', message: err.message });
  }
});

// Perutean Proxy
app.use('/api/auth', createProxyMiddleware({
  target: USER_SERVICE_URL,
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
     console.log(`[AUTH] ${req.method} ${req.url} -> ${proxyReq.path}`);
     if (req.body) {
        fixRequestBody(proxyReq, req);
     }
  },
  onError: (err, req, res) => {
    console.error('Auth Proxy Error:', err.message);
    res.status(502).json({ error: 'Auth service unavailable', message: err.message });
  }
}));

app.use('/api/users', checkJwt, createProxyMiddleware(proxyOptions(USER_SERVICE_URL)));
app.use('/api/teams', checkJwt, createProxyMiddleware(proxyOptions(USER_SERVICE_URL)));
app.use('/graphql', checkJwt, createProxyMiddleware({
  ...proxyOptions(TASK_SERVICE_URL),
  ws: true 
}));

// (Sisa file tetap sama...)
app.get('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});
app.use((err, req, res, next) => {
  console.error('Gateway Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
const server = app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  fetchPublicKey();
});
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Process terminated');
  });
});