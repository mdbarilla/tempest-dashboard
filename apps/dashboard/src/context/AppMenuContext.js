import React from 'react';

export const AppMenuContext = React.createContext(null);

export function useAppMenu() {
  const ctx = React.useContext(AppMenuContext);
  return ctx || {};
}
