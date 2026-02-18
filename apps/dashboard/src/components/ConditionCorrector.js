import React, { useState, useEffect, useCallback } from 'react';
import { ReactComponent as EditIcon } from './edit-icon.svg';
import WeatherIcon from './WeatherIcon';
import Modal from './Modal';
import './ConditionCorrector.css';

const CORRECTOR_OPEN_KEY = 'tempest-condition-corrector-open';
const CORRECTOR_SELECTION_KEY = 'tempest-condition-corrector-selection';

function getStoredCorrectorState() {
  try {
    const open = sessionStorage.getItem(CORRECTOR_OPEN_KEY) === '1';
    const selection = sessionStorage.getItem(CORRECTOR_SELECTION_KEY) || '';
    return { open, selection };
  } catch {
    return { open: false, selection: '' };
  }
}

const COMMON_CONDITIONS = [
  'Clear',
  'Partly Cloudy',
  'Mostly Cloudy',
  'Cloudy',
  'Rain',
  'Snow',
  'Freezing Rain',
  'Sleet',
  'Drizzle',
  'Fog',
  'Thunderstorm'
];

const ConditionCorrector = ({ currentCondition, temperature, timestamp, currentPrecipPct, onCorrect, onCancel, isCorrected }) => {
  const stored = getStoredCorrectorState();
  const [isOpen, setIsOpenState] = useState(stored.open);
  const [selectedCondition, setSelectedCondition] = useState(stored.selection);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setIsOpen = useCallback((open) => {
    setIsOpenState(open);
    try {
      if (open) sessionStorage.setItem(CORRECTOR_OPEN_KEY, '1');
      else {
        sessionStorage.removeItem(CORRECTOR_OPEN_KEY);
        sessionStorage.removeItem(CORRECTOR_SELECTION_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isOpen && selectedCondition) {
      try {
        sessionStorage.setItem(CORRECTOR_SELECTION_KEY, selectedCondition);
      } catch {
        // ignore
      }
    }
  }, [isOpen, selectedCondition]);

  const handleSubmit = async () => {
    if (!selectedCondition) return;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/b82af7dd-022a-4b64-a61f-996ea387a2e5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ConditionCorrector.js:handleSubmit:entry',message:'handleSubmit called',data:{selectedCondition,hasOnCorrect:typeof onCorrect==='function'},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    setIsSubmitting(true);
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b82af7dd-022a-4b64-a61f-996ea387a2e5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ConditionCorrector.js:handleSubmit:beforeAwait',message:'before await onCorrect',data:{},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      await onCorrect(selectedCondition, currentPrecipPct != null ? Number(currentPrecipPct) : null);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b82af7dd-022a-4b64-a61f-996ea387a2e5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ConditionCorrector.js:handleSubmit:afterAwait',message:'onCorrect resolved (success path)',data:{},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      setIsOpen(false);
      setSelectedCondition('');
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b82af7dd-022a-4b64-a61f-996ea387a2e5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ConditionCorrector.js:handleSubmit:catch',message:'onCorrect threw',data:{errMsg:String(error?.message||error),errName:error?.name},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.error('Error submitting correction:', error);
    } finally {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b82af7dd-022a-4b64-a61f-996ea387a2e5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ConditionCorrector.js:handleSubmit:finally',message:'finally block',data:{},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    setIsSubmitting(true);
    try {
      await onCancel();
      setIsOpen(false);
    } catch (error) {
      console.error('Error resetting correction:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {isCorrected && (
        <span className="corrected-label">Corrected</span>
      )}
      <div className="condition-corrector-wrapper">
        <button
          className="condition-btn condition-edit-btn"
          onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
          title="Edit condition"
          aria-label="Edit condition"
        >
          <EditIcon className="condition-edit-icon" aria-hidden />
        </button>
      </div>
      {isOpen && (
      <Modal
        isOpen
        onClose={() => setIsOpen(false)}
        size="md"
        ariaLabelledBy="condition-corrector-title"
        className="condition-corrector"
      >
      <div className="corrector-header">
        <div className="corrector-header-inner">
          <div className="corrector-header-left">
            <div className="corrector-icon-wrap">
              <WeatherIcon condition={currentCondition} size={28} isNight={false} className="corrector-icon" aria-hidden />
            </div>
            <h2 id="condition-corrector-title" className="corrector-label">Condition</h2>
          </div>
          <div className="corrector-header-divider" aria-hidden="true" />
          <div className="corrector-header-right">
            <div className="corrector-value-block" aria-live="polite">
              <span className="corrector-value-text">{currentCondition}</span>
            </div>
          </div>
        </div>
        <button className="close-btn" onClick={() => { setIsOpen(false); setSelectedCondition(''); }} aria-label="Close" type="button">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      <div className="corrector-body">
        <label>Select actual condition:</label>
        <div className="condition-options">
          {COMMON_CONDITIONS.map(condition => (
            <button
              key={condition}
              className={`condition-option ${selectedCondition === condition ? 'selected' : ''}`}
              onClick={() => setSelectedCondition(condition)}
              disabled={isSubmitting}
            >
              <span className="condition-option-icon" aria-hidden>
                <WeatherIcon condition={condition} size={22} isNight={false} />
              </span>
              <span className="condition-option-label">{condition}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="corrector-actions">
        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={!selectedCondition || isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </button>
        {isCorrected && (
          <button
            className="cancel-btn reset-btn"
            onClick={handleReset}
            disabled={isSubmitting}
          >
            Reset to API
          </button>
        )}
        <button
          className="cancel-btn"
          onClick={() => { setIsOpen(false); setSelectedCondition(''); }}
          disabled={isSubmitting}
        >
          Cancel
        </button>
      </div>
      </Modal>
      )}
    </>
  );
};

export default ConditionCorrector;
