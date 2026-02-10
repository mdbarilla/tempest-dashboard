# Setting up React Router for Analytics Pages

To enable clickable metric tiles that navigate to analytics pages, follow these steps:

## 1. Install React Router

Run this command in the dashboard directory:

```bash
npm install react-router-dom
```

## 2. Update App.js

Replace the contents of `src/App.js` with the following:

```javascript
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import './styles/App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/weather';
const REFRESH_INTERVAL = 60000; // 60 seconds

function App() {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, REFRESH_INTERVAL);

    // Auto light/dark theme based on time of day
    const updateTheme = () => {
      const hour = new Date().getHours();
      if (hour >= 20 || hour < 6) {
        document.body.classList.add('theme-dark');
      } else {
        document.body.classList.remove('theme-dark');
      }
    };

    updateTheme();
    const themeInterval = setInterval(updateTheme, 60000);

    // Hide cursor after 5 seconds of no movement (kiosk mode)
    let timeout;
    const handleMouseMove = () => {
      document.body.classList.remove('hide-cursor');
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        document.body.classList.add('hide-cursor');
      }, 5000);
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      clearInterval(interval);
      clearInterval(themeInterval);
      clearTimeout(timeout);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const fetchWeather = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/complete`);

      if (response.data.success) {
        setWeatherData(response.data.data);
        setLastUpdate(new Date());
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching weather:', err);
      setError('Unable to fetch weather data');
    } finally {
      setLoading(false);
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

  if (error) {
    return (
      <div className="app error">
        <div className="error-icon">⚠️</div>
        <h2>{error}</h2>
        <p>Check your backend server is running</p>
        <button onClick={fetchWeather}>Retry</button>
      </div>
    );
  }

  return (
    <Router>
      <div className="app">
        <div className="container">
          <Routes>
            <Route
              path="/"
              element={<Dashboard weatherData={weatherData} lastUpdate={lastUpdate} />}
            />
            <Route
              path="/analytics/:metric"
              element={<Analytics />}
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
```

## 3. Restart the development server

```bash
npm start
```

Now clicking on any metric tile will navigate to its analytics page!

## File Structure

The routing setup uses:
- `/src/pages/Dashboard.js` - Main dashboard view (already created)
- `/src/pages/Analytics.js` - Analytics detail pages (already created)
- `/src/pages/Analytics.css` - Analytics page styles (already created)

These files are already created and ready to use.
