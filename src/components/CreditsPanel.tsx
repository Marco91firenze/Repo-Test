import { useState, useEffect, useCallback } from 'react';
import { useUser } from '../contexts/UserContext';
import { CreditCard, Zap, AlertCircle, RefreshCw, Cpu, Calculator, ExternalLink, CheckCircle, Loader2 } from 'lucide-react';

interface OllamaStatus {
  available: boolean;
  models?: string[];
  url?: string;
}

type AnalysisMode = 'algorithmic' | 'ollama';
type OllamaSetupState = 'idle' | 'checking' | 'pulling' | 'ready' | 'not_installed';

export function CreditsPanel() {
  const { user, syncPurchases } = useUser();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('algorithmic');
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [setupState, setSetupState] = useState<OllamaSetupState>('idle');
  const [pullProgress, setPullProgress] = useState<string>('');

  useEffect(() => {
    loadSettings();
  }, []);

  // Listen for pull progress events from the main process
  useEffect(() => {
    const cleanup = (window as any).electronAPI?.onOllamaPullProgress?.((data: { status: string; completed?: number; total?: number }) => {
      if (data.completed && data.total && data.total > 0) {
        const pct = Math.round((data.completed / data.total) * 100);
        setPullProgress(`${data.status} (${pct}%)`);
      } else {
        setPullProgress(data.status);
      }
    });
    return () => { if (cleanup) cleanup(); };
  }, []);

  const loadSettings = async () => {
    try {
      const result = await (window as any).electronAPI.getSettings();
      if (result?.success && result.data) {
        const enabled = result.data['ollama_enabled'] === 'true';
        setAnalysisMode(enabled ? 'ollama' : 'algorithmic');
        if (enabled) {
          checkAndSetupOllama();
        }
      }
    } catch {
      // defaults to algorithmic
    } finally {
      setLoadingSettings(false);
    }
  };

  const checkAndSetupOllama = useCallback(async () => {
    setSetupState('checking');
    try {
      const result = await (window as any).electronAPI.checkOllama();
      if (result?.success && result.data) {
        setOllamaStatus(result.data);
        if (result.data.available) {
          if (result.data.models && result.data.models.length > 0) {
            setSetupState('ready');
          } else {
            // Ollama running but no models - auto-pull
            await autoSetup();
          }
        } else {
          setSetupState('not_installed');
        }
      } else {
        setSetupState('not_installed');
      }
    } catch {
      setSetupState('not_installed');
    }
  }, []);

  const autoSetup = async () => {
    setSetupState('pulling');
    setPullProgress('Starting download...');
    try {
      const result = await (window as any).electronAPI.setupOllama();
      if (result?.success) {
        setSetupState('ready');
        // Refresh status
        const status = await (window as any).electronAPI.checkOllama();
        if (status?.success) setOllamaStatus(status.data);
      } else {
        setSetupState('not_installed');
      }
    } catch {
      setSetupState('not_installed');
    }
    setPullProgress('');
  };

  const selectMode = async (mode: AnalysisMode) => {
    setAnalysisMode(mode);
    await (window as any).electronAPI.updateSettings('ollama_enabled', mode === 'ollama' ? 'true' : 'false');

    if (mode === 'ollama') {
      checkAndSetupOllama();
    }
  };

  const handlePurchase = async (packageSize: string) => {
    setPurchasing(packageSize);
    try {
      await (window as any).electronAPI.purchaseCredits(packageSize);
    } catch (error) {
      console.error('Purchase failed:', error);
    } finally {
      setPurchasing(null);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const newCredits = await syncPurchases();
      if (newCredits > 0) {
        setSyncResult(`Added ${newCredits} new credit${newCredits !== 1 ? 's' : ''}!`);
      } else {
        setSyncResult('No new purchases found.');
      }
    } catch {
      setSyncResult('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  if (!user || loadingSettings) return null;

  return (
    <div className="space-y-6">
      {/* Credits Overview */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Credits Remaining</h3>
            <p className="text-3xl font-bold text-blue-600">{user.credits_remaining}</p>
          </div>
          <Zap className="w-12 h-12 text-blue-600 opacity-20" />
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Each CV analysis uses 1 credit. You started with 10 free credits.
        </p>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Purchases'}
        </button>
        {syncResult && (
          <p className="text-sm text-center mt-2 text-slate-600">{syncResult}</p>
        )}
      </div>

      {/* Low Credits Warning */}
      {user.credits_remaining <= 2 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Low on credits!</p>
            <p className="text-sm">Purchase more credits to continue analyzing CVs.</p>
          </div>
        </div>
      )}

      {/* Analysis Mode Selection */}
      <div>
        <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Cpu className="w-5 h-5" />
          Analysis Mode
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Algorithmic Mode */}
          <button
            onClick={() => selectMode('algorithmic')}
            className={`text-left border-2 rounded-xl p-5 transition-all ${
              analysisMode === 'algorithmic'
                ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                analysisMode === 'algorithmic' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                <Calculator className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h5 className="font-semibold text-slate-900">Algorithmic</h5>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Ready to use</span>
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  Works immediately. Uses pattern matching and scoring algorithms to rank CVs.
                </p>
              </div>
            </div>
            <ul className="text-xs text-slate-500 space-y-1 ml-[52px]">
              <li>No extra downloads needed</li>
              <li>Fast and lightweight</li>
              <li>Good accuracy for skill and experience matching</li>
            </ul>
          </button>

          {/* Ollama / LLM Mode */}
          <button
            onClick={() => selectMode('ollama')}
            className={`text-left border-2 rounded-xl p-5 transition-all ${
              analysisMode === 'ollama'
                ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                analysisMode === 'ollama' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                <Cpu className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h5 className="font-semibold text-slate-900">AI-Powered</h5>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Higher quality</span>
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  Uses a local AI model for deeper, more nuanced CV analysis. Requires Ollama (free).
                </p>
              </div>
            </div>
            <ul className="text-xs text-slate-500 space-y-1 ml-[52px]">
              <li>Requires one-time Ollama install (free)</li>
              <li>More detailed reasoning and insights</li>
              <li>Still 100% private - AI runs on your machine</li>
            </ul>
          </button>
        </div>
      </div>

      {/* Ollama Setup Status (shown when ollama mode selected) */}
      {analysisMode === 'ollama' && (
        <div className="border border-slate-200 rounded-xl p-5">
          <h4 className="font-semibold text-slate-900 mb-3">AI Engine Status</h4>

          {setupState === 'checking' && (
            <div className="flex items-center gap-3 py-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="text-sm text-slate-600">Detecting Ollama...</span>
            </div>
          )}

          {setupState === 'pulling' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <span className="text-sm text-slate-600">Downloading AI model... This is a one-time setup.</span>
              </div>
              {pullProgress && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 font-mono">{pullProgress}</p>
                </div>
              )}
              <p className="text-xs text-slate-400">
                The model is several GB. This may take a few minutes depending on your connection.
              </p>
            </div>
          )}

          {setupState === 'ready' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-800">AI engine is ready</span>
              </div>
              <p className="text-xs text-green-700 ml-7">
                Ollama is running and the AI model is loaded. CVs will be analyzed using AI.
                {ollamaStatus?.models && ollamaStatus.models.length > 0 && (
                  <span className="block mt-1">Model: {ollamaStatus.models[0]}</span>
                )}
              </p>
            </div>
          )}

          {setupState === 'not_installed' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Ollama not detected</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Install Ollama (free) and our app will connect to it automatically. No configuration needed.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm font-medium text-slate-700 mb-3">Quick setup:</p>
                <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                  <li>
                    Download Ollama from{' '}
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        window.open('https://ollama.com/download', '_blank');
                      }}
                      className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                    >
                      ollama.com/download
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>Install and run it (just double-click the installer)</li>
                  <li>Come back here - the app downloads the AI model automatically</li>
                </ol>
              </div>

              <button
                onClick={checkAndSetupOllama}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Check again
              </button>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Ollama runs entirely on your machine. Our app anonymizes all personal data before the AI sees it.
            </p>
          </div>
        </div>
      )}

      {/* Purchase Options */}
      <div>
        <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Purchase Credits
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 transition-all">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-semibold text-slate-900">100 CVs</p>
                <p className="text-2xl font-bold text-blue-600">€50</p>
              </div>
              <p className="text-xs font-semibold text-slate-500">€0.50/CV</p>
            </div>
            <button
              onClick={() => handlePurchase('batch_100')}
              disabled={purchasing === 'batch_100'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {purchasing === 'batch_100' ? 'Processing...' : 'Buy Now'}
            </button>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 transition-all">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-semibold text-slate-900">1000 CVs</p>
                <p className="text-2xl font-bold text-blue-600">€300</p>
              </div>
              <p className="text-xs font-semibold text-slate-500">€0.30/CV</p>
            </div>
            <button
              onClick={() => handlePurchase('batch_1000')}
              disabled={purchasing === 'batch_1000'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {purchasing === 'batch_1000' ? 'Processing...' : 'Buy Now'}
            </button>
          </div>
        </div>
      </div>

      {/* Privacy Note */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <p className="text-sm text-slate-600">
          <span className="font-semibold">Privacy:</span> All CV files and analysis results remain on your local machine. Only your email is sent to our servers for purchase verification.
        </p>
      </div>
    </div>
  );
}
