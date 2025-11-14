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

const fetchPublicKey = async () => { /* ... (fungsi ini tetap sama) ... */ };

app.use(helmet());
app.use(cors({ /* ... (cors config tetap sama) ... */ }));
app.use(express.json());
const limiter = rateLimit({ /* ... (limiter config tetap sama) ... */ });
app.use(limiter);

// Middleware Verifikasi JWT (checkJwt)
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
    const decoded = jwt.verify(token, PUBLIC_KEY, { algorithms: [process.env.JWT_ALGORITHM || 'RS256'] });
    req.user = decoded; // Ini sekarang berisi { id, email, name, teamId, role }
    next();
  } catch (err) {
    console.error('JWT Verification Error:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

app.get('/health', (req, res) => { /* ... (health check tetap sama) ... */ });

// Proxy Options (DIPERBARUI)
const proxyOptions = (target) => ({
  target,
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    if (req.user) {
      // TERUSKAN SEMUA DATA USER
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Email', req.user.email);
      proxyReq.setHeader('X-User-Name', req.user.name || ''); // TAMBAHKAN INI
      proxyReq.setHeader('X-User-TeamId', req.user.teamId || '');
      proxyReq.setHeader('X-User-Role', req.user.role || 'user');
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

// --- PERUTEAN PROXY (DIPERBARUI) ---

// 1. Rute Auth Publik
const publicAuthProxy = createProxyMiddleware({
  target: USER_SERVICE_URL,
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
     console.log(`[AUTH-PUBLIC] ${req.method} ${req.url} -> ${proxyReq.path}`);
     if (req.body) {
        fixRequestBody(proxyReq, req);
     }
  },
  onError: (err, req, res) => {
    console.error('Auth Proxy Error:', err.message);
    res.status(502).json({ error: 'Auth service unavailable', message: err.message });
  }
});
app.use('/api/auth/login', publicAuthProxy);
app.use('/api/auth/register', publicAuthProxy);
app.use('/api/auth/public-key', publicAuthProxy);

// 2. Rute Auth Privat (membutuhkan token yang valid)
app.use('/api/auth/check-token', checkJwt, createProxyMiddleware(proxyOptions(USER_SERVICE_URL)));

// 3. Rute Lain yang Diproteksi
app.use('/api/users', checkJwt, createProxyMiddleware(proxyOptions(USER_SERVICE_URL)));
app.use('/api/teams', checkJwt, createProxyMiddleware(proxyOptions(USER_SERVICE_URL)));
app.use('/graphql', checkJwt, createProxyMiddleware({
  ...proxyOptions(TASK_SERVICE_URL),
  ws: true 
}));

// --- AKHIR PERUTEAN ---

app.get('*', (req, res) => { /* ... (catch-all tetap sama) ... */ });
app.use((err, req, res, next) => { /* ... (error handling tetap sama) ... */ });
const server = app.listen(PORT, () => { /* ... (server listen tetap sama) ... */ });
process.on('SIGTERM', () => { /* ... (shutdown tetap sama) ... */ });