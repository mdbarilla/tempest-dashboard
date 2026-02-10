import React from 'react';
import './NewsCarousel.css';

const NewsCarousel = ({ newsData, loading, error }) => {
  // News disabled by default everywhere. Enable with ?news=1.
  const params = new URLSearchParams(window.location.search);
  const showNews = params.get('news') === '1';

  if (!showNews) {
    return null;
  }

  if (loading) {
    return (
      <div className="news-section">
        <div className="news-container">
          <div className="news-layout">
            <div className="news-header">
              <h2>Local News</h2>
            </div>
            <div className="news-grid">
              <div className="news-loading">Loading news...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    // Show error state instead of hiding
    const isServiceUnavailable = error.includes('service unavailable') || error.includes('missing dependencies');
    
    return (
      <div className="news-section">
        <div className="news-container">
          <div className="news-layout">
            <div className="news-header">
              <h2>Local News</h2>
            </div>
            <div className="news-grid">
              <div className="news-loading" style={{ color: 'var(--text-secondary)', padding: '2rem' }}>
                {isServiceUnavailable ? (
                  <div>
                    <div style={{ marginBottom: '0.5rem', fontWeight: 'var(--weight-medium)' }}>
                      News service unavailable
                    </div>
                    <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                      Install backend dependencies: <code style={{ background: 'var(--bg-primary)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>cd backend && npm install</code>
                    </div>
                  </div>
                ) : (
                  `Unable to load news. ${error}`
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!newsData || newsData.length === 0) {
    return null; // Hide component only when no data (not error)
  }

  const formatTimestamp = (timestamp) => {
    if (!timestamp || timestamp === 0) {
      return 'Recently';
    }
    
    const date = new Date(timestamp * 1000);
    const now = new Date();
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Recently';
    }
    
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="news-section">
      <div className="news-container">
        <div className="news-layout">
          <div className="news-header">
            <h2>Local News</h2>
          </div>
          <div className="news-grid">
            {newsData.map((article, index) => (
              <a
                key={index}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="news-card"
              >
                <div className="news-content">
                  <div className="news-headline-row">
                    <div className="news-headline">{article.headline}</div>
                    {article.imageUrl && (
                      <img
                        src={article.imageUrl}
                        alt={article.headline}
                        className="news-thumbnail"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                  <div className="news-meta">
                    {formatTimestamp(article.timestamp)} • {article.source}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsCarousel;
