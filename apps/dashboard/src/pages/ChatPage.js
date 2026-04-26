import React from 'react';
import { useNavigate } from 'react-router-dom';
import AskModal from '../components/AskModal';
import SharedHeaderRow from '../components/SharedHeaderRow';
import './ChatPage.css';

const ChatPage = ({ lastUpdate }) => {
  const navigate = useNavigate();

  return (
    <div className="chat-page">
      <header className="chat-header">
        <div className="chat-header-inner">
          <h1 className="chat-title">
            <span className="th-brand-name">Tower Hill</span>
            &nbsp;&nbsp;
            <span className="chat-title-city">Wayland</span>
          </h1>
          <div className="chat-header-row">
            <SharedHeaderRow />
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
