/**
 * Data Collector Service
 * Periodically fetches current weather data and saves it to the database
 * This ensures we have historical data for sparklines and trends
 */

const tempestAPI = require('./tempest-api');
const weatherDB = require('./database');

class DataCollector {
  constructor(intervalMinutes = 1, options = {}) {
    this.api = tempestAPI;
    this.db = weatherDB;
    this.intervalMinutes = intervalMinutes;
    this.intervalId = null;
    this.isCollecting = false;
    this.consecutiveErrors = 0;
    this.maxConsecutiveErrors = options.maxConsecutiveErrors || 10;
    this.retentionDays = options.retentionDays || 7;
    this.cleanupIntervalHours = options.cleanupIntervalHours || 24;
    this.lastCleanup = null;
  }

  /**
   * Start collecting data at regular intervals
   */
  start() {
    if (this.intervalId) {
      console.log('⚠️  Data collector already running');
      return;
    }

    console.log(`📈 Starting data collector (interval: ${this.intervalMinutes} minute${this.intervalMinutes > 1 ? 's' : ''})`);
    console.log(`🗄️  Data retention: ${this.retentionDays} days`);

    // Collect immediately on start
    this.collect();

    // Then collect at regular intervals
    this.intervalId = setInterval(() => {
      this.collect();
    }, this.intervalMinutes * 60 * 1000);

    // Setup cleanup interval
    this.setupCleanup();
  }

  /**
   * Stop collecting data
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('📈 Data collector stopped');
    }
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  /**
   * Setup periodic database cleanup
   */
  setupCleanup() {
    // Clean up old data immediately
    this.cleanupOldData();

    // Then clean up periodically
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupOldData();
    }, this.cleanupIntervalHours * 60 * 60 * 1000);
  }

  /**
   * Remove old observations beyond retention period
   */
  async cleanupOldData() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      const cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000);

      const result = await this.db.deleteOldObservations(cutoffTimestamp);
      if (result && result.changes > 0) {
        console.log(`🗑️  Cleaned up ${result.changes} observations older than ${this.retentionDays} days`);
      }
      this.lastCleanup = new Date();
    } catch (error) {
      console.error('❌ Error cleaning up old data:', error.message);
    }
  }

  /**
   * Collect and save a single observation
   */
  async collect() {
    // Prevent concurrent collection attempts
    if (this.isCollecting) {
      console.log('⚠️  Collection already in progress, skipping...');
      return;
    }

    this.isCollecting = true;

    try {
      const weatherData = await this.api.getCurrentWeather();

      if (!weatherData) {
        console.log('⚠️  No weather data available to save');
        this.consecutiveErrors++;
        return;
      }

      // Validate required fields
      if (!weatherData.timestamp || weatherData.timestamp <= 0) {
        console.error('❌ Invalid timestamp in weather data');
        this.consecutiveErrors++;
        return;
      }

      await this.db.saveObservation(weatherData);
      this.consecutiveErrors = 0; // Reset error counter on success

      // Only log occasionally to reduce noise (every 10 minutes)
      const minute = new Date().getMinutes();
      if (minute % 10 === 0) {
        console.log(`✅ Saved observation at ${new Date(weatherData.timestamp * 1000).toLocaleString()}`);
      }
    } catch (error) {
      this.consecutiveErrors++;
      console.error(`❌ Error collecting data (${this.consecutiveErrors}/${this.maxConsecutiveErrors}):`, error.message);

      // If too many consecutive errors, stop collecting to prevent resource waste
      if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
        console.error(`🛑 Stopping data collector after ${this.maxConsecutiveErrors} consecutive errors`);
        this.stop();
      }
    } finally {
      this.isCollecting = false;
    }
  }

  /**
   * Get collector status
   */
  getStatus() {
    return {
      isRunning: this.intervalId !== null,
      isCollecting: this.isCollecting,
      intervalMinutes: this.intervalMinutes,
      consecutiveErrors: this.consecutiveErrors,
      retentionDays: this.retentionDays,
      lastCleanup: this.lastCleanup
    };
  }
}

module.exports = DataCollector;
