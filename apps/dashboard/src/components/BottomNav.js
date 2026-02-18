import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './BottomNav.css';

const BottomNav = () => {
  const location = useLocation();
  const pathname = location.pathname;

  const isHistory = pathname.startsWith('/history');
  const isChat = pathname.startsWith('/chat');

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <NavLink
        to="/"
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        end
      >
        <span className="bottom-nav-icon" aria-hidden>
          <svg width="24" height="24" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.44365 41.5564C4.46243 37.5751 2 32.0751 2 26C2 13.8497 11.8497 4 24 4C36.1503 4 46 13.8497 46 26C46 32.0751 43.5376 37.5751 39.5564 41.5564" />
            <path d="M14.1005 35.8995C11.567 33.366 10 29.866 10 26C10 18.268 16.268 12 24 12" />
            <path d="M24 26V18" />
          </svg>
        </span>
        <span className="bottom-nav-label">Dashboard</span>
      </NavLink>
      <NavLink
        to="/conditions"
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <span className="bottom-nav-icon" aria-hidden>
          <svg width="24" height="24" viewBox="0 0 32 32" fill="currentColor" stroke="none">
            <path d="M16,17.3V6c0-2.2-1.8-4-4-4S8,3.8,8,6v11.3c-1.9,1.3-3,3.5-3,5.7c0,3.9,3.1,7,7,7s7-3.1,7-7C19,20.7,17.9,18.6,16,17.3z M12,27c-2.2,0-4-1.8-4-4c0-1.9,1.3-3.4,3-3.9V13c0-0.6,0.4-1,1-1s1,0.4,1,1v6.1c1.7,0.4,3,2,3,3.9C16,25.2,14.2,27,12,27z" />
            <path d="M20,7h5c0.6,0,1-0.4,1-1s-0.4-1-1-1h-5c-0.6,0-1,0.4-1,1S19.4,7,20,7z" />
            <path d="M20,11h2c0.6,0,1-0.4,1-1s-0.4-1-1-1h-2c-0.6,0-1,0.4-1,1S19.4,11,20,11z" />
            <path d="M25,13h-5c-0.6,0-1,0.4-1,1s0.4,1,1,1h5c0.6,0,1-0.4,1-1S25.6,13,25,13z" />
            <path d="M22,17h-2c-0.6,0-1,0.4-1,1s0.4,1,1,1h2c0.6,0,1-0.4,1-1S22.6,17,22,17z" />
          </svg>
        </span>
        <span className="bottom-nav-label">Currently</span>
      </NavLink>
      <NavLink
        to="/history"
        className={({ isActive }) => `bottom-nav-item ${isActive || isHistory ? 'active' : ''}`}
      >
        <span className="bottom-nav-icon" aria-hidden>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </span>
        <span className="bottom-nav-label">History</span>
      </NavLink>
      <NavLink
        to="/chat"
        className={({ isActive }) => `bottom-nav-item ${isActive || isChat ? 'active' : ''}`}
      >
        <span className="bottom-nav-icon" aria-hidden>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </span>
        <span className="bottom-nav-label">Ask</span>
      </NavLink>
    </nav>
  );
};

export default BottomNav;
