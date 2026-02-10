import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Routes, Route, useMatch, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { isLocalAccess } from './utils/access';
import CurrentWeather from './components/CurrentWeather';
import Forecast from './components/Forecast';
import Metrics from './components/Metrics';
import NewsCarousel from './components/NewsCarousel';
import ConditionsList from './pages/ConditionsList';
import MetricDetailView from './pages/MetricDetailView';
import './styles/App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/weather';
const REFRESH_INTERVAL = 60000; // 60 seconds

/** True when the URL is /conditions/:metric (metric detail modal open). */
function isMetricDetailPath(pathname) {
  return /^\/conditions\/[^/]+$/.test(pathname);
}

/** Runs refresh interval only when metric detail modal is closed; refreshes once on modal close. */
function RefreshManager({ fetchWeather }) {
  const location = useLocation();
  const pathname = location.pathname;
  const prevPathRef = useRef(pathname);

  // Interval only when modal is closed
  useEffect(() => {
    if (isMetricDetailPath(pathname)) return;
    const interval = setInterval(fetchWeather, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [pathname, fetchWeather]);

  // On modal close: refresh dashboard data once
  useEffect(() => {
    const wasMetricDetail = isMetricDetailPath(prevPathRef.current);
    const isMetricDetail = isMetricDetailPath(pathname);
    if (wasMetricDetail && !isMetricDetail) {
      fetchWeather(0, false);
    }
    prevPathRef.current = pathname;
  }, [pathname, fetchWeather]);

  return null;
}

/** Map condition string to tint category for light-theme background: lighten | darken-more | stormy | neutral
 *  lighten (#f8fafc): snow, sleet
 *  darken-more (#D4DEED): cloudy, overcast, rain, drizzle, freezing rain, storm (no thunder)
 *  stormy (#b6c4d9): thunderstorm, fog, mist, haze — darker, still WCAG
 *  neutral (default): clear, partly cloudy, mostly cloudy
 *  darken: for ?condition=darken override only. */
function toConditionCategory(s) {
  if (!s || typeof s !== 'string') return 'neutral';
  const lower = s.toLowerCase();
  if (/clear/.test(lower) && !/cloud/.test(lower)) return 'neutral';
  if (/partly|mostly/.test(lower)) return 'neutral';
  if (/snow/.test(lower)) return 'lighten';
  if (/sleet/.test(lower)) return 'lighten';
  if (/freezing\s*rain|freezingrain/.test(lower)) return 'darken-more';
  if (/thunder/.test(lower)) return 'stormy';
  if (/fog|mist|haze/.test(lower)) return 'stormy';
  if (/storm/.test(lower)) return 'darken-more';
  if (/rain|drizzle/.test(lower)) return 'darken-more';
  if (/cloud|overcast/.test(lower)) return 'darken-more';
  return 'neutral';
}

function App() {
  const [weatherData, setWeatherData] = useState(null);
  const [recentData, setRecentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('online'); // 'online', 'offline', 'stale'
  const [isUsingCachedData, setIsUsingCachedData] = useState(false);
  const [themeOverride, setThemeOverride] = useState(() => localStorage.getItem('themeOverride') || null); // null, 'light', 'dark'
  const [lastFetchError, setLastFetchError] = useState(null); // { message, code, url } for dev debugging
  const [newsData, setNewsData] = useState(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState(null);
  const isLocal = isLocalAccess();

  const refreshAtmosphere = useCallback(async () => {
    try {
      const r = await axios.get(`${API_BASE_URL}/complete?refresh_atmosphere=1`, { timeout: 10000 });
      if (r.data?.success) {
        setWeatherData(r.data.data);
        setLastUpdate(new Date());
      }
    } catch (e) {
      console.error('Refresh atmosphere failed', e);
    }
  }, []);

  const fetchNews = useCallback(async () => {
    // News disabled by default everywhere. Enable with ?news=1.
    const params = new URLSearchParams(window.location.search);
    const newsParam = params.get('news');
    const showNews = newsParam === '1';

    if (!showNews) {
      setNewsData(null);
      setNewsLoading(false);
      setNewsError(null);
      return;
    }

    setNewsLoading(true);
    setNewsError(null);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/news`, { timeout: 15000 });
      if (response.data?.success) {
        setNewsData(response.data.data || []);
        setNewsError(null);
      } else {
        const errorMsg = response.data?.error || 'Failed to fetch news';
        setNewsError(errorMsg);
        setNewsData(null);
        console.error('News fetch failed:', errorMsg);
      }
    } catch (err) {
      console.error('Error fetching news:', err);
      let errorMsg = err.response?.data?.error || err.message || 'Network error';
      
      // Check if it's a 503 service unavailable (missing dependencies)
      if (err.response?.status === 503) {
        errorMsg = 'News service unavailable. Backend dependencies need to be installed.';
      }
      
      setNewsError(errorMsg);
      setNewsData(null);
    } finally {
      setNewsLoading(false);
    }
  }, []);

  const fetchWeather = useCallback(async (retryCount = 0, isManualRetry = false, forceRefreshAtmosphere = false) => {
    const maxRetries = isManualRetry ? 1 : 3; // Only 1 retry for manual attempts
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s

    // Clear cache on manual retry to force fresh fetch
    if (isManualRetry && retryCount === 0) {
      localStorage.removeItem('weatherData');
      localStorage.removeItem('weatherDataTimestamp');
      setIsUsingCachedData(false);
    }

    try {
      const q = [];
      if (isManualRetry) q.push('refresh_alerts=1');
      if (forceRefreshAtmosphere) q.push('refresh_atmosphere=1');
      const completeUrl = `${API_BASE_URL}/complete${q.length ? '?' + q.join('&') : ''}`;
      const [weatherResponse, recentResponse] = await Promise.all([
        axios.get(completeUrl, { timeout: 10000 }),
        axios.get(`${API_BASE_URL}/recent?hours=12`, { timeout: 10000 }).catch(() => ({ data: { success: false } }))
      ]);

      if (weatherResponse.data.success) {
        const newData = weatherResponse.data.data;
        setWeatherData(newData);
        setLastUpdate(new Date());
        setError(null);
        setLastFetchError(null);
        setConnectionStatus('online');
        setIsUsingCachedData(false);

        // Cache data in localStorage
        localStorage.setItem('weatherData', JSON.stringify(newData));
        localStorage.setItem('weatherDataTimestamp', Date.now().toString());
      }

      if (recentResponse.data.success) {
        setRecentData(recentResponse.data.data);
      }
    } catch (err) {
      console.error('Error fetching weather:', err);
      setLastFetchError({
        message: err.message,
        code: err.code,
        url: err.config?.url || `${API_BASE_URL}/complete`,
        status: err.response?.status
      });

      // Determine error type
      if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        console.warn('Request timed out - Tempest may be offline');
        setConnectionStatus('offline');
      } else if (err.response) {
        console.error('Server error:', err.response.status);
        setConnectionStatus('offline');
      } else if (err.request) {
        console.warn('No response from server - backend may be down');
        setConnectionStatus('offline');
      } else {
        console.error('Unknown error:', err.message);
      }

      // Don't retry on 429 (rate limit) — retries just hit the limit again
      const is429 = err.response?.status === 429;
      const shouldRetry = !is429 && retryCount < maxRetries;

      if (shouldRetry) {
        setTimeout(() => fetchWeather(retryCount + 1, isManualRetry), retryDelay);
      } else {
        // Load from cache after max retries or on 429 (only for automatic retries)
        if (!isManualRetry) {
          const cachedData = localStorage.getItem('weatherData');
          const cachedTimestamp = localStorage.getItem('weatherDataTimestamp');

          if (cachedData && cachedTimestamp) {
            try {
              const data = JSON.parse(cachedData);
              const timestamp = parseInt(cachedTimestamp, 10);

              setWeatherData(data);
              setLastUpdate(new Date(timestamp));
              setIsUsingCachedData(true);
              setError(null);
            } catch (cacheErr) {
              console.error('Error loading cached data:', cacheErr);
              setError('Unable to fetch weather data and no cached data available');
            }
          } else {
            setError('Unable to fetch weather data');
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch + refresh interval + mousemove. Only [fetchWeather] — must NOT depend on
  // weatherData or we get a loop: 429 → setWeatherData(cache) → effect runs → fetch → 429.
  useEffect(() => {
    // Load cached data on mount
    const cachedData = localStorage.getItem('weatherData');
    const cachedTimestamp = localStorage.getItem('weatherDataTimestamp');

    if (cachedData && cachedTimestamp) {
      try {
        const data = JSON.parse(cachedData);
        const timestamp = parseInt(cachedTimestamp, 10);
        const age = Date.now() - timestamp;
        const sentinel = (data?.atmosphere?.description || '').trim() === 'Initializing art engine...';

        if (age < 10 * 60 * 1000 && !sentinel) {
          setWeatherData(data);
          setLastUpdate(new Date(timestamp));
          setIsUsingCachedData(true);
          setLoading(false);
        } else if (sentinel) {
          localStorage.removeItem('weatherData');
          localStorage.removeItem('weatherDataTimestamp');
        }
      } catch (err) {
        console.error('Error loading cached data:', err);
      }
    }

    fetchWeather(0, false, true);
    // Interval is managed by RefreshManager (paused when metric detail modal is open)

    // Hide cursor after 5 seconds of no movement (kiosk mode)
    let timeout;
    const handleMouseMove = () => {
      document.body.classList.remove('hide-cursor');
      clearTimeout(timeout);
      timeout = setTimeout(() => document.body.classList.add('hide-cursor'), 5000);
    };
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [fetchWeather]);

  // Theme (sunrise/sunset). Separate so weatherData can be in deps without retriggering fetch.
  useEffect(() => {
    const updateTheme = () => {
      const manualTheme = localStorage.getItem('themeOverride');
      if (manualTheme) {
        document.body.classList.toggle('theme-dark', manualTheme === 'dark');
        return;
      }
      if (weatherData?.forecast?.daily?.[0]) {
        const now = new Date();
        const sunrise = weatherData.forecast.daily[0].sunrise ? new Date(weatherData.forecast.daily[0].sunrise * 1000) : null;
        const sunset = weatherData.forecast.daily[0].sunset ? new Date(weatherData.forecast.daily[0].sunset * 1000) : null;
        if (sunrise && sunset) {
          document.body.classList.toggle('theme-dark', now < sunrise || now > sunset);
          return;
        }
      }
      const hour = new Date().getHours();
      document.body.classList.toggle('theme-dark', hour >= 18 || hour < 6);
    };
    updateTheme();
    const themeInterval = setInterval(updateTheme, 60000);
    return () => clearInterval(themeInterval);
  }, [weatherData]);

  // data-condition for light-theme background tint (index.css). Prefer forecast.current.conditions (includes corrections).
  // lighten: snow, sleet. darken-more (#D4DEED): cloudy, rain, drizzle, freezing rain, storm. stormy (#b6c4d9): thunderstorm, fog. neutral: clear, partly, mostly.
  // ?condition=lighten|darken|darken-more|stormy|neutral|snow|sleet|rain|drizzle|fog|clear|cloudy|thunderstorm|default to force a tint.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const override = params.get('condition');
    const valid = ['lighten', 'darken', 'darken-more', 'stormy', 'neutral', 'snow', 'sleet', 'rain', 'drizzle', 'fog', 'clear', 'cloudy', 'thunderstorm', 'freezing_rain', 'default'];
    let category = valid.includes(override) ? override : null;
    const c = weatherData?.forecast?.current?.conditions ?? weatherData?.atmosphere?.condition ?? weatherData?.current?.conditions ?? null;
    if (!category && weatherData) {
      category = toConditionCategory(c);
    }
    if (!category) category = 'neutral';
    const legacyMap = { snow: 'lighten', sleet: 'lighten', rain: 'darken-more', drizzle: 'darken-more', fog: 'stormy', clear: 'neutral', cloudy: 'darken-more', thunderstorm: 'stormy', freezing_rain: 'darken-more', default: 'neutral' };
    const dataCondition = legacyMap[category] || category;
    document.documentElement.setAttribute('data-condition', dataCondition);
    document.body.setAttribute('data-condition', dataCondition);
    return () => {
      document.documentElement.removeAttribute('data-condition');
      document.body.removeAttribute('data-condition');
    };
  }, [weatherData]);

  // Separate effect for stale data detection with proper dependencies
  useEffect(() => {
    if (!lastUpdate || connectionStatus === 'offline') return;

    const checkStaleStatus = () => {
      const timeSinceUpdate = Date.now() - lastUpdate.getTime();
      const staleThreshold = 10 * 60 * 1000; // 10 minutes

      if (timeSinceUpdate > staleThreshold && connectionStatus !== 'stale') {
        setConnectionStatus('stale');
      }
    };

    // Check immediately and then every 30 seconds
    checkStaleStatus();
    const staleCheckInterval = setInterval(checkStaleStatus, 30000);

    return () => clearInterval(staleCheckInterval);
  }, [lastUpdate, connectionStatus]);

  // Fetch news when component mounts or URL changes (?news=1 only)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const showNews = params.get('news') === '1';

    if (showNews) {
      fetchNews();
      
      // Refresh news every 10 minutes
      const refreshInterval = setInterval(() => {
        fetchNews();
      }, 10 * 60 * 1000);
      
      return () => clearInterval(refreshInterval);
    } else {
      // Clear news data if news should not be shown
      setNewsData(null);
      setNewsLoading(false);
      setNewsError(null);
    }
  }, [fetchNews]);

  // Also check for URL changes via popstate (back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const showNews = params.get('news') === '1';

      if (showNews) {
        fetchNews();
      } else {
        setNewsData(null);
        setNewsLoading(false);
        setNewsError(null);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [fetchNews]);

  const toggleTheme = () => {
    let newTheme;
    if (themeOverride === null) {
      // Currently auto, switch to manual dark
      newTheme = 'dark';
    } else if (themeOverride === 'dark') {
      // Currently dark, switch to light
      newTheme = 'light';
    } else {
      // Currently light, switch back to auto
      newTheme = null;
    }

    if (newTheme === null) {
      localStorage.removeItem('themeOverride');
    } else {
      localStorage.setItem('themeOverride', newTheme);
    }
    setThemeOverride(newTheme);

    // Apply theme immediately
    if (newTheme === 'dark') {
      document.body.classList.add('theme-dark');
    } else if (newTheme === 'light') {
      document.body.classList.remove('theme-dark');
    } else {
      // Auto mode - use forecast sun times or 6pm–6am fallback
      const updateTheme = () => {
        const now = new Date();
        const sunrise = weatherData?.forecast?.daily?.[0]?.sunrise ? new Date(weatherData.forecast.daily[0].sunrise * 1000) : null;
        const sunset = weatherData?.forecast?.daily?.[0]?.sunset ? new Date(weatherData.forecast.daily[0].sunset * 1000) : null;
        if (sunrise && sunset) {
          document.body.classList.toggle('theme-dark', now < sunrise || now > sunset);
        } else {
          const hour = new Date().getHours();
          document.body.classList.toggle('theme-dark', hour >= 18 || hour < 6);
        }
      };
      updateTheme();
    }
  };

  if (loading) {
    return (
      <div className="app loading">
        <div className="loading-spinner"></div>
        <p>Loading weather data...</p>
      </div>
    );
  }

  if (error && !weatherData) {
    return (
      <div className="app error">
        <div className="error-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h2>{error}</h2>
        <p>Check your backend server is running</p>
        {process.env.NODE_ENV === 'development' && lastFetchError && (
          <pre style={{ fontSize: 11, textAlign: 'left', maxWidth: 480, margin: '8px auto', padding: 8, background: '#1a1a1a', color: '#ccc', borderRadius: 4, overflow: 'auto' }}>
            API: {API_BASE_URL}
            {lastFetchError.url && `\nRequest: ${lastFetchError.url}`}
            {lastFetchError.message && `\nError: ${lastFetchError.message}`}
            {lastFetchError.code && `\nCode: ${lastFetchError.code}`}
            {lastFetchError.status != null && `\nHTTP: ${lastFetchError.status}`}
          </pre>
        )}
        <button onClick={() => fetchWeather()}>Retry</button>
      </div>
    );
  }

  // Don't render main content if weatherData is null
  if (!weatherData) {
    return (
      <div className="app loading">
        <div className="loading-spinner"></div>
        <p>Loading weather data...</p>
      </div>
    );
  }

  // Dashboard (no overlay — metric detail uses separate route)
  const DashboardContent = () => {
    const navigate = useNavigate();
    return (
    <>
      <CurrentWeather
        current={weatherData.current}
        forecast={weatherData.forecast}
        lastUpdate={lastUpdate}
        alerts={weatherData.alerts || []}
        atmosphere={weatherData.atmosphere}
        isLocal={isLocal}
        onRefreshAtmosphere={refreshAtmosphere}
      />
      <Metrics
        current={weatherData.current}
        forecast={weatherData.forecast}
        recent={recentData}
        isLocal={isLocal}
        onMetricClick={(link) => navigate(link, { state: { from: 'dashboard' } })}
        onPrecipAddClick={() => navigate('/conditions/precipitation', { state: { from: 'dashboard', view: 'add' } })}
        onRefresh={() => fetchWeather(0, false)}
      />
      <Forecast forecast={weatherData.forecast} />
      <NewsCarousel
        newsData={newsData}
        loading={newsLoading}
        error={newsError}
      />
    </>
  );
  };

  // Metric detail: shows correct background (List or Dashboard) based on navigation source, plus overlay
  const MetricDetailRoute = () => {
    const match = useMatch('/conditions/:metric');
    const location = useLocation();
    const from = location.state?.from || 'dashboard';
    const metric = match?.params?.metric;

    return (
      <>
        {from === 'list' ? (
          <div className="route-content">
            <ConditionsList
              current={weatherData.current}
              forecast={weatherData.forecast}
              recent={recentData}
              lastUpdate={lastUpdate}
              isLocal={isLocal}
              atmosphere={weatherData.atmosphere}
              alerts={weatherData.alerts || []}
              onRefresh={() => fetchWeather(0, false)}
              onRefreshAtmosphere={refreshAtmosphere}
            />
          </div>
        ) : (
          <DashboardContent />
        )}
        {metric && ReactDOM.createPortal(
          <MetricDetailView
            current={weatherData?.current}
            forecast={weatherData?.forecast}
            metricOverride={metric}
            connectionStatus={connectionStatus}
            onRetryConnection={() => fetchWeather(0, true)}
            onRefresh={() => fetchWeather(0, false)}
            isLocal={isLocal}
          />,
          document.body
        )}
      </>
    );
  };

  return (
    <BrowserRouter>
      <RefreshManager fetchWeather={fetchWeather} />
      <div className="app">
        {connectionStatus !== 'online' && (
        <div className={`connection-banner ${connectionStatus}`}>
          {connectionStatus === 'offline' && (
            <>
              <span>
                <span className="connection-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </span>
                <span>
                  {isUsingCachedData
                    ? <>
                        <a
                          href="https://tempestwx.com/station/204768/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="banner-link"
                        >
                          Tempest offline
                        </a>
                        {` - showing cached data from ${lastUpdate?.toLocaleTimeString()}`}
                      </>
                    : 'Connection lost - attempting to reconnect...'}
                </span>
              </span>
              <button onClick={() => fetchWeather(0, true)}>Retry Now</button>
              {process.env.NODE_ENV === 'development' && lastFetchError && (
                <span style={{ fontSize: 10, opacity: 0.9, marginLeft: 8 }}>
                  Last: {lastFetchError.message}{lastFetchError.status != null ? ` (${lastFetchError.status})` : ''}
                </span>
              )}
            </>
          )}
          {connectionStatus === 'stale' && (
            <>
              <span>
                <span className="connection-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </span>
                <span>No new data for 10+ minutes - last updated {lastUpdate?.toLocaleTimeString()}</span>
              </span>
              <button onClick={() => fetchWeather(0, true)}>Refresh</button>
            </>
          )}
        </div>
      )}

      <div className="container">
        <main className="main-content">
          <Routes>
            <Route
              path="/conditions/:metric"
              element={<MetricDetailRoute />}
            />
            <Route
              path="/conditions"
              element={
                <div className="route-content">
                  <ConditionsList
                    current={weatherData.current}
                    forecast={weatherData.forecast}
                    recent={recentData}
                    lastUpdate={lastUpdate}
                    isLocal={isLocal}
                    atmosphere={weatherData.atmosphere}
                    alerts={weatherData.alerts || []}
                    onRefresh={() => fetchWeather(0, false)}
                    onRefreshAtmosphere={refreshAtmosphere}
                  />
                </div>
              }
            />
            <Route path="/" element={<DashboardContent />} />
            <Route path="*" element={<DashboardContent />} />
          </Routes>
        </main>

        <footer className="footer">
          <a
            href="https://tempestwx.com/station/204768/"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            <span>Tempest Station #204768 • Wayland, MA</span>
            <svg viewBox="0 0 24 24">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
          <div className="footer-actions">
            <button onClick={toggleTheme} className="theme-toggle" title={
              themeOverride === null ? 'Theme: Auto' :
              themeOverride === 'dark' ? 'Theme: Dark' : 'Theme: Light'
            }>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" fill="none" />
                <path d="M12 2 A10 10 0 0 1 12 22 Z" fill="currentColor" stroke="none" />
              </svg>
            </button>
          </div>
        </footer>
      </div>
    </div>
    </BrowserRouter>
  );
}

export default App;
