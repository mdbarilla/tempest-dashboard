import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import WeatherIcon from '../components/WeatherIcon';
import './HistoryPage.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/weather';

function toLocalDateInputValue(dateLike = new Date()) {
  const d = new Date(dateLike);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isNightForHour(hourKey) {
  const d = new Date(hourKey * 1000);
  const h = d.getHours();
  return h >= 18 || h < 6;
}

function getMinDate() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return toLocalDateInputValue(d);
}

function getMaxDate() {
  const d = new Date();
  d.setDate(d.getDate() + 10);
  return toLocalDateInputValue(d);
}

const HistoryPage = ({ lastUpdate }) => {
  const { date: paramDate } = useParams();
  const navigate = useNavigate();
  const today = toLocalDateInputValue();
  const initialDate = paramDate || today;

  const [date, setDate] = useState(initialDate);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (paramDate && paramDate !== date) {
      setDate(paramDate);
    }
  }, [paramDate, date]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    axios
      .get(`${API_BASE_URL}/hourly/${date}`, { timeout: 10000 })
      .then((res) => {
        if (res.data?.success) {
          setData(res.data.data);
        } else {
          setError('No data returned');
        }
      })
      .catch((err) => {
        setError(err.response?.data?.error || err.message);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [date]);

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setDate(newDate);
    navigate(newDate === today ? '/history' : `/history/${newDate}`, { replace: true });
  };

  const lastMainView = localStorage.getItem('lastMainView') || 'dashboard';
  const mainLabel = lastMainView === 'currently' ? 'Currently' : 'Dashboard';
  const mainPath = lastMainView === 'currently' ? '/conditions' : '/';

  return (
    <div className="history-page">
      <header className="history-header">
        <div className="history-header-inner">
          <h1 className="history-title">Tower Hill&nbsp;&nbsp;<span className="history-title-city">Wayland</span></h1>
          <div className="history-header-row">
            <span className="page-and-update-mobile">
              History • {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}` : '—'}
            </span>
            <span className="history-nav-desktop">
              <p className="history-updated">
                {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : '—'}
              </p>
              <span className="history-nav-sep" aria-hidden="true">•</span>
              <Link to={mainPath} className="history-nav-link">{mainLabel}</Link>
              <span className="history-nav-sep" aria-hidden="true">•</span>
              <span className="header-nav-active">History</span>
              <span className="history-nav-sep" aria-hidden="true">•</span>
              <Link to="/chat" className="history-nav-link">Ask</Link>
            </span>
          </div>
        </div>
        <div className="history-date-wrap">
          <input
            id="history-date-picker"
            type="date"
            value={date}
            min={getMinDate()}
            max={getMaxDate()}
            onChange={handleDateChange}
            className="history-date-input"
            aria-label="Select date"
          />
        </div>
      </header>

      {loading && (
        <div className="history-loading">
          <div className="loading-spinner"></div>
          <p>Loading hourly data...</p>
        </div>
      )}

      {error && (
        <div className="history-error">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && data && (() => {
        const hasWeatherData = (r) => !!(r.conditions ?? r.tempF ?? r.feelsLikeF ?? r.humidity ?? r.windSpeed ?? r.pressureInHg ?? r.precipPct ?? r.precipAmount);
        const filtered = data.filter((r) => hasWeatherData(r));
        const nowUnix = Math.floor(Date.now() / 1000);
        const observedRows = filtered.filter((row) => row.timestamp <= nowUnix);
        const forecastRows = filtered.filter((row) => row.timestamp > nowUnix);
        const COLUMN_COUNT = 9;
        return (
          <div className="history-table-wrap">
            <table className="history-table" role="grid" aria-label="Hourly weather">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Conditions</th>
                  <th scope="col">Temp.</th>
                  <th scope="col">Feels Like</th>
                  <th scope="col">Humidity</th>
                  <th scope="col">Wind</th>
                  <th scope="col">Pressure</th>
                  <th scope="col">Precip</th>
                  <th scope="col">Amount</th>
                </tr>
              </thead>
              <tbody>
                {observedRows.length > 0 && (
                  <tr className="history-source-row history-source-row--observed">
                    <td colSpan={COLUMN_COUNT}>Observed</td>
                  </tr>
                )}
                {observedRows.map((row, i) => (
                  <tr
                    key={`obs-${row.timestamp || i}`}
                    className="history-row-observed"
                    style={{ animationDelay: `${i * 0.03}s` }}
                  >
                    <td className="history-cell-time">{row.time}</td>
                    <td className="history-cell-conditions">
                      <span className="history-conditions-inner">
                        {row.conditions ? (
                          <>
                            <WeatherIcon
                              condition={row.conditions}
                              size={24}
                              className="history-condition-icon"
                              isNight={isNightForHour(row.timestamp)}
                            />
                            <span>{row.conditions}</span>
                            {row.corrected && <span className="history-edited-badge" title={`Original: ${row.originalCondition || '—'}`}>edited</span>}
                          </>
                        ) : (
                          <span className="history-cell-empty">—</span>
                        )}
                      </span>
                    </td>
                    <td className="history-cell-temp">{row.tempF != null ? `${row.tempF} °F` : '—'}</td>
                    <td className="history-cell-feels">{row.feelsLikeF != null ? `${row.feelsLikeF} °F` : '—'}</td>
                    <td>{row.humidity != null ? `${row.humidity}%` : '—'}</td>
                    <td className="history-cell-wind">
                      {row.windSpeed != null && row.windDirection
                        ? `${row.windSpeed} mph ${row.windDirection}`
                        : row.windSpeed != null
                          ? `${row.windSpeed} mph`
                          : '—'}
                    </td>
                    <td>{row.pressureInHg != null ? `${row.pressureInHg} in` : '—'}</td>
                    <td>{row.precipPct != null ? `${row.precipPct}%` : '—'}</td>
                    <td>
                      {row.precipAmount != null ? `${row.precipAmount} in` : '—'}
                      {row.manualPrecip && <><br /><span className="history-edited-badge" title={`Manual: ${row.manualPrecip.amountInches} in ${row.manualPrecip.type || ''}`}>logged</span></>}
                    </td>
                  </tr>
                ))}
                {forecastRows.length > 0 && (
                  <tr className="history-source-row history-source-row--forecast">
                    <td colSpan={COLUMN_COUNT}>Forecast</td>
                  </tr>
                )}
                {forecastRows.map((row, i) => (
                  <tr
                    key={`fc-${row.timestamp || i}`}
                    className="history-row-forecast"
                    style={{ animationDelay: `${(observedRows.length + i) * 0.03}s` }}
                  >
                    <td className="history-cell-time">{row.time}</td>
                    <td className="history-cell-conditions">
                      <span className="history-conditions-inner">
                        {row.conditions ? (
                          <>
                            <WeatherIcon
                              condition={row.conditions}
                              size={24}
                              className="history-condition-icon"
                              isNight={isNightForHour(row.timestamp)}
                            />
                            <span>{row.conditions}</span>
                            {row.corrected && <span className="history-edited-badge" title={`Original: ${row.originalCondition || '—'}`}>edited</span>}
                          </>
                        ) : (
                          <span className="history-cell-empty">—</span>
                        )}
                      </span>
                    </td>
                    <td className="history-cell-temp">{row.tempF != null ? `${row.tempF} °F` : '—'}</td>
                    <td className="history-cell-feels">{row.feelsLikeF != null ? `${row.feelsLikeF} °F` : '—'}</td>
                    <td>{row.humidity != null ? `${row.humidity}%` : '—'}</td>
                    <td className="history-cell-wind">
                      {row.windSpeed != null && row.windDirection
                        ? `${row.windSpeed} mph ${row.windDirection}`
                        : row.windSpeed != null
                          ? `${row.windSpeed} mph`
                          : '—'}
                    </td>
                    <td>{row.pressureInHg != null ? `${row.pressureInHg} in` : '—'}</td>
                    <td>{row.precipPct != null ? `${row.precipPct}%` : '—'}</td>
                    <td>
                      {row.precipAmount != null ? `${row.precipAmount} in` : '—'}
                      {row.manualPrecip && <><br /><span className="history-edited-badge" title={`Manual: ${row.manualPrecip.amountInches} in ${row.manualPrecip.type || ''}`}>logged</span></>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
};

export default HistoryPage;
