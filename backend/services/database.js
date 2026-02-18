const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class WeatherDatabase {
  constructor() {
    const dbPath = process.env.DATABASE_PATH || './data/weather.db';
    const dbDir = path.dirname(dbPath);

    // Create data directory if it doesn't exist
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('📊 Connected to SQLite database');
        this.initializeDatabase();
      }
    });
  }

  /**
   * Initialize database schema
   */
  initializeDatabase() {
    this.db.serialize(() => {
      // Observations table - stores weather readings
      this.db.run(`
        CREATE TABLE IF NOT EXISTS observations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER NOT NULL UNIQUE,
          temp_celsius REAL,
          temp_fahrenheit REAL,
          feels_like_celsius REAL,
          feels_like_fahrenheit REAL,
          humidity REAL,
          wind_speed REAL,
          wind_gust REAL,
          wind_direction INTEGER,
          pressure_mb REAL,
          pressure_inhg REAL,
          uv_index REAL,
          solar_radiation REAL,
          precip_today REAL,
          precip_last_hour REAL,
          lightning_strikes INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Add conditions column for historical hourly view (1.5.0)
      this.db.run(`ALTER TABLE observations ADD COLUMN conditions TEXT`, (err) => {
        if (err && !/duplicate column name/i.test(err.message)) console.error('observations conditions:', err);
      });

      // Create index on timestamp for faster queries
      this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_timestamp
        ON observations(timestamp DESC)
      `);

      // Create index on date for historical queries
      this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_created_at
        ON observations(created_at)
      `);

      // Condition corrections table - stores user-reported corrections
      this.db.run(`
        CREATE TABLE IF NOT EXISTS condition_corrections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER NOT NULL,
          reported_condition TEXT NOT NULL,
          original_condition TEXT NOT NULL,
          temperature REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Precip-based persistence: revert to API when current precip % drops below this
      this.db.run(`ALTER TABLE condition_corrections ADD COLUMN precip_pct_at_correction REAL`, (err) => {
        if (err && !/duplicate column name/i.test(err.message)) console.error('condition_corrections precip_pct:', err);
      });

      // Create index on timestamp for corrections
      this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_corrections_timestamp
        ON condition_corrections(timestamp DESC)
      `);

      // Manual precipitation table - stores user-logged precipitation data
      this.db.run(`
        CREATE TABLE IF NOT EXISTS manual_precipitation (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER NOT NULL,
          amount_inches REAL NOT NULL,
          precip_type TEXT NOT NULL,
          notes TEXT,
          temperature REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create index on timestamp for manual precipitation
      this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_manual_precip_timestamp
        ON manual_precipitation(timestamp DESC)
      `);

      console.log('✅ Database schema initialized');
    });
  }

  /**
   * Save weather observation
   */
  saveObservation(data) {
    return new Promise((resolve, reject) => {
      const conditions = (data.conditions && typeof data.conditions === 'string') ? data.conditions : null;
      const sql = `
        INSERT OR REPLACE INTO observations (
          timestamp, temp_celsius, temp_fahrenheit,
          feels_like_celsius, feels_like_fahrenheit,
          humidity, wind_speed, wind_gust, wind_direction,
          pressure_mb, pressure_inhg, uv_index,
          solar_radiation, precip_today, precip_last_hour,
          lightning_strikes, conditions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        data.timestamp,
        data.temperature.celsius,
        data.temperature.fahrenheit,
        data.feelsLike.celsius,
        data.feelsLike.fahrenheit,
        data.humidity,
        data.wind.speed,
        data.wind.gust,
        data.wind.direction,
        data.pressure.mb,
        data.pressure.inHg,
        data.uv,
        data.solarRadiation,
        data.precipitation.today,
        data.precipitation.lastHour,
        data.lightning.strikeCount,
        conditions
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  /**
   * Get observations within a timestamp range (for charts needing exact time span).
   * Returns the MOST RECENT observations (DESC + limit) so we never truncate recent data.
   * @param {number} cutoffUnix - Start of range (Unix seconds; observations.timestamp is INTEGER seconds).
   * @param {number} endUnix - End of range (Unix seconds).
   * @param {number} limit - Max rows to return (oldest may be dropped if over limit; we keep newest).
   */
  getObservationsByTimestampRange(cutoffUnix, endUnix, limit = 10000) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM (
          SELECT * FROM observations
          WHERE timestamp >= ? AND timestamp <= ?
          ORDER BY timestamp DESC
          LIMIT ?
        ) ORDER BY timestamp ASC
      `;
      this.db.all(sql, [cutoffUnix, endUnix, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Get the most recent observation (for "current" Ask intent).
   * @param {number} maxAgeSeconds - Only consider observations from last N seconds (default 2 hours).
   * @returns {Promise<object|null>} Latest observation or null.
   */
  getLatestObservation(maxAgeSeconds = 7200) {
    return new Promise((resolve, reject) => {
      const now = Math.floor(Date.now() / 1000);
      const cutoff = now - maxAgeSeconds;
      const sql = `
        SELECT * FROM observations
        WHERE timestamp >= ?
        ORDER BY timestamp DESC
        LIMIT 1
      `;
      this.db.get(sql, [cutoff], (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }

  /**
   * Get historical data for date range
   */
  getHistoricalData(startDate, endDate, limit = 1000) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM observations
        WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)
        ORDER BY timestamp DESC
        LIMIT ?
      `;

      this.db.all(sql, [startDate, endDate, limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Get statistical summary for date range
   */
  getStatistics(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT
          COUNT(*) as record_count,
          MIN(temp_fahrenheit) as min_temp_f,
          MAX(temp_fahrenheit) as max_temp_f,
          AVG(temp_fahrenheit) as avg_temp_f,
          MIN(temp_celsius) as min_temp_c,
          MAX(temp_celsius) as max_temp_c,
          AVG(temp_celsius) as avg_temp_c,
          AVG(humidity) as avg_humidity,
          MIN(humidity) as min_humidity,
          MAX(humidity) as max_humidity,
          MAX(wind_gust) as max_wind_gust,
          MIN(wind_speed) as min_wind_speed,
          AVG(wind_speed) as avg_wind_speed,
          SUM(precip_today) as total_precipitation,
          MAX(uv_index) as max_uv,
          MAX(solar_radiation) as max_solar_radiation,
          AVG(pressure_mb) as avg_pressure,
          MIN(pressure_mb) as min_pressure_mb,
          MAX(pressure_mb) as max_pressure_mb,
          SUM(lightning_strikes) as total_lightning_strikes
        FROM observations
        WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)
      `;

      this.db.get(sql, [startDate, endDate], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get hourly averages for charting
   */
  getHourlyAverages(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT
          strftime('%Y-%m-%d %H:00:00', created_at) as hour,
          AVG(temp_fahrenheit) as avg_temp_f,
          AVG(temp_celsius) as avg_temp_c,
          AVG(humidity) as avg_humidity,
          AVG(wind_speed) as avg_wind_speed,
          AVG(pressure_mb) as avg_pressure,
          MAX(precip_today) as max_precip_today,
          AVG(solar_radiation) as avg_solar_radiation,
          MAX(uv_index) as max_uv_index
        FROM observations
        WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)
        GROUP BY hour
        ORDER BY hour
      `;

      this.db.all(sql, [startDate, endDate], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Get daily summary
   */
  getDailySummary(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT
          DATE(created_at) as date,
          MIN(temp_fahrenheit) as min_temp_f,
          MAX(temp_fahrenheit) as max_temp_f,
          AVG(temp_fahrenheit) as avg_temp_f,
          AVG(humidity) as avg_humidity,
          MAX(wind_gust) as max_wind_gust,
          AVG(pressure_mb) as avg_pressure,
          MAX(uv_index) as max_uv
        FROM observations
        WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)
        GROUP BY date
        ORDER BY date
      `;

      this.db.all(sql, [startDate, endDate], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Save a condition correction
   * @param {Object} data - { timestamp, reportedCondition, originalCondition, temperature, precipPctAtCorrection? }
   */
  saveConditionCorrection(data) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO condition_corrections (
          timestamp, reported_condition, original_condition, temperature, precip_pct_at_correction
        ) VALUES (?, ?, ?, ?, ?)
      `;

      const params = [
        data.timestamp,
        data.reportedCondition,
        data.originalCondition,
        data.temperature,
        (data.precipPctAtCorrection != null && !Number.isNaN(Number(data.precipPctAtCorrection)))
          ? Number(data.precipPctAtCorrection) : null
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID });
        }
      });
    });
  }

  /**
   * Get the most recent condition correction within a time window
   */
  getRecentCorrection(timestamp, windowMinutes = 30) {
    return new Promise((resolve, reject) => {
      const windowSeconds = windowMinutes * 60;
      const sql = `
        SELECT * FROM condition_corrections
        WHERE timestamp >= ? AND timestamp <= ?
        ORDER BY created_at DESC
        LIMIT 1
      `;

      this.db.get(sql, [timestamp - windowSeconds, timestamp + windowSeconds], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  /**
   * Get the most recent condition correction for today
   */
  getTodayCorrection() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM condition_corrections
        WHERE DATE(created_at) = DATE('now')
        ORDER BY created_at DESC
        LIMIT 1
      `;

      this.db.get(sql, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  /**
   * Get condition corrections within a timestamp range (for hourly history overlay).
   * Returns the most recent correction per hour bucket so edits show in the history table.
   */
  getCorrectionsForTimestampRange(startUnix, endUnix) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM condition_corrections
        WHERE timestamp >= ? AND timestamp <= ?
        ORDER BY created_at DESC
      `;
      this.db.all(sql, [startUnix, endUnix], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Get all condition corrections for analysis
   */
  getAllCorrections(limit = 100) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM condition_corrections
        ORDER BY timestamp DESC
        LIMIT ?
      `;

      this.db.all(sql, [limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Delete condition correction
   */
  deleteConditionCorrection(id) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM condition_corrections WHERE id = ?`;

      this.db.run(sql, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  /**
   * Delete all condition corrections in the same window as getRecentCorrection.
   * Used on "Reset to API" so the next /complete uses raw Tempest data.
   */
  deleteCorrectionsInWindow(obsTimestamp, windowMinutes = 24 * 60) {
    return new Promise((resolve, reject) => {
      const windowSeconds = windowMinutes * 60;
      const sql = `
        DELETE FROM condition_corrections
        WHERE timestamp >= ? AND timestamp <= ?
      `;

      this.db.run(sql, [obsTimestamp - windowSeconds, obsTimestamp + windowSeconds], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  /**
   * Save manual precipitation entry
   */
  saveManualPrecipitation(data) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO manual_precipitation (
          timestamp, amount_inches, precip_type, notes, temperature
        ) VALUES (?, ?, ?, ?, ?)
      `;

      const params = [
        data.timestamp,
        data.amountInches,
        data.precipType,
        data.notes || null,
        data.temperature || null
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID });
        }
      });
    });
  }

  /**
   * Get manual precipitation entries for a date range
   */
  getManualPrecipitation(startDate, endDate, limit = 100) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM manual_precipitation
        WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)
        ORDER BY timestamp DESC
        LIMIT ?
      `;

      this.db.all(sql, [startDate, endDate, limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Get manual precipitation entries within a timestamp range (for hourly history overlay).
   */
  getManualPrecipitationByTimestampRange(startUnix, endUnix) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM manual_precipitation
        WHERE timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp ASC
      `;
      this.db.all(sql, [startUnix, endUnix], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Get recent manual precipitation entry within a time window
   */
  getRecentManualPrecipitation(timestamp, windowMinutes = 60) {
    return new Promise((resolve, reject) => {
      const windowSeconds = windowMinutes * 60;
      const sql = `
        SELECT * FROM manual_precipitation
        WHERE timestamp >= ? AND timestamp <= ?
        ORDER BY created_at DESC
        LIMIT 1
      `;

      this.db.get(sql, [timestamp - windowSeconds, timestamp + windowSeconds], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  /**
   * Get all manual precipitation entries
   */
  getAllManualPrecipitation(limit = 100) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM manual_precipitation
        ORDER BY timestamp DESC
        LIMIT ?
      `;

      this.db.all(sql, [limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Delete manual precipitation entry
   */
  deleteManualPrecipitation(id) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM manual_precipitation WHERE id = ?`;

      this.db.run(sql, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  /**
   * Get today's manual precipitation entries
   */
  getTodayManualPrecipitation() {
    return new Promise((resolve, reject) => {
      // Convert created_at from UTC to localtime for comparison
      const sql = `
        SELECT * FROM manual_precipitation
        WHERE DATE(created_at, 'localtime') = DATE('now', 'localtime')
        ORDER BY created_at DESC
      `;

      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Get cumulative precipitation total for today
   */
  getTodayPrecipitationTotal() {
    return new Promise((resolve, reject) => {
      // Convert created_at from UTC to localtime for comparison
      const sql = `
        SELECT COALESCE(SUM(amount_inches), 0) as total
        FROM manual_precipitation
        WHERE DATE(created_at, 'localtime') = DATE('now', 'localtime')
      `;

      this.db.get(sql, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row?.total || 0);
        }
      });
    });
  }

  /**
   * Delete observations older than a given timestamp
   */
  deleteOldObservations(cutoffTimestamp) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM observations WHERE timestamp < ?';

      this.db.run(sql, [cutoffTimestamp], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  /**
   * Close database connection
   */
  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Database connection closed');
          resolve();
        }
      });
    });
  }
}

module.exports = new WeatherDatabase();
