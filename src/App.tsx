import { useState, useEffect } from 'react';
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

  // Check Ollama status whenever we have a logged-in user
  useEffect(() => {
    if (!user) return;
    checkOllama();
  }, [user]);

  const checkOllama = async () => {
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

  if (loading || (user && ollamaState === 'checking')) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <>
      {/* Wizard overlays everything when Ollama is offline (and user is set up) */}
      {user && ollamaState === 'offline' && (
        <OllamaSetupWizard onComplete={() => setOllamaState('ready')} />
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
              ? <Dashboard onOllamaOffline={() => setOllamaState('offline')} />
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
