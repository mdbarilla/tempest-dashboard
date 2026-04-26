import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { shouldShowGardenNav } from '../utils/gardenNav';
import {
  addDays,
  buildFreezingGardenSentence,
  formatMonthDay,
  lastFrostDateForZone6b,
} from '../utils/gardenForecast';
import WhatsGrowing from './WhatsGrowing';
import './CurrentWeather.css';

const GardenLeafIcon = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <path d="M3.707,21.707,6.674,18.74a7.533,7.533,0,0,0,4.2,1.23,8.888,8.888,0,0,0,6.332-2.763C21.02,13.4,21.958,3.509,22,3.09a1,1,0,0,0-.289-.8A1.028,1.028,0,0,0,20.91,2c-.419.038-10.3.976-14.117,4.789C3.224,10.362,3.579,14.857,5.26,17.326L2.293,20.293a1,1,0,0,0,1.414,1.414Zm4.5-13.5c2.584-2.583,8.956-3.7,11.65-4.063-.365,2.693-1.477,9.062-4.064,11.649C13,18.581,9.848,18.25,8.125,17.289l4.582-4.582a1,1,0,0,0-1.414-1.414L6.712,15.874C5.751,14.151,5.42,10.994,8.207,8.207Z" />
  </svg>
);

const FrostSnowIcon = ({ size = 17, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
    focusable="false"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="2" x2="22" y1="12" y2="12" />
    <line x1="12" x2="12" y1="2" y2="22" />
    <path d="m20 16-4-4 4-4" />
    <path d="m4 8 4 4-4 4" />
    <path d="m16 4-4 4-4-4" />
    <path d="m8 20 4-4 4 4" />
  </svg>
);

/**
 * Garden band below 10-day forecast: frost/seasonal note + greenhouse carousel.
 *
 * @todo REFACTOR (pinned 1.5.8 draft): Carousel/header visibility, background tint, and frost
 *   image still need a dedicated pass (stacking, nav gating, API/proxy, theming). Do not treat
 *   as stable until addressed. See repo `docs/drafts/RELEASE-1.5.8-DRAFT.md` → Follow-up / debugging.
 */
export default function GardenDashboardSection({ forecast }) {
  const location = useLocation();
  const currentYear = new Date().getFullYear();
  const seasonalDismissKey = `garden:forecast_banner_dismissed:${currentYear}`;
  const [seasonalDismissed, setSeasonalDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(seasonalDismissKey) === '1';
    } catch {
      return false;
    }
  });

  const showGardenNav = shouldShowGardenNav(location.pathname, location.search);
  const freezingGardenSentence = buildFreezingGardenSentence(forecast);
  const frost = lastFrostDateForZone6b(currentYear);
  const frostWindowStart = addDays(frost, -30);
  const now = new Date();
  const inPreFrostWindow = now >= frostWindowStart && now <= frost;

  const hasFreezeRisk = Boolean(freezingGardenSentence);
  const shouldShowSeasonal = inPreFrostWindow && !seasonalDismissed;
  const showGardenBanner = showGardenNav && (hasFreezeRisk || shouldShowSeasonal);

  const bannerText = hasFreezeRisk
    ? freezingGardenSentence
    : `Average last frost for Zone 6b is ${formatMonthDay(frost)}. We're in the 30‑day window—keep frost‑tender seedlings protected and plan hardening‑off around overnight lows.`;

  if (!showGardenNav) return null;

  return (
    <section
      className={`garden-forecast-section${hasFreezeRisk ? ' garden-forecast-section--frost-advisory' : ''}`}
      aria-label="In the garden"
    >
      <div className="garden-forecast-inner">
        <header className="garden-dash-header">
          <h2 className="garden-dash-title">In the Garden</h2>
          <Link to="/garden" className="garden-dash-cta">
            View garden →
          </Link>
        </header>
        {showGardenBanner && (
          <div className="garden-forecast-banner-wrap" aria-live="polite">
            <div
              className="garden-forecast-banner"
              role="note"
              aria-label={hasFreezeRisk ? 'Frost likely' : 'Gardening forecast'}
            >
              <div className="garden-forecast-banner-left">
                <div className="garden-forecast-banner-title">
                  {hasFreezeRisk ? (
                    <>
                      <span className="garden-forecast-banner-icon garden-forecast-banner-icon--frost" aria-hidden>
                        <FrostSnowIcon size={17} />
                      </span>
                      <span>Frost likely</span>
                    </>
                  ) : (
                    <>
                      <span className="garden-forecast-banner-icon" aria-hidden>
                        <GardenLeafIcon size={16} />
                      </span>
                      <span>Gardening forecast</span>
                    </>
                  )}
                </div>
                <div className="garden-forecast-banner-text">{bannerText}</div>
              </div>
              {!hasFreezeRisk && inPreFrostWindow && (
                <div className="garden-forecast-banner-actions">
                  <button
                    type="button"
                    className="garden-forecast-banner-dismiss"
                    aria-label="Dismiss gardening forecast"
                    title="Dismiss"
                    onClick={() => {
                      try {
                        sessionStorage.setItem(seasonalDismissKey, '1');
                      } catch {
                        /* ignore */
                      }
                      setSeasonalDismissed(true);
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        <WhatsGrowing variant="dashboard" />
      </div>
    </section>
  );
}
