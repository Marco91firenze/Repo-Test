import { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider, useUser } from './contexts/UserContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { SetupForm } from './components/SetupForm';
import { Dashboard } from './components/Dashboard';
import { OllamaSetupWizard } from './components/OllamaSetupWizard';
import { ErrorBoundary } from './components/ErrorBoundary';

type OllamaState = 'checking' | 'ready' | 'offline';

function AppContent() {
  const { user, loading } = useUser();
  const [ollamaState, setOllamaState] = useState<OllamaState>('checking');
  // Once the wizard has been dismissed in this session, never re-show it
  // mid-session (e.g. when Ollama crashes during an analysis). The inline
  // error messages in CVUpload handle that case instead.
  const wizardShownOnce = useRef(false);

  useEffect(() => {
    if (!user) return;
    checkOllamaOnStartup();
  }, [user]);

  const checkOllamaOnStartup = async () => {
    setOllamaState('checking');
    try {
      const result = await (window as any).electronAPI?.checkOllama?.();
      const available = result?.data?.available === true;
      const hasModel = Array.isArray(result?.data?.models) && result.data.models.length > 0;
      setOllamaState(available && hasModel ? 'ready' : 'offline');
    } catch {
      setOllamaState('offline');
    }
  };

  const handleWizardComplete = () => {
    wizardShownOnce.current = true;
    setOllamaState('ready');
  };

  // Called by Dashboard if Ollama goes offline mid-session (e.g. user quit it).
  // Only re-show wizard if it hasn't been dismissed in this session yet.
  const handleOllamaOffline = () => {
    if (!wizardShownOnce.current) {
      setOllamaState('offline');
    }
    // If wizard was already completed this session, Dashboard's inline banner
    // handles it — no need to block the whole app again.
  };

  if (loading || (user && ollamaState === 'checking')) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <>
      {user && ollamaState === 'offline' && (
        <OllamaSetupWizard onComplete={handleWizardComplete} />
      )}

      <Routes>
        <Route
          path="/"
          element={user ? <Navigate to="/app" replace /> : <SetupForm />}
        />
        <Route
          path="/app"
          element={
            user
              ? <Dashboard onOllamaOffline={handleOllamaOffline} />
              : <Navigate to="/" replace />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <UserProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </UserProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}

export default App;
