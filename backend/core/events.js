/**
 * App-wide event bus for cross-module communication.
 *
 * Modules publish events here; other modules subscribe.
 * Neither module needs to import the other directly — the bus is the contract.
 *
 * Event naming convention: <module>.<subject>.<verb>
 *
 * Published (weather module):
 *   weather.observation.saved     — { timestamp, tempF, conditions, ... }
 *   weather.forecast.updated      — { daily: [...] }  (future: on each forecast fetch)
 *   weather.frost.risk            — { firstFrostDate, lowTempF, level }  freeze in horizon (see planting-guidance)
 *   weather.frost.clear           — { safePlantOutDate, freezeFreeStreakDays, confidence, lastComputed }
 *                                 edge-triggered when safe-to-plant first becomes true
 *
 * Subscribed (garden module — future):
 *   weather.frost.clear  →  flag plants as safe to set out, surface on garden dashboard
 *   weather.frost.risk   →  warn about unprotected outdoor plants
 *
 * Usage:
 *   const eventBus = require('./core/events');
 *   eventBus.emit('weather.frost.clear', { safePlantOutDate: '2026-05-01' });
 *   eventBus.on('weather.frost.clear', (data) => { ... });
 */

const EventEmitter = require('events');

class AppEventBus extends EventEmitter {}

const eventBus = new AppEventBus();
eventBus.setMaxListeners(20); // one per module + headroom

module.exports = eventBus;
