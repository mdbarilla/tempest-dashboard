import React, { useEffect, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSideNav } from '../context/SideNavContext';
import { shouldShowGardenNav } from '../utils/gardenNav';
import './SideNav.css';

const DashboardIcon = () => (
  <svg width="22" height="22" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M8.44365 41.5564C4.46243 37.5751 2 32.0751 2 26C2 13.8497 11.8497 4 24 4C36.1503 4 46 13.8497 46 26C46 32.0751 43.5376 37.5751 39.5564 41.5564" />
    <path d="M14.1005 35.8995C11.567 33.366 10 29.866 10 26C10 18.268 16.268 12 24 12" />
    <path d="M24 26V18" />
  </svg>
);

const CurrentlyIcon = () => (
  <svg width="22" height="22" viewBox="0 0 32 32" fill="currentColor" stroke="none" aria-hidden>
    <path d="M16,17.3V6c0-2.2-1.8-4-4-4S8,3.8,8,6v11.3c-1.9,1.3-3,3.5-3,5.7c0,3.9,3.1,7,7,7s7-3.1,7-7C19,20.7,17.9,18.6,16,17.3z M12,27c-2.2,0-4-1.8-4-4c0-1.9,1.3-3.4,3-3.9V13c0-0.6,0.4-1,1-1s1,0.4,1,1v6.1c1.7,0.4,3,2,3,3.9C16,25.2,14.2,27,12,27z" />
    <path d="M20,7h5c0.6,0,1-0.4,1-1s-0.4-1-1-1h-5c-0.6,0-1,0.4-1,1S19.4,7,20,7z" />
    <path d="M20,11h2c0.6,0,1-0.4,1-1s-0.4-1-1-1h-2c-0.6,0-1,0.4-1,1S19.4,11,20,11z" />
    <path d="M25,13h-5c-0.6,0-1,0.4-1,1s0.4,1,1,1h5c0.6,0,1-0.4,1-1S25.6,13,25,13z" />
    <path d="M22,17h-2c-0.6,0-1,0.4-1,1s0.4,1,1,1h2c0.6,0,1-0.4,1-1S22.6,17,22,17z" />
  </svg>
);

const HistoryIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const GardenIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M3.707,21.707,6.674,18.74a7.533,7.533,0,0,0,4.2,1.23,8.888,8.888,0,0,0,6.332-2.763C21.02,13.4,21.958,3.509,22,3.09a1,1,0,0,0-.289-.8A1.028,1.028,0,0,0,20.91,2c-.419.038-10.3.976-14.117,4.789C3.224,10.362,3.579,14.857,5.26,17.326L2.293,20.293a1,1,0,0,0,1.414,1.414Zm4.5-13.5c2.584-2.583,8.956-3.7,11.65-4.063-.365,2.693-1.477,9.062-4.064,11.649C13,18.581,9.848,18.25,8.125,17.289l4.582-4.582a1,1,0,0,0-1.414-1.414L6.712,15.874C5.751,14.151,5.42,10.994,8.207,8.207Z" />
  </svg>
);

export default function SideNav() {
  const location = useLocation();
  const pathname = location.pathname;
  const { enabled, open } = useSideNav();

  const showGarden = useMemo(() => shouldShowGardenNav(), []);

  // Apply body classes so layout can respond with pure CSS.
  useEffect(() => {
    document.body.classList.toggle('side-nav-enabled', enabled);
    document.body.classList.toggle('side-nav-open', enabled && open);
    return () => {
      document.body.classList.remove('side-nav-enabled');
      document.body.classList.remove('side-nav-open');
    };
  }, [enabled, open]);

  if (!enabled) return null;

  if (!open) return null;

  return (
    <nav className="side-nav" aria-label="Main navigation">
      <div className="side-nav-inner">
        <NavLink to="/" end className={({ isActive }) => `side-nav-item ${isActive ? 'active' : ''}`} aria-label="Dashboard">
          <span className="side-nav-icon" aria-hidden><DashboardIcon /></span>
          <span className="side-nav-label">Dashboard</span>
        </NavLink>
        <NavLink to="/conditions" className={({ isActive }) => `side-nav-item ${isActive ? 'active' : ''}`} aria-label="Currently">
          <span className="side-nav-icon" aria-hidden><CurrentlyIcon /></span>
          <span className="side-nav-label">Currently</span>
        </NavLink>
        <NavLink
          to="/history"
          className={({ isActive }) => `side-nav-item ${(isActive || pathname.startsWith('/history')) ? 'active' : ''}`}
          aria-label="History"
        >
          <span className="side-nav-icon" aria-hidden><HistoryIcon /></span>
          <span className="side-nav-label">History</span>
        </NavLink>
        {showGarden && (
          <NavLink to="/garden" className={({ isActive }) => `side-nav-item ${isActive ? 'active' : ''}`} aria-label="Garden">
            <span className="side-nav-icon" aria-hidden><GardenIcon /></span>
            <span className="side-nav-label">Garden</span>
          </NavLink>
        )}
      </div>
    </nav>
  );
}

