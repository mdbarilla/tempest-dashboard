/**
 * Garden module
 *
 * Owns: seed inventory, activities, plantings, garden zones, plants, tasks.
 *
 * Cross-module events consumed (via eventBus):
 *   weather.frost.clear  →  surface "safe to plant out" indicator on garden dashboard;
 *                           flag plants whose outdoor_planting_timing window is now open
 *   weather.frost.risk   →  warn about outdoor plants that may need protection
 *
 * Cross-module events emitted (future):
 *   garden.plant.set-out  — seed moved to in-ground (Step 5: seed→plant flow)
 *   garden.task.created   — new task added to a zone
 */

const router = require('./router');

function register(app, eventBus) {
  app.use('/api/garden', router);

  // Future: respond to weather events
  // eventBus.on('weather.frost.clear', async ({ safePlantOutDate }) => {
  //   // Mark seeds/plants whose outdoor_planting_timing has opened as ready-to-set-out
  //   // Surfaced on the garden dashboard as an actionable banner
  // });
  //
  // eventBus.on('weather.frost.risk', async ({ firstFrostDate, lowTempF }) => {
  //   // Flag outdoor plants that may need protection before firstFrostDate
  // });
}

module.exports = { register };
