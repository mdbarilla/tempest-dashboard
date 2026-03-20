import React from 'react';
import UnifiedMenu from './UnifiedMenu';
import { useAppMenu } from '../context/AppMenuContext';
import './SharedHeaderRow.css';

/**
 * Shared header row: "Updated {time}" + menu icon.
 * Used across Dashboard, Conditions, History, Ask.
 * Uses AppMenuContext for menu callbacks.
 */
const SharedHeaderRow = () => {
  const { lastUpdate, onEditCondition, onLogPrecipitation, onChangeTheme, onViewTempestStation, isLocal } = useAppMenu();
  const formattedTime = lastUpdate instanceof Date
    ? lastUpdate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    : null;
  return (
    <div className="shared-header-row">
      {formattedTime && (
        <span className="shared-header-updated">
          Updated {formattedTime}
        </span>
      )}
      <UnifiedMenu
        onEditCondition={onEditCondition}
        onLogPrecipitation={onLogPrecipitation}
        onChangeTheme={onChangeTheme}
        onViewTempestStation={onViewTempestStation}
        isLocal={isLocal}
      />
    </div>
  );
};

SharedHeaderRow.displayName = 'SharedHeaderRow';

export default SharedHeaderRow;
