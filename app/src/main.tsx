import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { hasFeature } from './config/app';
import { initTelemetry } from './lib/telemetry';
import './styles/app.css';

initTelemetry();

if (hasFeature('offline') && 'serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
