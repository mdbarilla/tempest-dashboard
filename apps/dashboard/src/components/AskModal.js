import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import Modal from './Modal';
import MetricChart from './MetricChart';
import useHistoricalData from '../hooks/useHistoricalData';
import './AskModal.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/weather';

const ASK_STORAGE_KEY = 'tempest-ask-messages';

function loadStoredMessages() {
  try {
    const raw = sessionStorage.getItem(ASK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredMessages(messages) {
  try {
    sessionStorage.setItem(ASK_STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // ignore quota / private mode
  }
}

const QUICK_REPLIES = [
  { label: 'Current conditions', intent: 'current', metric: 'conditions' },
  { label: 'Summary (24h)', intent: 'summary', range: '24h' },
  { label: 'Lowest temp (7d)', intent: 'min', metric: 'temperature', range: '7d' },
  { label: 'Highest temp (7d)', intent: 'max', metric: 'temperature', range: '7d' },
  { label: 'Most precip (7d)', intent: 'peak', metric: 'precipitation', range: '7d' },
  { label: 'Temp chart (3d)', intent: 'chart', metric: 'temperature', hours: 72 },
  { label: 'Wind chart (24h)', intent: 'chart', metric: 'wind', range: '24h' },
  { label: 'Humidity trend', intent: 'trend', metric: 'humidity' },
];

function AskMessageChart({ metric, hours }) {
  const { data, loading, error } = useHistoricalData(metric, hours);
  if (loading) return <div className="ask-message-chart ask-message-chart--loading">Loading chart…</div>;
  if (error) return <div className="ask-message-chart ask-message-chart--error">{error}</div>;
  const points = data?.data;
  if (!points || !Array.isArray(points) || points.length === 0) return null;
  return (
    <div className="ask-message-chart">
      <MetricChart
        data={points}
        metric={metric}
        hours={hours}
        manualEntries={data?.manualEntries || []}
      />
    </div>
  );
}

const VALID_METRICS = ['temperature', 'wind', 'humidity', 'pressure', 'precipitation', 'solar', 'uv', 'conditions'];
const METRIC_ALIASES = {
  temp: 'temperature', temperature: 'temperature',
  wind: 'wind', humidity: 'humidity', pressure: 'pressure',
  precip: 'precipitation', precipitation: 'precipitation', rain: 'precipitation',
  solar: 'solar', uv: 'uv',
  conditions: 'conditions', condition: 'conditions', weather: 'conditions',
};

/** Parse range: default past week (7d). Supports "past N hours", "N days", 24h/3d/7d/30d. */
function parseRange(t) {
  const hoursMatch = t.match(/\b(?:past|last)\s+(\d+)\s*hours?\b/);
  if (hoursMatch) {
    const n = Math.min(720, Math.max(24, parseInt(hoursMatch[1], 10)));
    return { hours: n };
  }
  const daysMatch = t.match(/\b(?:past|last)\s+(\d+)\s*days?\b/);
  if (daysMatch) {
    const n = Math.min(30, Math.max(1, parseInt(daysMatch[1], 10)));
    return { hours: n * 24 };
  }
  if (/\b(24h|24\s*h|24\s*hour|24\s*hours?|24hr|last\s+24|today)\b/.test(t)) return { range: '24h' };
  if (/\b(3d|3\s*d|3\s*day|3\s*days?|3-day|72h|72\s*h)\b/.test(t)) return { hours: 72 };
  if (/\b(7d|7\s*d|7\s*day|7\s*days?|7-day|week)\b/.test(t)) return { range: '7d' };
  if (/\b(30d|30\s*d|30\s*day|month)\b/.test(t)) return { range: '30d' };
  return { range: '7d' };
}

/** Map common phrases to structured payload { intent, metric?, range?, hours? }. Default: past week. */
function parseAskQuery(text) {
  const t = (text || '').toLowerCase().trim();
  if (!t) return null;
  const rangePart = parseRange(t);

  const findMetric = () => {
    for (const [alias, metric] of Object.entries(METRIC_ALIASES)) {
      if (new RegExp(`\\b${alias}\\b`).test(t)) return metric;
    }
    return null;
  };

  const metric = findMetric();

  if (/\b(current|right\s+now|now)\b/.test(t) && (metric || /\b(conditions?|weather|temp|temperature|humidity|wind|pressure|precip|rain|solar|uv)\b/.test(t)))
    return { intent: 'current', metric: metric || (/\bconditions?\b|\bweather\b/.test(t) ? 'conditions' : 'temperature'), ...rangePart };
  if (/\b(lowest|min|minimum|coldest)\b/.test(t) && metric)
    return { intent: 'min', metric, ...rangePart };
  if (/\b(highest|max|maximum|hottest)\b/.test(t) && metric)
    return { intent: 'max', metric, ...rangePart };
  if (/\b(most|peak|peaked)\b/.test(t) && (metric || /\bprecip\b|\bprecipitation\b|\brain\b/.test(t)))
    return { intent: 'peak', metric: metric || 'precipitation', ...rangePart };
  if (/\b(trend|trending)\b/.test(t) && (metric === 'humidity' || /\bhumidity\b/.test(t)))
    return { intent: 'trend', metric: 'humidity' };
  if (/\b(average|avg)\b/.test(t) && metric)
    return { intent: 'average', metric, ...rangePart };
  if (/\b(summary|overview|recap)\b/.test(t))
    return { intent: 'summary', ...rangePart };
  if (/\b(chart|graph)\b/.test(t))
    return { intent: 'chart', metric: metric || 'temperature', ...rangePart };

  return null;
}

const AskModal = ({ isOpen, onClose, embedded = false }) => {
  const [messages, setMessages] = useState(loadStoredMessages);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      requestAnimationFrame(() => {
        listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [messages, loading]);

  useEffect(() => {
    if (messages.length > 0) saveStoredMessages(messages);
  }, [messages]);

  useEffect(() => {
    if (isOpen) setInputValue('');
  }, [isOpen]);

  const handleStartOver = () => {
    setMessages([]);
    saveStoredMessages([]);
  };

  const sendAsk = async (payload, label) => {
    setMessages((prev) => [...prev, { role: 'user', text: label }]);
    setLoading(true);
    try {
      const body = buildAskPayload(payload);
      const { data: res } = await axios.post(`${API_BASE_URL}/ask`, body, { timeout: 15000 });
      if (res.success && res.data) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: res.data.summary || 'No summary.',
            chart: res.data.chart || null,
          },
        ]);
      } else {
        const fallback = res?.error === 'Not Found'
          ? 'Ask service unavailable. Restart the backend (./scripts/run-local.sh) and try again.'
          : (res?.error || 'Something went wrong.');
        setMessages((prev) => [...prev, { role: 'assistant', text: fallback }]);
      }
    } catch (err) {
      const raw = err.response?.data?.error || err.message || 'Request failed.';
      const msg = err.response?.status === 404 || raw === 'Not Found'
        ? 'Ask service unavailable. Restart the backend (./scripts/run-local.sh) and try again.'
        : raw;
      setMessages((prev) => [...prev, { role: 'assistant', text: msg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickReply = (item) => {
    const payload = { intent: item.intent, range: item.range };
    if (item.metric) payload.metric = item.metric;
    if (item.hours != null) payload.hours = item.hours;
    sendAsk(payload, item.label);
  };

  const buildAskPayload = (payload) => {
    const body = { intent: payload.intent };
    if (payload.metric) body.metric = payload.metric;
    if (payload.hours != null) body.hours = payload.hours;
    else body.range = payload.range || '7d';
    return body;
  };

  const handleSubmitInput = (e) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || loading) return;
    const payload = parseAskQuery(text);
    if (payload) {
      const label = text.length > 60 ? text.slice(0, 57) + '…' : text;
      sendAsk(payload, label);
      setInputValue('');
    } else {
      setMessages((prev) => [
        ...prev,
        { role: 'user', text },
        { role: 'assistant', text: 'Try the suggestions below, or type: current temp/conditions/wind, highest/lowest temp or wind, most precip, summary, chart (24h, 3d, 7d), or humidity trend.' }
      ]);
      setInputValue('');
    }
  };

  if (!isOpen) return null;

  const content = (
    <>
      <div className="ask-modal-header">
        <div className="ask-modal-header-text">
          <h2 id="ask-modal-title" className="ask-modal-title">Ask about the weather</h2>
          <p className="ask-modal-subhead">Try: current conditions, highest temp 7d, summary, chart, or humidity trend</p>
        </div>
        <div className="ask-modal-header-actions">
          {messages.length > 0 && (
            <button type="button" className="ask-modal-start-over" onClick={handleStartOver}>
              Start over
            </button>
          )}
          {!embedded && (
            <button type="button" className="ask-modal-close" onClick={onClose} aria-label="Close">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}
        </div>
      </div>
      <div className="ask-modal-list" ref={listRef} role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="ask-message ask-message--assistant ask-message--empty">
            <span className="ask-message-text">I can help you dig into recent weather. Tap a suggestion below, or type: current temp/conditions/wind, highest/lowest temp or wind, most precip, summary (24h/3d/7d), chart (24h/3d/7d), or humidity trend. What would you like to know?</span>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`ask-message ask-message--${msg.role}`} style={{ animationDelay: `${i * 0.04}s` }}>
            <span className="ask-message-text">{msg.text}</span>
            {msg.role === 'assistant' && msg.chart && (
              <AskMessageChart metric={msg.chart.metric} hours={msg.chart.hours} />
            )}
          </div>
        ))}
        {loading && (
          <div className="ask-message ask-message--assistant">
            <span className="ask-message-text ask-message-text--loading">Thinking…</span>
          </div>
        )}
      </div>
      <div className="ask-modal-footer">
        <p className="ask-quick-title">Quick Links</p>
        <div className="ask-quick-replies">
          {QUICK_REPLIES.map((item, i) => (
            <button
              key={i}
              type="button"
              className="ask-quick-reply"
              onClick={() => handleQuickReply(item)}
              disabled={loading}
            >
              {item.label}
            </button>
          ))}
        </div>
        <form className="ask-form" onSubmit={handleSubmitInput}>
          <input
            ref={inputRef}
            type="text"
            className="ask-input"
            placeholder="e.g. current conditions, highest temp 7d, most precip, wind chart 24h"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={loading}
            aria-label="Ask a question about weather"
          />
          <button type="submit" className="ask-submit" disabled={loading || !inputValue.trim()} aria-label="Send">
            Send
          </button>
        </form>
      </div>
    </>
  );

  if (embedded) {
    return <div className="ask-modal ask-modal--embedded">{content}</div>;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      ariaLabelledBy="ask-modal-title"
      className="ask-modal"
    >
      {content}
    </Modal>
  );
};

export default AskModal;
