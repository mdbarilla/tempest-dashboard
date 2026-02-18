import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AskModal from '../components/AskModal';
import './ChatPage.css';

const ChatPage = ({ lastUpdate }) => {
  const navigate = useNavigate();
  const lastMainView = localStorage.getItem('lastMainView') || 'dashboard';
  const mainLabel = lastMainView === 'currently' ? 'Currently' : 'Dashboard';
  const mainPath = lastMainView === 'currently' ? '/conditions' : '/';

  return (
    <div className="chat-page">
      <header className="chat-header">
        <div className="chat-header-inner">
          <h1 className="chat-title">Tower Hill&nbsp;&nbsp;<span className="chat-title-city">Wayland</span></h1>
          <div className="chat-header-row">
            <span className="page-and-update-mobile">
              Ask • {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}` : '—'}
            </span>
            <span className="chat-nav-desktop">
              <p className="chat-updated">
                {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : '—'}
              </p>
              <span className="chat-nav-sep" aria-hidden="true">•</span>
              <Link to={mainPath} className="chat-nav-link">{mainLabel}</Link>
              <span className="chat-nav-sep" aria-hidden="true">•</span>
              <Link to="/history" className="chat-nav-link">History</Link>
              <span className="chat-nav-sep" aria-hidden="true">•</span>
              <span className="header-nav-active">Ask</span>
            </span>
          </div>
        </div>
      </header>
      <div className="chat-content">
        <AskModal isOpen onClose={() => navigate('/')} embedded />
      </div>
    </div>
  );
};

export default ChatPage;
