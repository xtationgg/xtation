import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { XPProvider } from './components/XP/xpStore';
import { AuthProvider } from './src/auth/AuthProvider';
import { XtationSettingsProvider, initializeXtationSettingsFromStorage } from './src/settings/SettingsProvider';
import { ThemeProvider, initializeThemeFromStorage } from './src/theme/ThemeProvider';
import { AppErrorBoundary } from './components/UI/AppErrorBoundary';
import { LabProvider } from './src/lab/LabProvider';
import { AdminConsoleProvider } from './src/admin/AdminConsoleProvider';
import { PresentationEventsProvider } from './src/presentation/PresentationEventsProvider';
import { PresentationAudioRuntime } from './src/presentation/PresentationAudioRuntime';
import { PresentationSceneRuntime } from './src/presentation/PresentationSceneRuntime';
import { CreativeOpsRuntime } from './src/presentation/CreativeOpsRuntime';

initializeThemeFromStorage();
initializeXtationSettingsFromStorage();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <XtationSettingsProvider>
          <PresentationEventsProvider>
            <CreativeOpsRuntime>
              <PresentationAudioRuntime>
                <PresentationSceneRuntime>
                  <AdminConsoleProvider>
                    <LabProvider>
                      <XPProvider>
                        <AppErrorBoundary>
                          <App />
                        </AppErrorBoundary>
                      </XPProvider>
                    </LabProvider>
                  </AdminConsoleProvider>
                </PresentationSceneRuntime>
              </PresentationAudioRuntime>
            </CreativeOpsRuntime>
          </PresentationEventsProvider>
        </XtationSettingsProvider>
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>
);
