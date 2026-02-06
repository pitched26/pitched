import React from 'react';
import { createRoot } from 'react-dom/client';
import { OverlayRoot } from './components/OverlayRoot';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <React.StrictMode>
    <OverlayRoot />
  </React.StrictMode>
);
