import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider, useUser } from './contexts/UserContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { SetupForm } from './components/SetupForm';
import { Dashboard } from './components/Dashboard';
import { ErrorBoundary } from './components/ErrorBoundary';

function AppContent() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={user ? <Navigate to="/app" replace /> : <SetupForm />}
      />
      <Route
        path="/app"
        element={user ? <Dashboard /> : <Navigate to="/" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <UserProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </UserProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
