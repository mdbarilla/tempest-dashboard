import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './App';
import EinkPage from './pages/EinkPage';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {window.location.pathname === '/eink' ? <EinkPage /> : <App />}
  </React.StrictMode>
);
