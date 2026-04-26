/**
 * GardenFrame — full-screen iframe for the garden SPA.
 * Route /garden/* forwards the splat to the iframe (e.g. /garden/seed/123).
 *
 * Local dev: garden CRA runs on port 3002 (see Garden/app/package.json).
 * Pi / production: same origin under /garden/.
 *
 * postMessage bridge:
 *   { type: 'garden-modal-open' | 'garden-modal-close' } → bottom nav visibility
 * Parent → iframe: { type: 'towerhill-parent-theme', themeDark } → match dashboard theme
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import './GardenFrame.css';

const DEFAULT_GARDEN_DEV_ORIGIN = 'http://localhost:3002';

function buildGardenIframeSrc(splat) {
  const path = splat ? String(splat).replace(/^\/+/, '') : '';
  const h = window.location.hostname;

  if (h === 'localhost' || h === '127.0.0.1') {
    const base = (process.env.REACT_APP_GARDEN_DEV_ORIGIN || DEFAULT_GARDEN_DEV_ORIGIN).replace(/\/$/, '');
    return path ? `${base}/${path}` : `${base}/`;
  }

  const origin = window.location.origin.replace(/\/$/, '');
  return path ? `${origin}/garden/${path}` : `${origin}/garden/`;
}

function postThemeToIframe(iframe, iframeSrc, themeDark) {
  if (!iframe?.contentWindow) return;
  try {
    const targetOrigin = new URL(iframeSrc).origin;
    iframe.contentWindow.postMessage(
      { type: 'towerhill-parent-theme', themeDark: Boolean(themeDark) },
      targetOrigin
    );
  } catch {
    // ignore
  }
}

export default function GardenFrame() {
  const { '*': splat } = useParams();
  const iframeRef = useRef(null);

  const isInsideIframe = window.self !== window.top;

  const iframeSrc = useMemo(() => {
    if (isInsideIframe) return '';
    return buildGardenIframeSrc(splat);
  }, [splat, isInsideIframe]);

  // Chrome around iframe uses garden palette; restore when leaving route.
  useEffect(() => {
    if (isInsideIframe) return;
    document.body.classList.add('route-garden');
    return () => {
      document.body.classList.remove('route-garden');
    };
  }, [isInsideIframe]);

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

  // Sync dashboard light/dark to iframe (separate origin in dev).
  useEffect(() => {
    if (isInsideIframe || !iframeSrc) return;

    const iframe = iframeRef.current;
    const send = () => postThemeToIframe(iframe, iframeSrc, document.body.classList.contains('theme-dark'));

    const onLoad = () => {
      requestAnimationFrame(send);
    };

    if (iframe) iframe.addEventListener('load', onLoad);

    const mo = new MutationObserver(send);
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    return () => {
      if (iframe) iframe.removeEventListener('load', onLoad);
      mo.disconnect();
    };
  }, [isInsideIframe, iframeSrc]);

  if (isInsideIframe) return null;

  return (
    <div className="garden-frame-wrap">
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        className="garden-frame"
        title="Garden"
      />
    </div>
  );
}
