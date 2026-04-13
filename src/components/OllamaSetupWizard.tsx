import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Download, CheckCircle, Loader2, Cpu, ArrowRight,
  RefreshCw, Wifi, AlertCircle, Terminal, ChevronRight,
} from 'lucide-react';

interface Props {
  onComplete: () => void;
}

type Step = 'install' | 'start' | 'model' | 'ready';

interface PullProgress {
  status: string;
  pct: number | null;
}

export function OllamaSetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('install');
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState('');
  const [pullProgress, setPullProgress] = useState<PullProgress>({ status: 'Starting download…', pct: null });
  const [pullError, setPullError] = useState('');
  const [pulling, setPulling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cleanup on unmount ──
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Subscribe to pull-progress IPC events ──
  useEffect(() => {
    const cleanup = (window as any).electronAPI?.onOllamaPullProgress?.(
      (data: { status: string; completed?: number; total?: number }) => {
        const pct = data.completed && data.total && data.total > 0
          ? Math.round((data.completed / data.total) * 100)
          : null;
        setPullProgress({ status: data.status, pct });
      }
    );
    return () => { if (cleanup) cleanup(); };
  }, []);

  // ── Auto-advance: when we land on 'start', begin polling ──
  useEffect(() => {
    if (step === 'start') startPolling();
    else stopPolling();
  }, [step]);

  // ── Auto-advance: when we land on 'model', begin pull ──
  useEffect(() => {
    if (step === 'model') beginModelPull();
  }, [step]);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const result = await (window as any).electronAPI.checkOllama();
        if (result?.data?.available) {
          stopPolling();
          // Brief flash before advancing
          setTimeout(() => setStep('model'), 600);
        }
      } catch { /* keep polling */ }
    }, 2000);
  }, []);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const beginModelPull = async () => {
    setPulling(true);
    setPullError('');
    setPullProgress({ status: 'Connecting to Ollama…', pct: null });
    try {
      const result = await (window as any).electronAPI.setupOllama();
      if (result?.success) {
        setTimeout(() => setStep('ready'), 800);
      } else {
        setPullError(result?.error || 'Download failed. Please try again.');
      }
    } catch (e: any) {
      setPullError(e?.message || 'Unexpected error. Please try again.');
    } finally {
      setPulling(false);
    }
  };

  const handleManualCheck = async () => {
    setChecking(true);
    setCheckError('');
    try {
      const result = await (window as any).electronAPI.checkOllama();
      if (result?.data?.available) {
        stopPolling();
        setStep('model');
      } else {
        setCheckError('Ollama is not running yet. Make sure you opened it from the Start menu or system tray.');
      }
    } catch {
      setCheckError('Could not connect. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const stepIndex = { install: 0, start: 1, model: 2, ready: 3 };
  const stepLabels = ['Install', 'Start', 'AI Model', 'Ready'];

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center z-50 p-4">

      {/* App identity */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
          <Cpu className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">CV AI Scanner</h1>
          <p className="text-blue-300 text-sm">Local AI · 100% Private</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {stepLabels.map((label, i) => {
          const current = stepIndex[step];
          const done = i < current;
          const active = i === current;
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                done ? 'bg-green-500 text-white' :
                active ? 'bg-blue-500 text-white' :
                'bg-slate-700 text-slate-400'
              }`}>
                {done ? <CheckCircle className="w-3 h-3" /> : <span>{i + 1}</span>}
                {label}
              </div>
              {i < stepLabels.length - 1 && (
                <ChevronRight className="w-4 h-4 text-slate-600" />
              )}
            </div>
          );
        })}
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">

        {/* ── Step 1: Install ── */}
        {step === 'install' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Download className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Set up your AI engine</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                CV AI Scanner uses <strong>Ollama</strong> — a free, open-source tool that runs AI models
                directly on your computer. Your CV data <em>never</em> leaves your machine.
              </p>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800 space-y-1">
              <p className="font-semibold">What you'll need:</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                <li>~5 minutes and a stable internet connection</li>
                <li>~2.5 GB of free disk space for the AI model</li>
                <li>Windows 10 (build 19041+) or Windows 11</li>
              </ul>
            </div>

            <div className="space-y-3">
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); (window as any).open?.('https://ollama.com/download', '_blank'); }}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                <Download className="w-5 h-5" />
                Download Ollama for Windows
              </a>
              <button
                onClick={() => setStep('start')}
                className="w-full flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900 font-medium py-2 rounded-xl hover:bg-slate-50 transition-colors text-sm"
              >
                I've already installed Ollama
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Start Ollama ── */}
        {step === 'start' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Wifi className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Start Ollama</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                Ollama needs to be running in the background while you use CV AI Scanner.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-sm">
              <p className="font-semibold text-slate-800">How to start Ollama:</p>
              <ol className="list-decimal list-inside space-y-2 text-slate-700">
                <li>Open the <strong>Start menu</strong> and search for <strong>"Ollama"</strong></li>
                <li>Click to open it — a llama icon will appear in your <strong>system tray</strong> (bottom-right of your taskbar)</li>
                <li>That's it — come back here once it's running</li>
              </ol>
            </div>

            {/* Polling indicator */}
            <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-4">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
              <p className="text-sm text-blue-800">Waiting for Ollama to start — checking automatically every 2 seconds…</p>
            </div>

            {checkError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{checkError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleManualCheck}
                disabled={checking}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                {checking ? 'Checking…' : 'Check now'}
              </button>
              <button
                onClick={() => setStep('install')}
                className="px-4 text-slate-500 hover:text-slate-700 font-medium text-sm rounded-xl hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Model download ── */}
        {step === 'model' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Cpu className="w-8 h-8 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Downloading AI model</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                This is a one-time download. The AI model (~4.7 GB) will be stored locally on your computer
                and never needs to be downloaded again.
              </p>
            </div>

            {!pullError ? (
              <div className="space-y-3">
                {/* Progress bar */}
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${
                      pullProgress.pct !== null ? 'bg-blue-600' : 'bg-blue-400 animate-pulse w-full'
                    }`}
                    style={{ width: pullProgress.pct !== null ? `${pullProgress.pct}%` : '100%' }}
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <p className="text-slate-600 font-mono">{pullProgress.status}</p>
                  {pullProgress.pct !== null && (
                    <p className="text-blue-600 font-bold">{pullProgress.pct}%</p>
                  )}
                </div>

                <div className="bg-slate-900 rounded-xl p-3 flex items-center gap-2.5">
                  <Terminal className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <p className="text-green-400 text-xs font-mono">ollama pull llama3.2:3b</p>
                </div>

                <p className="text-xs text-slate-400 text-center">
                  Keep this window open. Do not close Ollama from the system tray.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-4">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Download failed</p>
                    <p className="text-sm text-red-700 mt-0.5">{pullError}</p>
                  </div>
                </div>
                <button
                  onClick={beginModelPull}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try again
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Ready ── */}
        {step === 'ready' && (
          <div className="space-y-6 text-center">
            <div>
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">You're all set!</h2>
              <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
                Your AI engine is running. CV AI Scanner will now analyse CVs locally, privately,
                and with full AI quality — no data ever leaves your computer.
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-left space-y-2">
              <p className="text-sm font-semibold text-green-800">Remember for next time:</p>
              <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
                <li>Ollama must be running whenever you use this app</li>
                <li>Look for the llama icon in your system tray</li>
                <li>If CV analysis fails, check that Ollama is still running</li>
              </ul>
            </div>

            <button
              onClick={onComplete}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors text-lg"
            >
              Start using CV AI Scanner
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="mt-6 text-slate-500 text-xs text-center">
        CV AI Scanner · 100% local processing · GDPR compliant
      </p>
    </div>
  );
}
