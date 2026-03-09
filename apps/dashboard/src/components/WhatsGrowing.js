/**
 * What's Growing — garden thumbnails section.
 * Only renders when ?garden=1 is in the URL.
 * Links to /garden (separate garden app).
 */
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';

const GARDEN_API = '/api/garden';

export default function WhatsGrowing() {
  const location = useLocation();
  const [seeds, setSeeds] = useState([]);
  const [loading, setLoading] = useState(false);

  const showGarden = new URLSearchParams(location.search).get('garden') === '1';

  useEffect(() => {
    if (!showGarden) return;
    setLoading(true);
    axios
      .get(`${GARDEN_API}/whats-growing?limit=12`)
      .then((r) => setSeeds(r.data?.data || []))
      .catch(() => setSeeds([]))
      .finally(() => setLoading(false));
  }, [showGarden]);

  if (!showGarden || loading) return null;
  if (seeds.length === 0) return null;

  const gardenHref = `${window.location.origin}/garden`;

  return (
    <section className="whats-growing" style={styles.section}>
      <div style={styles.header}>
        <h3 style={styles.title}>What&apos;s growing</h3>
        <a href={gardenHref} style={styles.link}>
          View garden →
        </a>
      </div>
      <div style={styles.grid}>
        {seeds.slice(0, 12).map((seed) => {
          const imgSrc = seed.image_path
            ? `/api/garden/images/${seed.image_path}`
            : null;
          return (
            <a
              key={seed.id}
              href={`${gardenHref}/seed/${seed.id}`}
              style={styles.thumb}
              title={seed.variety_name}
            >
              {imgSrc ? (
                <img src={imgSrc} alt={seed.variety_name} style={styles.img} />
              ) : (
                <div style={styles.placeholder}>🌱</div>
              )}
            </a>
          );
        })}
      </div>
    </section>
  );
}

const styles = {
  section: {
    marginTop: 'var(--section-gap, 2rem)',
    paddingTop: 'var(--space-5, 1.5rem)',
    borderTop: '1px solid var(--border-light, rgba(0,0,0,0.1))'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--space-3, 0.75rem)'
  },
  title: {
    fontSize: 'var(--font-size-base, 1rem)',
    fontWeight: 'var(--weight-semibold, 600)',
    color: 'var(--text-primary)'
  },
  link: {
    fontSize: 'var(--font-size-secondary, 0.875rem)',
    color: 'var(--accent-blue)',
    textDecoration: 'none'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
    gap: 'var(--space-2, 0.5rem)'
  },
  thumb: {
    aspectRatio: '1',
    borderRadius: 'var(--radius-sm, 0.25rem)',
    overflow: 'hidden',
    background: 'var(--bg-secondary)',
    display: 'block'
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  placeholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem'
  }
};
