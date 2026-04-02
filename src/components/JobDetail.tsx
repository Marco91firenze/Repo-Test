import { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { ArrowLeft, MapPin, Languages, Clock, Briefcase, FileText, Trash2 } from 'lucide-react';

interface Job {
  id: string;
  title: string;
  location: string;
  english_level: string;
  minimum_experience: number;
  required_skills: string;
  description: string;
  status: string;
  created_at: string;
  scoring_parameters: string | null;
}

interface JobDetailProps {
  jobId: string;
  onBack: () => void;
}

export function JobDetail({ jobId, onBack }: JobDetailProps) {
  const { t } = useLanguage();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadJob();
  }, [jobId]);

  const loadJob = async () => {
    const result = await (window as any).electronAPI.getJob(jobId);
    if (result?.success && result.data) {
      setJob(result.data);
    }
    setLoading(false);
  };

  const handleDeleteJob = async () => {
    if (!confirm(t('jobForm.deleteJobConfirm'))) return;

    setDeleting(true);
    try {
      const result = await (window as any).electronAPI.deleteJob(jobId);
      if (!result?.success) throw new Error(result?.error);
      onBack();
    } catch (error) {
      alert('Failed to delete job. Please try again.');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Job not found</p>
        <button onClick={onBack} className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
          {t('common.back')}
        </button>
      </div>
    );
  }

  const skills: string[] = JSON.parse(job.required_skills || '[]');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{t('common.back')}</span>
        </button>

        <button
          onClick={handleDeleteJob}
          disabled={deleting}
          className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-4 h-4" />
          <span>{deleting ? 'Deleting...' : t('jobForm.deleteJob')}</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{job.title}</h1>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              job.status === 'active'
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {job.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="flex items-center space-x-3 text-slate-700">
            <MapPin className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500 font-medium">Location</p>
              <p className="text-sm">{job.location}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-slate-700">
            <Languages className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500 font-medium">English Level</p>
              <p className="text-sm">{job.english_level}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-slate-700">
            <Clock className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500 font-medium">Minimum Experience</p>
              <p className="text-sm">{job.minimum_experience}+ years</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-slate-700">
            <Briefcase className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500 font-medium">Created</p>
              <p className="text-sm">
                {new Date(job.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {job.description && (
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-3">
              <FileText className="w-5 h-5 text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-900">Description</h2>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-slate-700 whitespace-pre-wrap">{job.description}</p>
            </div>
          </div>
        )}

        {skills.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Required Skills</h2>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-sm font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
