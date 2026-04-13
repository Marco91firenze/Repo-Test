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
}

export function CVUpload({ selectedJobId: initialJobId }: CVUploadProps) {
  const { user, refreshProfile } = useUser();
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobId);
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const elapsedTimers = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    if (initialJobId) {
      setSelectedJobId(initialJobId);
    }
  }, [initialJobId]);

  const loadJobs = async () => {
    try {
      const result = await (window as any).electronAPI.getJobs();
      if (result?.success && result.data) {
        setJobs(result.data);
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    }
  };

  const handleSelectFiles = async () => {
    try {
      const filePaths = await (window as any).electronAPI.selectFiles();
      if (filePaths && filePaths.length > 0) {
        const newFiles: SelectedFile[] = filePaths.map((p: string) => ({
          path: p,
          name: p.split(/[/\\]/).pop() || p,
          status: 'pending',
        }));
        setFiles(prev => [...prev, ...newFiles]);
      }
    } catch (error) {
      console.error('File selection failed:', error);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = droppedFiles.filter(f =>
      f.type === 'application/pdf' ||
      f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      f.type === 'application/msword'
    );
    const newFiles: SelectedFile[] = validFiles.map(f => ({
      path: (f as any).path || f.name,
      name: f.name,
      status: 'pending',
    }));
    setFiles(prev => [...prev, ...newFiles]);
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
    const timer = elapsedTimers.current.get(index);
    if (timer) { clearInterval(timer); elapsedTimers.current.delete(index); }
  };

  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const handleProcess = async () => {
    if (!selectedJobId || files.length === 0) return;

    setOllamaError(null);

    // Check Ollama is available before doing anything
    try {
      const ollamaCheck = await (window as any).electronAPI.checkOllama();
      if (!ollamaCheck?.success || !ollamaCheck?.data?.available) {
        setOllamaError(
          'Ollama is not running. Please start Ollama before analysing CVs. ' +
          'Visit the Credits tab for setup instructions.'
        );
        return;
      }
      if (!ollamaCheck.data.models || ollamaCheck.data.models.length === 0) {
        setOllamaError(
          'No AI model found in Ollama. Please run: ollama pull llama3.1:8b — then try again. ' +
          'See the Credits tab for the full setup guide.'
        );
        return;
      }
    } catch {
      setOllamaError('Could not connect to Ollama. Please start Ollama and try again.');
      return;
    }

    // Fetch already-analysed filenames to skip duplicates
    let existingFilenames: Set<string> = new Set();
    try {
      const existingResult = await (window as any).electronAPI.getExistingFilenames(selectedJobId);
      if (existingResult?.success && Array.isArray(existingResult.data)) {
        existingFilenames = new Set(existingResult.data);
      }
    } catch { /* best-effort, continue anyway */ }

    // Mark duplicates as skipped before processing
    const updatedFiles = files.map(f =>
      f.status === 'pending' && existingFilenames.has(f.name)
        ? { ...f, status: 'skipped' as const }
        : f
    );
    setFiles(updatedFiles);

    const pendingFiles = updatedFiles.filter(f => f.status === 'pending');
    const pendingCount = pendingFiles.length;
    const creditsAvailable = user?.credits_remaining ?? 0;

    if (pendingCount === 0) {
      // All files were skipped (duplicates)
      return;
    }

    if (creditsAvailable < pendingCount) {
      setShowUpgradeModal(true);
      return;
    }

    setProcessing(true);

    for (let i = 0; i < updatedFiles.length; i++) {
      if (updatedFiles[i].status !== 'pending') continue;

      setFiles(prev =>
        prev.map((f, idx) => idx === i ? { ...f, status: 'processing', elapsed: 0 } : f)
      );
      startElapsed(i);

      try {
        const result = await (window as any).electronAPI.processCv(files[i].path, selectedJobId);
        stopElapsed(i);
        if (!result?.success) {
          throw new Error(result?.error || 'Processing failed');
        }
        setFiles(prev =>
          prev.map((f, idx) => idx === i ? { ...f, status: 'success' } : f)
        );
        await refreshProfile();
      } catch (error: any) {
        stopElapsed(i);
        const raw: string = error.message || 'Analysis failed';

        // Ollama-not-running → full banner + abort
        if (raw.toLowerCase().includes('ollama')) {
          setOllamaError(raw);
          setFiles(prev =>
            prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: 'Ollama required — see banner above' } : f)
          );
          setProcessing(false);
          return;
        }

        // Timeout → friendlier message
        const msg = raw.toLowerCase().includes('timeout') || raw.toLowerCase().includes('aborted')
          ? 'Timed out — the AI model took too long. Try again; if it keeps failing, restart Ollama.'
          : raw;

        setFiles(prev =>
          prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: msg } : f)
        );
      }
    }

    setProcessing(false);
  };

  return (
    <div className="space-y-6">
      {user && user.credits_remaining <= 3 && user.credits_remaining > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">
            You have {user.credits_remaining} CV selecting credit{user.credits_remaining !== 1 ? 's' : ''} remaining.
          </p>
        </div>
      )}

      {/* Ollama error banner */}
      {ollamaError && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">AI Engine Required</p>
            <p className="text-sm text-red-700 mt-0.5">{ollamaError}</p>
          </div>
          <button onClick={() => setOllamaError(null)} className="ml-auto text-red-400 hover:text-red-600">
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
          {jobs.map((job) => (
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
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Select CV Files
            </h3>
            <p className="text-slate-600 mb-4">
              Drag and drop your CV files here or click to browse
            </p>
            <button
              onClick={handleSelectFiles}
              disabled={processing}
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
            >
              Browse Files
            </button>
          </div>

          {files.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900">
                {t('cvUpload.files')} ({files.length})
              </h3>
              {files.map((file, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    file.status === 'skipped' ? 'bg-slate-50 opacity-70' : 'bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <FileText className="w-5 h-5 text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {file.name}
                      </p>
                      {file.status === 'skipped' && (
                        <p className="text-xs text-slate-500">Already analysed — skipped</p>
                      )}
                      {file.error && (
                        <p className="text-xs text-red-600">{file.error}</p>
                      )}
                    </div>
                    {file.status === 'success' && (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                    {file.status === 'skipped' && (
                      <Info className="w-5 h-5 text-slate-400" />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    {file.status === 'processing' && (
                      <div className="flex items-center gap-1.5">
                        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        {file.elapsed !== undefined && file.elapsed > 0 && (
                          <span className="text-xs text-slate-500 tabular-nums">
                            {formatElapsed(file.elapsed)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {file.status === 'pending' && !processing && (
                    <button
                      onClick={() => removeFile(index)}
                      className="text-slate-400 hover:text-slate-600 ml-2"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}

              <div className="flex space-x-3">
                <button
                  onClick={handleProcess}
                  disabled={processing || files.every(f => f.status !== 'pending')}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {processing ? 'Analysing CVs...' : 'Analyse Selected CVs'}
                </button>
                {files.some(f => f.status === 'success' || f.status === 'skipped') && (
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
              You have {user?.credits_remaining ?? 0} credit{(user?.credits_remaining ?? 0) !== 1 ? 's' : ''} available, but are trying to select {files.filter(f => f.status === 'pending').length} CVs. Please purchase more credits or select fewer CVs.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition"
              >
                Select Fewer CVs
              </button>
              <button
                onClick={async () => {
                  setShowUpgradeModal(false);
                  await (window as any).electronAPI.purchaseCredits('batch_100');
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition"
              >
                Buy 100 Credits (€50)
              </button>
              <button
                onClick={async () => {
                  setShowUpgradeModal(false);
                  await (window as any).electronAPI.purchaseCredits('batch_1000');
                }}
                className="w-full bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold py-2 rounded-lg transition"
              >
                Buy 1000 Credits (€300)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
