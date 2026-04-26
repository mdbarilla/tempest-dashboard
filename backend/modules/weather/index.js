/**
 * Weather module
 *
 * Owns: Tempest API, weather DB, NWS alerts, AI bridge, background data collection.
 *
 * Cross-module events emitted (via eventBus):
 *   weather.observation.saved  — after each successful observation save
 *   weather.forecast.updated   — when a new 10-day forecast is fetched (future)
 *   weather.frost.risk         — freeze in horizon (edge-triggered via planting-guidance)
 *   weather.frost.clear        — safe-to-plant gate first satisfied (edge-triggered)
 */

const router           = require('./router');
const DataCollector    = require('./services/data-collector');
const plantingGuidance = require('./services/planting-guidance');

let collector;

function register(app, eventBus) {
  app.use('/api/weather', router);

  plantingGuidance.setEventBus(eventBus);

  collector = new DataCollector(1, {
    maxConsecutiveErrors: 10,
    retentionDays: 7,
    cleanupIntervalHours: 24,
  });
  collector.start();

  // Frost events: emitted from planting-guidance service on snapshot recompute (see services/planting-guidance.js).
}

function stop() {
  if (collector) collector.stop();
}

module.exports = { register, stop };
