import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { setupPeriodicRefresh } from './lib/caching';

// Initialize cache system and periodic refresh
setupPeriodicRefresh();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
