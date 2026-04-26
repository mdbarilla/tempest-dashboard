const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const dotenv    = require('dotenv');
const rateLimit = require('express-rate-limit');

dotenv.config({ path: path.join(__dirname, '.env') });

// Cross-module event bus — passed into each module's register() call.
// Modules pub/sub here; no module imports another directly.
const eventBus = require('./core/events');

// Modules — each owns its routes, services, and event hooks
const weatherModule   = require('./modules/weather');
const gardenModule    = require('./modules/garden');
const guestbookModule = require('./modules/guestbook');

const googleHomeWebhook = require('./webhooks/google-home');

const app  = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

// Prevent browser local-network-access permission prompts
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'local-network-access=()');
  next();
});

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 2000 });
app.use('/api/', limiter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// Register modules — each mounts its own routes and wires event listeners
weatherModule.register(app, eventBus);
gardenModule.register(app, eventBus);
guestbookModule.register(app, eventBus);

app.use('/webhooks/google-home', googleHomeWebhook);

app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`🌤️  TowerHill API running on port ${PORT}`);
  console.log(`📍 Station ID: ${process.env.TEMPEST_STATION_ID}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
  console.log(`🔗 Weather: http://localhost:${PORT}/api/weather/current`);
});

const shutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  server.close(() => console.log('HTTP server closed'));
  weatherModule.stop();
  setTimeout(() => { console.log('Shutdown complete'); process.exit(0); }, 1000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
