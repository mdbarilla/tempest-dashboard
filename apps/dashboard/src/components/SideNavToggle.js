import React from 'react';
import { useSideNav } from '../context/SideNavContext';
import './SideNav.css';

const HamburgerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </svg>
);

export default function SideNavToggle() {
  const { enabled, open, toggle } = useSideNav();
  if (!enabled) return null;
  return (
    <button
      type="button"
      className="side-nav-toggle"
      onClick={toggle}
      aria-label={open ? 'Hide navigation' : 'Show navigation'}
      aria-pressed={open}
      title={open ? 'Hide navigation' : 'Show navigation'}
    >
      <HamburgerIcon />
    </button>
  );
}

