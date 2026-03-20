/**
 * GardenFrame — renders the garden SPA in a fixed full-screen iframe.
 * The route is /garden/* so the splat path is forwarded to the iframe src,
 * allowing seed deep-links (e.g. /garden/seed/123) to open the correct page.
 *
 * postMessage bridge: the garden app can send
 *   { type: 'garden-modal-open' }  → hides the bottom nav
 *   { type: 'garden-modal-close' } → restores the bottom nav
 */
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import SharedHeaderRow from './SharedHeaderRow';
import './GardenFrame.css';

export default function GardenFrame() {
  const { '*': splat } = useParams();

  // Detect recursive load: in dev the iframe src resolves to this same React app.
  // In production the iframe loads the separate garden SPA so this is always false there.
  const isInsideIframe = window.self !== window.top;

  const src = `${window.location.origin}/garden/${splat || ''}`;

  // Always run hooks unconditionally (React rules), guard the side-effect body instead.
  useEffect(() => {
    if (isInsideIframe) return;
    const handleMessage = (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'garden-modal-open') {
        document.body.classList.add('garden-modal-open');
      }
      if (e.data?.type === 'garden-modal-close') {
        document.body.classList.remove('garden-modal-open');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      document.body.classList.remove('garden-modal-open');
    };
  }, [isInsideIframe]);

  // Bail out if we're inside an iframe — prevents recursive self-loading in dev.
  if (isInsideIframe) return null;

  // In dev on localhost the garden SPA isn't running — show a placeholder instead
  // of a blank iframe. On the Pi (towerhill.local) the real garden SPA loads.
  const isDev = window.location.hostname === 'localhost';

  return (
    <div className="garden-frame-wrap">
      <header className="garden-frame-header">
        <div className="garden-frame-location">
          <h1 className="garden-frame-title">Tower Hill&nbsp;&nbsp;<span className="garden-frame-city">Wayland</span></h1>
          <div className="garden-frame-header-row">
            <SharedHeaderRow />
          </div>
        </div>
      </header>
      {isDev ? (
        <div className="garden-frame-dev">
          <p className="garden-frame-dev-label">Garden</p>
          <p className="garden-frame-dev-note">
            The garden app is available at{' '}
            <a href="http://towerhill.local/garden" target="_blank" rel="noreferrer">
              towerhill.local/garden
            </a>
            . It will load here when accessed from the Pi.
          </p>
        </div>
      ) : (
        <iframe
          src={src}
          className="garden-frame"
          title="Garden"
        />
      )}
    </div>
  );
}
