import React, { useState, useRef, useEffect } from 'react';
import './UnifiedMenu.css';

/** Menu icon (three dots horizontal •••) */
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden>
    <circle cx="6" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="18" cy="12" r="1.5" />
  </svg>
);

/** Simple pencil only */
const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

const DropletIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
  </svg>
);

/** Contrast (light/dark) icon — circle half light, half dark */
const ThemeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor" stroke="none" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const UnifiedMenu = ({
  onEditCondition,
  onLogPrecipitation,
  onChangeTheme,
  onViewTempestStation,
  isLocal,
}) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [open]);

  const handleEditCondition = () => {
    setOpen(false);
    onEditCondition?.();
  };

  const handleLogPrecipitation = () => {
    setOpen(false);
    onLogPrecipitation?.();
  };

  const handleChangeTheme = () => {
    setOpen(false);
    onChangeTheme?.();
  };

  const handleViewTempestStation = () => {
    setOpen(false);
    onViewTempestStation?.();
  };

  return (
    <div className="unified-menu" ref={menuRef}>
      <button
        type="button"
        className="unified-menu-trigger"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label="Menu"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <MenuIcon />
      </button>
      {open && (
        <div className="unified-menu-dropdown" role="menu">
          {isLocal && (
            <>
              <button type="button" className="unified-menu-item" role="menuitem" onClick={handleEditCondition}>
                <span>Edit condition</span>
                <EditIcon />
              </button>
              <button type="button" className="unified-menu-item" role="menuitem" onClick={handleLogPrecipitation}>
                <span>Log precipitation</span>
                <DropletIcon />
              </button>
            </>
          )}
          <button type="button" className="unified-menu-item" role="menuitem" onClick={handleChangeTheme}>
            <span>Change theme</span>
            <ThemeIcon />
          </button>
          <button type="button" className="unified-menu-item" role="menuitem" onClick={handleViewTempestStation}>
            <span>View Tempest Station</span>
            <ExternalLinkIcon />
          </button>
        </div>
      )}
    </div>
  );
};

export default UnifiedMenu;
