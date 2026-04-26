import React from 'react';

export const SideNavContext = React.createContext(null);

export function useSideNav() {
  const ctx = React.useContext(SideNavContext);
  return ctx || { enabled: false, open: false, toggle: () => {} };
}

