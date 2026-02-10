import React from 'react';
import { ReactComponent as EditIcon } from './edit-icon.svg';
import './PrecipitationLogger.css';

/**
 * Pencil button that opens the precipitation detail view in "add" mode.
 * Add form and history live in MetricDetailView (unified precip modal).
 */
const PrecipitationLogger = ({ onAddClick }) => {
  if (!onAddClick) return null;

  return (
    <div className="precip-logger-wrapper" onClick={(e) => e.stopPropagation()}>
      <button
        className="precip-btn precip-add-btn"
        onClick={(e) => {
          e.stopPropagation();
          onAddClick();
        }}
        title="Add precipitation"
        aria-label="Add precipitation"
      >
        <EditIcon className="precip-add-icon" aria-hidden />
      </button>
    </div>
  );
};

export default PrecipitationLogger;
