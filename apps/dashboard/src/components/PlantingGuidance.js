/**
 * Planting guidance from /api/weather/planting-guidance (Tempest + NWS merged lows).
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './PlantingGuidance.css';

const API = '/api/weather/planting-guidance';

export default function PlantingGuidance() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(API)
      .then((r) => {
        if (!cancelled && r.data?.success && r.data?.data) setData(r.data.data);
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (err || !data) return null;

  const { safe_to_plant: safe, frost_risk: risk, warming_trend: warm } = data;
  if (!safe) return null;

  const showEligible = safe.eligible;
  const showRisk = risk?.level && risk.level !== 'none';
  const showWarm = warm?.active;
  const streak = safe.freeze_free_days_ahead ?? 0;
  const showProgress =
    !showEligible && streak > 0 && streak < 10 && Number.isFinite(streak);
  if (!showEligible && !showRisk && !showWarm && !showProgress) return null;

  return (
    <section className="planting-guidance" aria-label="Planting guidance">
      {showWarm && !showEligible && (
        <p className="planting-guidance__line planting-guidance__trend">{warm.summary}</p>
      )}
      {showProgress && (
        <p className="planting-guidance__line planting-guidance__progress">
          Forecast shows {streak} consecutive night{s(streak)} above freezing from here—need 10 for the safe-to-plant signal.
        </p>
      )}
      {showRisk && risk.next_freeze_date && (
        <p className="planting-guidance__line planting-guidance__risk">
          Freeze possible by{' '}
          <time dateTime={risk.next_freeze_date}>
            {formatShort(risk.next_freeze_date)}
          </time>
          {risk.low_temp_f != null ? ` (low ~${risk.low_temp_f}°F)` : ''}.
        </p>
      )}
      {showEligible && (
        <p className="planting-guidance__line planting-guidance__safe">
          <strong>Safe to plant out</strong> — next 10 nights stay above freezing in current forecasts
          {safe.window_start ? ` (from ${formatShort(safe.window_start)})` : ''}.
        </p>
      )}
      {safe.disclaimer && (
        <p className="planting-guidance__disclaimer">{safe.disclaimer}</p>
      )}
    </section>
  );
}

function s(n) {
  return n === 1 ? '' : 's';
}

function formatShort(isoDate) {
  if (!isoDate) return '';
  const d = typeof isoDate === 'string' ? isoDate.slice(0, 10) : isoDate;
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return isoDate;
  }
}
