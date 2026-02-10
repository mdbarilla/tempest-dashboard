const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');

// Load environment variables from backend directory (so TEMPEST_DEVICE_ID etc. load even when cwd is project root)
dotenv.config({ path: path.join(__dirname, '.env') });

// Import routes
const weatherRoutes = require('./api/weather');
const googleHomeWebhook = require('./webhooks/google-home');

// Import services
const DataCollector = require('./services/data-collector');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for rate limiting (needed when behind reverse proxy)
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json());

// Permissions-Policy: Explicitly deny local network access to prevent browser permission prompts
// This tells browsers that the app does not need local network access
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'local-network-access=()');
  next();
});

// Rate limiting (dashboard ~2 req/min; 2000 allows retries, reloads, multiple tabs)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000
});
app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/weather', weatherRoutes);

// Webhook Routes
app.use('/webhooks/google-home', googleHomeWebhook);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
// Bind to localhost (127.0.0.1) instead of 0.0.0.0 to avoid macOS permission issues
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`🌤️  Tempest Weather API Server running on port ${PORT}`);
  console.log(`📍 Station ID: ${process.env.TEMPEST_STATION_ID}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API: http://localhost:${PORT}/api/weather/current`);
});

// Start data collector (saves observations every minute)
const collector = new DataCollector(1, {
  maxConsecutiveErrors: 10,
  retentionDays: 7,
  cleanupIntervalHours: 24
});
collector.start();

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed');
  });

  // Stop data collector
  collector.stop();

  // Give time for cleanup, then exit
  setTimeout(() => {
    console.log('Shutdown complete');
    process.exit(0);
  }, 1000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
