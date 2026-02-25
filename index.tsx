import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { XPProvider } from './components/XP/xpStore';
import { AuthProvider } from './src/auth/AuthProvider';
import { ThemeProvider, initializeThemeFromStorage } from './src/theme/ThemeProvider';

initializeThemeFromStorage();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <XPProvider>
          <App />
        </XPProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
