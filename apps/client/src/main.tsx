import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadAssetManifests } from './assets.js';
import { App } from './App.js';
import './ui/theme.css';

void loadAssetManifests();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
