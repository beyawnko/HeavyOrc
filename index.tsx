import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from '@/lib/ThemeContext';
import MemoryErrorBoundary from '@/components/MemoryErrorBoundary';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <MemoryErrorBoundary>
        <App />
      </MemoryErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>
);