import { useState, useEffect, useRef } from 'react';
import { useUser } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Upload, FileText, X, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react';

interface Job {
  id: string;
  title: string;
  location: string;
  is_remote?: number;
}

interface CVUploadProps {
  selectedJobId: string | null;
}

interface SelectedFile {
  path: string;
  name: string;
  status: 'pending' | 'skipped' | 'processing' | 'success' | 'error';
  error?: string;
  elapsed?: number;
  tokens?: number;
}

export function CVUpload({ selectedJobId: initialJobId }: CVUploadProps) {
  const { user, refreshProfile } = useUser();
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobId);
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processingIndex, setProcessingIndex] = useState<number | null>(null);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const elapsedTimers = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    if (initialJobId) setSelectedJobId(initialJobId);
  }, [initialJobId]);

  // Subscribe to streaming token progress from the main process
  useEffect(() => {
    const cleanup = (window as any).electronAPI?.onCVAnalysisProgress?.(
      (data: { tokens: number }) => {
        setProcessingIndex(current => {
          if (current === null) return current;
          setFiles(prev => prev.map((f, i) =>
            i === current ? { ...f, tokens: data.tokens } : f
          ));
          return current;
        });
      }
    );
    return () => { if (cleanup) cleanup(); };
  }, []);

  const loadJobs = async () => {
    try {
      const result = await (window as any).electronAPI.getJobs();
      if (result?.success && result.data) setJobs(result.data);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    }
  };

  const handleSelectFiles = async () => {
    try {
      const filePaths = await (window as any).electronAPI.selectFiles();
      if (filePaths?.length > 0) {
        const newFiles: SelectedFile[] = filePaths.map((p: string) => ({
          path: p,
          name: p.split(/[/\\]/).pop() || p,
          status: 'pending',
        }));
        setFiles(prev => [...prev, ...newFiles]);
      }
    } catch (err) {
      console.error('File selection failed:', err);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const valid = Array.from(e.dataTransfer.files).filter(f =>
      f.type === 'application/pdf' ||
      f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      f.type === 'application/msword'
    );
    setFiles(prev => [
      ...prev,
      ...valid.map(f => ({ path: (f as any).path || f.name, name: f.name, status: 'pending' as const })),
    ]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startElapsed = (index: number) => {
    const start = Date.now();
    const timer = setInterval(() => {
      setFiles(prev => prev.map((f, i) =>
        i === index ? { ...f, elapsed: Math.floor((Date.now() - start) / 1000) } : f
      ));
    }, 1000);
    elapsedTimers.current.set(index, timer);
  };

  const stopElapsed = (index: number) => {
    const t = elapsedTimers.current.get(index);
    if (t) { clearInterval(t); elapsedTimers.current.delete(index); }
  };

  const fmt = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;

  const handleProcess = async () => {
    if (!selectedJobId || files.length === 0) return;
    setOllamaError(null);

    // Pre-flight: check Ollama is running and has a model
    try {
      const check = await (window as any).electronAPI.checkOllama();
      if (!check?.data?.available) {
        setOllamaError('Ollama is not running. Please start Ollama before analysing CVs.');
        return;
      }
      if (!check.data.models?.length) {
        setOllamaError('No AI model found in Ollama. Please run: ollama pull llama3.2:3b — then try again.');
        return;
      }
    } catch {
      setOllamaError('Could not connect to Ollama. Please start Ollama and try again.');
      return;
    }

    // Skip already-analysed files
    let existing: Set<string> = new Set();
    try {
      const r = await (window as any).electronAPI.getExistingFilenames(selectedJobId);
      if (r?.success && Array.isArray(r.data)) existing = new Set(r.data);
    } catch { /* best-effort */ }

    const withSkips = files.map(f =>
      f.status === 'pending' && existing.has(f.name) ? { ...f, status: 'skipped' as const } : f
    );
    setFiles(withSkips);

    const pendingCount = withSkips.filter(f => f.status === 'pending').length;
    if (pendingCount === 0) return;
    if ((user?.credits_remaining ?? 0) < pendingCount) { setShowUpgradeModal(true); return; }

    setProcessing(true);

    for (let i = 0; i < withSkips.length; i++) {
      if (withSkips[i].status !== 'pending') continue;

      setProcessingIndex(i);
      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing', elapsed: 0, tokens: 0 } : f));
      startElapsed(i);

      try {
        const result = await (window as any).electronAPI.processCv(withSkips[i].path, selectedJobId);
        stopElapsed(i);
        setProcessingIndex(null);

        if (!result?.success) throw new Error(result?.error || 'Processing failed');

        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'success', tokens: undefined } : f));
        await refreshProfile();
      } catch (err: any) {
        stopElapsed(i);
        setProcessingIndex(null);

        const raw: string = err?.message || 'Analysis failed';

        // Determine a user-readable message — always include the raw text for debugging
        let msg: string;
        if (raw.toLowerCase().includes('ollama is not running') || raw.toLowerCase().includes('ollama must be running')) {
          // Show banner and abort the whole batch
          setOllamaError(raw);
          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: raw } : f));
          setProcessing(false);
          return;
        } else if (raw.toLowerCase().includes('fetch') || raw.toLowerCase().includes('econnreset') || raw.toLowerCase().includes('network')) {
          msg = `Connection to Ollama dropped mid-analysis. This usually means Ollama ran out of memory. Try restarting Ollama, then re-analyse. Details: ${raw}`;
        } else {
          // Show the full raw error so we can diagnose unknown failures
          msg = raw;
        }

        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: msg, tokens: undefined } : f));
      }
    }

    setProcessing(false);
  };

  return (
    <div className="space-y-6">
      {user && user.credits_remaining <= 3 && user.credits_remaining > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            {user.credits_remaining} credit{user.credits_remaining !== 1 ? 's' : ''} remaining.
          </p>
        </div>
      )}

      {ollamaError && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">AI Engine Required</p>
            <p className="text-sm text-red-700 mt-0.5">{ollamaError}</p>
          </div>
          <button onClick={() => setOllamaError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {t('cvUpload.selectJob')}
          {user && (
            <span className="ml-2 text-sm text-slate-500">
              ({user.credits_remaining} credit{user.credits_remaining !== 1 ? 's' : ''} available)
            </span>
          )}
        </label>
        <select
          value={selectedJobId || ''}
          onChange={(e) => setSelectedJobId(e.target.value)}
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={processing}
        >
          <option value="">{t('cvUpload.chooseJob')}</option>
          {jobs.map(job => (
            <option key={job.id} value={job.id}>
              {job.title} — {job.is_remote ? '🌐 Remote' : job.location}
            </option>
          ))}
        </select>
      </div>

      {selectedJobId && (
        <>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed rounded-xl p-12 text-center transition-colors border-slate-300 hover:border-slate-400"
          >
            <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Select CV Files</h3>
            <p className="text-slate-600 mb-4">Drag and drop your CV files here or click to browse</p>
            <button
              onClick={handleSelectFiles}
              disabled={processing}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              Browse Files
            </button>
          </div>

          {files.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900">{t('cvUpload.files')} ({files.length})</h3>

              {files.map((file, index) => (
                <div
                  key={index}
                  className={`flex items-start justify-between p-4 rounded-lg ${
                    file.status === 'error' ? 'bg-red-50' :
                    file.status === 'success' ? 'bg-green-50' :
                    file.status === 'skipped' ? 'bg-slate-50 opacity-70' :
                    'bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <FileText className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>

                      {file.status === 'processing' && (
                        <div className="flex items-center gap-2 mt-1">
                          <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin flex-shrink-0" />
                          <span className="text-xs text-blue-700 tabular-nums">
                            AI generating
                            {file.tokens ? ` · ${file.tokens} tokens` : '…'}
                            {file.elapsed ? ` · ${fmt(file.elapsed)}` : ''}
                          </span>
                        </div>
                      )}

                      {file.status === 'skipped' && (
                        <p className="text-xs text-slate-500 mt-0.5">Already analysed — skipped</p>
                      )}

                      {file.status === 'error' && file.error && (
                        <p className="text-xs text-red-700 mt-1 leading-relaxed break-words">{file.error}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    {file.status === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
                    {file.status === 'skipped' && <Info className="w-5 h-5 text-slate-400" />}
                    {file.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                    {file.status === 'pending' && !processing && (
                      <button onClick={() => removeFile(index)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex gap-3">
                <button
                  onClick={handleProcess}
                  disabled={processing || files.every(f => f.status !== 'pending')}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {processing ? 'Analysing CVs…' : 'Analyse Selected CVs'}
                </button>
                {!processing && files.some(f => f.status === 'success' || f.status === 'error' || f.status === 'skipped') && (
                  <button
                    onClick={() => setFiles([])}
                    className="px-6 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-3 rounded-lg transition-colors"
                  >
                    {t('cvUpload.clear')}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md mx-4">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Not Enough Credits</h3>
            <p className="text-slate-600 mb-6">
              You have {user?.credits_remaining ?? 0} credit{(user?.credits_remaining ?? 0) !== 1 ? 's' : ''} remaining
              but are trying to analyse {files.filter(f => f.status === 'pending').length} CVs.
            </p>
            <div className="space-y-3">
              <button onClick={() => setShowUpgradeModal(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition">
                Select Fewer CVs
              </button>
              <button onClick={async () => { setShowUpgradeModal(false); await (window as any).electronAPI.purchaseCredits('batch_100'); }}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition">
                Buy 100 Credits (€50)
              </button>
              <button onClick={async () => { setShowUpgradeModal(false); await (window as any).electronAPI.purchaseCredits('batch_1000'); }}
                className="w-full bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold py-2 rounded-lg transition">
                Buy 1000 Credits (€300)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
