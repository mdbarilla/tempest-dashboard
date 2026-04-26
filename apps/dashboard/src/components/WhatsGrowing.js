/**
 * Now Growing — horizontal seed thumbnail carousel.
 * Renders when Garden is enabled (local network default, or ?garden=1 / prior enable).
 * Links to /garden (separate garden app).
 */
import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { shouldShowGardenNav } from '../utils/gardenNav';
import './WhatsGrowing.css';

const GARDEN_API = '/api/garden';

/** Split "Celery – Tall Utah 52-70R" into { primary: "Celery", secondary: "Tall Utah 52-70R" } */
function parseName(varietyName) {
  const match = varietyName.match(/^(.+?)\s+[–—-]\s+(.+)$/);
  if (match) return { primary: match[1].trim(), secondary: match[2].trim() };
  return { primary: varietyName, secondary: null };
}

export default function WhatsGrowing({ variant = 'standalone' } = {}) {
  const location = useLocation();
  const [seeds, setSeeds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const showGarden = shouldShowGardenNav(location.pathname, location.search);

  useEffect(() => {
    if (!showGarden) return;
    setLoading(true);
    setFetchError(false);
    axios
      .get(`${GARDEN_API}/whats-growing?limit=20&_=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache' },
      })
      .then((r) => setSeeds(r.data?.data || []))
      .catch(() => {
        setSeeds([]);
        setFetchError(true);
      })
      .finally(() => setLoading(false));
  }, [showGarden]);

  if (!showGarden) return null;

  if (variant === 'dashboard' && loading) {
    return (
      <div className="garden-now-growing garden-now-growing--state">
        <div className="now-growing-header now-growing-header--dashboard">
          <div className="now-growing-header-left">
            <h3 className="now-growing-title">Now Growing</h3>
          </div>
        </div>
        <p className="now-growing-state-msg" aria-live="polite">
          Loading greenhouse…
        </p>
      </div>
    );
  }

  if (variant === 'dashboard' && !loading && seeds.length === 0) {
    return (
      <div className="garden-now-growing garden-now-growing--state">
        <div className="now-growing-header now-growing-header--dashboard">
          <div className="now-growing-header-left">
            <h3 className="now-growing-title">Now Growing</h3>
          </div>
        </div>
        <p className="now-growing-state-msg">
          {fetchError
            ? 'Could not reach the greenhouse. Check that the backend is running.'
            : 'No active seedlings to show. Open the garden app to add or start seeds.'}
        </p>
      </div>
    );
  }

  if (loading) return null;
  if (seeds.length === 0) return null;

  const body = (
    <>
      <div className={`now-growing-header${variant === 'dashboard' ? ' now-growing-header--dashboard' : ''}`}>
        <div className="now-growing-header-left">
          <h3 className="now-growing-title">Now Growing</h3>
          {variant !== 'dashboard' && (
            <span className="now-growing-subhed">In the greenhouse</span>
          )}
        </div>
        {variant !== 'dashboard' && (
          <Link to="/garden" className="now-growing-link">
            View garden →
          </Link>
        )}
      </div>
      <div className="now-growing-carousel">
        {seeds.map((seed) => {
          const imgSrc = seed.image_path
            ? `/api/garden/images/${seed.image_path}`
            : null;
          const { primary, secondary } = parseName(seed.variety_name);
          return (
            <Link
              key={seed.id}
              to={`/garden/seed/${seed.id}`}
              className="now-growing-card"
              title={seed.variety_name}
            >
              <div className="now-growing-thumb">
                {imgSrc ? (
                  <img src={imgSrc} alt={seed.variety_name} className="now-growing-img" />
                ) : (
                  <div className="now-growing-placeholder">🌱</div>
                )}
              </div>
              <div className="now-growing-body">
                <span className="now-growing-primary">{primary}</span>
                {secondary && <span className="now-growing-secondary">{secondary}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );

  if (variant === 'dashboard') {
    return <div className="garden-now-growing">{body}</div>;
  }

  return <section className="now-growing-section">{body}</section>;
}
