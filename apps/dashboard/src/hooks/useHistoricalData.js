import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/weather';

const cache = new Map();

const getCacheKey = (metric, hours) => `${metric}-${hours}`;

const getCacheTTL = (hours) => (hours > 24 ? 60 * 1000 : 5 * 60 * 1000); // 3d/7d: 1 min; 24h: 5 min

function getFriendlyChartError(err) {
  const msg = err.message || '';
  const code = err.code || '';
  if (code === 'ERR_NETWORK' || msg === 'Network Error' || /network/i.test(msg)) {
    return 'Unable to load chart data. Check your connection and try again.';
  }
  if (code === 'ECONNABORTED' || /timeout/i.test(msg)) {
    return 'Request timed out. Try again.';
  }
  if (err.response?.status === 404) {
    return 'Chart data not available.';
  }
  return err.response?.data?.error || msg || 'Failed to load chart data.';
}

const useHistoricalData = (metric, hours = 24) => {
  // Initialize from cache when available so opening metric detail doesn't flash loading
  const cacheKey = metric && hours ? getCacheKey(metric, hours) : null;
  const cached = cacheKey ? cache.get(cacheKey) : null;
  const cacheValid = cached && (Date.now() - cached.timestamp < getCacheTTL(hours));
  const [data, setData] = useState(() => (cacheValid ? cached.data : null));
  const [loading, setLoading] = useState(() => !cacheValid);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const fetchData = useCallback(async (metricParam, hoursParam, useCache = true) => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const cacheKey = getCacheKey(metricParam, hoursParam);
    const cached = cache.get(cacheKey);

    // Check cache first
    if (useCache && cached && (Date.now() - cached.timestamp < getCacheTTL(hoursParam))) {
      setData(cached.data);
      setLoading(false);
      setError(null);
      return;
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_BASE_URL}/recent`, {
        params: {
          hours: hoursParam,
          metric: metricParam
        },
        signal: abortControllerRef.current.signal,
        timeout: 30000
      });

      if (response.data.success) {
        const responseData = response.data.data;
        const manualEntries = Array.isArray(responseData.manualEntries) ? responseData.manualEntries : [];

        // Transform data into chart-friendly format
        const timestamps = Array.isArray(responseData.timestamps) ? responseData.timestamps : [];

        // For precipitation manual entries, timestamps won't always align exactly with observation buckets.
        // Attach each manual entry to the nearest bucket within a reasonable window so the detail modal reflects new data.
        const manualByNearestTimestamp = (() => {
          if (metricParam !== 'precipitation' || !manualEntries.length || !timestamps.length) return null;
          const map = new Map();
          const maxDeltaSec = hoursParam <= 24 ? 30 * 60 : 2 * 60 * 60; // 30m for 24h charts; looser for multi-day
          for (const entry of manualEntries) {
            const ts = Number(entry?.timestamp);
            if (!Number.isFinite(ts)) continue;
            let best = null;
            let bestDelta = Infinity;
            for (let i = 0; i < timestamps.length; i++) {
              const t = Number(timestamps[i]);
              const d = Math.abs(t - ts);
              if (d < bestDelta) {
                bestDelta = d;
                best = t;
              }
              if (bestDelta === 0) break;
            }
            if (best != null && bestDelta <= maxDeltaSec) {
              map.set(best, entry);
            }
          }
          return map;
        })();

        const chartData = timestamps.map((timestamp, index) => {
          const rawValue = responseData[metricParam]?.[index];
          const dataPoint = {
            timestamp,
            time: new Date(timestamp * 1000),
            value: rawValue ?? (metricParam === 'precipitation' ? 0 : null)
          };

          // Wind: include gust and lull for multi-line chart
          if (metricParam === 'wind') {
            dataPoint.valueGust = responseData.windGust?.[index] ?? null;
            dataPoint.valueLull = responseData.windLull?.[index] ?? null;
          }

          // Add manual precipitation entries if available
          if (metricParam === 'precipitation' && manualByNearestTimestamp) {
            const manualEntry = manualByNearestTimestamp.get(timestamp);
            if (manualEntry) dataPoint.manualEntry = manualEntry;
          }

          return dataPoint;
        }).filter(d => {
          if (hoursParam > 24) {
            return true;
          }
          if (metricParam === 'wind') {
            return d.value !== null || d.valueGust !== null || d.valueLull !== null;
          }
          if (metricParam === 'precipitation') {
            return true;
          }
          return d.value !== null && d.value !== undefined;
        });

        const result = {
          data: chartData,
          count: response.data.count,
          hours: response.data.hours,
          manualEntries
        };

        // Cache the result
        cache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });

        setData(result);
        setError(null);
      } else {
        throw new Error(response.data.error || 'Failed to fetch historical data');
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ECONNABORTED') {
        // Request was cancelled or timed out - don't set error state
        return;
      }

      // Try to use cached data as fallback
      if (cached) {
        setData(cached.data);
        setError(null);
        console.warn('Using cached data due to fetch error:', err.message);
      } else {
        const friendlyMessage = getFriendlyChartError(err);
        setError(friendlyMessage);
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (metric && hours) {
      fetchData(metric, hours, true);
    }

    return () => {
      // Cleanup: abort request on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [metric, hours, fetchData]);

  const refetch = useCallback(() => {
    if (metric && hours) {
      const cacheKey = getCacheKey(metric, hours);
      cache.delete(cacheKey); // Clear cache to force fresh fetch
      fetchData(metric, hours, false);
    }
  }, [metric, hours, fetchData]);

  return { data, loading, error, refetch };
};

export default useHistoricalData;
