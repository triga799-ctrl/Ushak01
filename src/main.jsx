import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './brand.css';
import './organization.css';
import './chat.css';
import './document-card.css';
import './reports.css';
import './corporate.css';
import './enhancements.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
