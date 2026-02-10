import React from 'react';
import Modal from './Modal';
import './StormWarning.css';

const StormWarningDetail = ({ alerts, onClose }) => {
  if (!alerts || alerts.length === 0) return null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      ariaLabelledBy="storm-warning-title"
      className="storm-warning-detail"
    >
      <div className="storm-warning-header">
          <h2 id="storm-warning-title">Weather alerts</h2>
          <button type="button" className="storm-warning-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="storm-warning-body">
          {alerts.map((a, i) => (
            <div key={i} className="storm-warning-block">
              <div className="storm-warning-event">{a.event}</div>
              {a.headline && <div className="storm-warning-headline">{a.headline}</div>}
              {a.onset && <div className="storm-warning-meta">In effect: {formatMeta(a.onset, a.expires)}</div>}
              {a.description && (
                <div
                  className="storm-warning-description"
                  dangerouslySetInnerHTML={{ __html: formatDescription(a.description) }}
                />
              )}
            </div>
          ))}
        </div>
    </Modal>
  );
};

function formatMeta(onset, expires) {
  const o = onset ? new Date(onset) : null;
  const e = expires ? new Date(expires) : null;
  const fmt = (d) => d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  if (o && e) return `${fmt(o)} – ${fmt(e)}`;
  if (e) return `Until ${fmt(e)}`;
  if (o) return `From ${fmt(o)}`;
  return null;
}

function formatDescription(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/\* /g, '• ')
    .replace(/\n/g, '<br/>');
}

export default StormWarningDetail;
