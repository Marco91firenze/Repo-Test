import { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import { JobForm } from './JobForm';
import { JobList } from './JobList';
import { CVUpload } from './CVUpload';
import { ResultsDashboard } from './ResultsDashboard';
import { CreditsPanel } from './CreditsPanel';
import LanguageSelector from './LanguageSelector';
import { Briefcase, Upload, BarChart3, CreditCard, AlertCircle, X } from 'lucide-react';

type View = 'jobs' | 'upload' | 'results' | 'credits';

export function Dashboard() {
  const { user } = useUser();
  const { t } = useLanguage();
  const [view, setView] = useState<View>('jobs');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [refreshJobs, setRefreshJobs] = useState(0);
  const [ollamaBanner, setOllamaBanner] = useState<boolean>(false);

  useEffect(() => {
    (window as any).electronAPI?.checkOllama?.().then((result: any) => {
      if (!result?.data?.available) {
        setOllamaBanner(true);
      }
    }).catch(() => setOllamaBanner(true));
  }, []);

  const handleJobCreated = () => {
    setView('jobs');
    setRefreshJobs(prev => prev + 1);
  };

  const handleJobSelected = (jobId: string) => {
    setSelectedJobId(jobId);
    setView('upload');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">CV AI Scanner</h1>
                {user && (
                  <p className="text-xs text-slate-500">{user.company_name}</p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <LanguageSelector />
              {user && (
                <div className="flex items-center space-x-4 text-sm">
                  <div className="text-right">
                    <p className="text-slate-500">Credits</p>
                    <p className="font-semibold text-slate-900">{user.credits_remaining}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500">CVs Selected</p>
                    <p className="font-semibold text-slate-900">{user.total_cvs_selected}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {ollamaBanner && (
          <div className="mb-6 bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800 flex-1">
              <span className="font-semibold">AI engine not running.</span>{' '}
              CV AI Scanner requires Ollama to analyse CVs.{' '}
              <button onClick={() => { setView('credits'); setOllamaBanner(false); }} className="underline font-medium hover:text-amber-900">
                Set up Ollama in the Credits tab →
              </button>
            </p>
            <button onClick={() => setOllamaBanner(false)} className="text-amber-500 hover:text-amber-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex space-x-2 mb-8 bg-white p-1 rounded-lg shadow-sm inline-flex">
          <button
            onClick={() => setView('jobs')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all ${
              view === 'jobs'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Briefcase className="w-5 h-5" />
            <span>{t('dashboard.jobPosting')}</span>
          </button>
          <button
            onClick={() => setView('upload')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all ${
              view === 'upload'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-5 h-5" />
            <span>{t('dashboard.uploadCVs')}</span>
          </button>
          <button
            onClick={() => setView('results')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all ${
              view === 'results'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span>{t('dashboard.results')}</span>
          </button>
          <button
            onClick={() => setView('credits')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all ${
              view === 'credits'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <span>Credits</span>
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          {view === 'jobs' && (
            <div className="space-y-8">
              <JobForm onJobCreated={handleJobCreated} />
              <JobList key={refreshJobs} onJobSelected={handleJobSelected} />
            </div>
          )}
          {view === 'upload' && <CVUpload selectedJobId={selectedJobId} />}
          {view === 'results' && <ResultsDashboard />}
          {view === 'credits' && <CreditsPanel />}
        </div>
      </div>
    </div>
  );
}
