import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Download, Trophy, ChevronDown, ChevronUp, Trash2, Wifi } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Job {
  id: string;
  title: string;
  location: string;
  is_remote: number;
}

interface Candidate {
  id: string;
  job_id: string;
  candidate_name: string;
  fit_score: number;
  experience_score: number;
  skills_score: number;
  location_score: number | null;
  english_score: number;
  briefing: string;
  key_strengths: string[];
  gaps: string[];
  recommendation: string;
  recommendation_reasoning: string;
  created_at: string;
}

const cap = (n: number) => Math.min(100, Math.max(0, Math.round(n || 0)));

export function ResultsDashboard() {
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    if (selectedJobId) {
      setCandidates([]);
      loadCandidates();
    }
  }, [selectedJobId]);

  const loadJobs = async () => {
    try {
      const result = await (window as any).electronAPI.getJobs();
      if (result?.success && result.data && result.data.length > 0) {
        setJobs(result.data);
        setSelectedJobId(result.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    }
    setLoading(false);
  };

  const loadCandidates = async () => {
    if (!selectedJobId) return;
    setLoading(true);
    try {
      const result = await (window as any).electronAPI.getResults(selectedJobId);
      if (result?.success && result.data) {
        setCandidates(result.data);
      }
    } catch (error) {
      console.error('Failed to load results:', error);
    }
    setLoading(false);
  };

  const deleteCandidate = async (candidateId: string) => {
    if (!confirm(t('results.deleteConfirm'))) return;
    try {
      const result = await (window as any).electronAPI.deleteResult(candidateId);
      if (result?.success) {
        setCandidates(candidates.filter(c => c.id !== candidateId));
      }
    } catch (error) {
      console.error('Failed to delete result:', error);
    }
  };

  const clearAllResults = async () => {
    if (!selectedJobId) return;
    if (!confirm(t('results.clearAllConfirm').replace('{count}', candidates.length.toString()))) return;
    try {
      const result = await (window as any).electronAPI.clearResults(selectedJobId);
      if (result?.success) {
        setCandidates([]);
      }
    } catch (error) {
      console.error('Failed to clear results:', error);
    }
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId);
  const isRemote = selectedJob?.is_remote === 1;

  const exportToExcel = () => {
    const headers = [
      'Rank', 'Candidate', 'Fit Score', 'Experience', 'Skills',
      ...(isRemote ? [] : ['Location']),
      'English', 'Recommendation', 'Briefing',
    ];

    const rows = candidates.map((c, i) => [
      i + 1,
      c.candidate_name,
      cap(c.fit_score),
      cap(c.experience_score),
      cap(c.skills_score),
      ...(isRemote ? [] : [c.location_score === null ? 'N/A' : cap(c.location_score)]),
      cap(c.english_score),
      c.recommendation,
      c.briefing,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([
      [`CV AI Scanner — ${selectedJob?.title || 'Candidate Rankings'}`],
      [`Export date: ${new Date().toLocaleDateString()}`],
      [],
      headers,
      ...rows,
    ]);

    ws['!cols'] = [
      { wch: 6 }, { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
      ...(isRemote ? [] : [{ wch: 12 }]),
      { wch: 12 }, { wch: 16 }, { wch: 80 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rankings');
    XLSX.writeFile(wb, `${selectedJob?.title || 'rankings'}-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const scoreColor = (pct: number) => {
    if (pct >= 75) return 'text-green-600 bg-green-50';
    if (pct >= 50) return 'text-orange-500 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const fitCircleColor = (score: number) => {
    if (score >= 75) return 'bg-green-600';
    if (score >= 50) return 'bg-orange-500';
    return 'bg-red-600';
  };

  const recommendationBadge = (r: string) => {
    const map: Record<string, string> = {
      strong_yes: 'bg-green-100 text-green-800',
      yes: 'bg-green-50 text-green-700',
      maybe: 'bg-yellow-50 text-yellow-700',
      no: 'bg-red-50 text-red-700',
      strong_no: 'bg-red-100 text-red-800',
    };
    return map[r] || 'bg-slate-100 text-slate-700';
  };

  if (loading && jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('results.noJobsYet')}</h3>
        <p className="text-slate-600">{t('results.createJobMessage')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Job tabs */}
      <div className="border-b border-slate-200">
        <div className="flex space-x-1 overflow-x-auto">
          {jobs.map((job) => (
            <button
              key={job.id}
              onClick={() => setSelectedJobId(job.id)}
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                selectedJobId === job.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {job.title}
              {job.is_remote === 1 && <Wifi className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        {isRemote && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full">
            <Wifi className="w-3.5 h-3.5" />
            Remote role — location not scored
          </span>
        )}
        <div className="flex gap-3 ml-auto">
          {candidates.length > 0 && (
            <>
              <button
                onClick={clearAllResults}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
              >
                <Trash2 className="w-4 h-4" />
                {t('results.clearAllResults')}
              </button>
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                {t('results.exportToExcel')}
              </button>
            </>
          )}
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('results.noResultsYet')}</h3>
          <p className="text-slate-600">{t('results.uploadCVsMessage')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            {candidates.length} {candidates.length !== 1 ? t('results.candidates') : t('results.candidate')}
          </p>

          {candidates.map((candidate, index) => (
            <div
              key={candidate.id}
              className="border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all"
            >
              {/* Header row */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-12 h-12 rounded-full ${fitCircleColor(cap(candidate.fit_score))} flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
                    {cap(candidate.fit_score)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-lg font-semibold text-slate-900">{candidate.candidate_name}</h3>
                      {index === 0 && <Trophy className="w-5 h-5 text-yellow-500" />}
                    </div>
                    {candidate.recommendation && (
                      <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${recommendationBadge(candidate.recommendation)}`}>
                        {candidate.recommendation.replace('_', ' ').toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => deleteCandidate(candidate.id)}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                    title={t('results.deleteResult')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === candidate.id ? null : candidate.id)}
                    className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    {expandedId === candidate.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Score boxes */}
              <div className={`grid gap-3 mb-4 ${isRemote ? 'grid-cols-3' : 'grid-cols-4'}`}>
                <div className={`p-3 rounded-lg ${scoreColor(cap(candidate.experience_score))}`}>
                  <p className="text-xs font-medium mb-1">Experience</p>
                  <p className="text-lg font-bold">{cap(candidate.experience_score)}%</p>
                </div>
                <div className={`p-3 rounded-lg ${scoreColor(cap(candidate.skills_score))}`}>
                  <p className="text-xs font-medium mb-1">Skills</p>
                  <p className="text-lg font-bold">{cap(candidate.skills_score)}%</p>
                </div>
                {!isRemote && (
                  <div className={`p-3 rounded-lg ${candidate.location_score === null ? 'bg-slate-50 text-slate-400' : scoreColor(cap(candidate.location_score))}`}>
                    <p className="text-xs font-medium mb-1">Location</p>
                    <p className="text-lg font-bold">
                      {candidate.location_score === null ? 'N/A' : `${cap(candidate.location_score)}%`}
                    </p>
                  </div>
                )}
                <div className={`p-3 rounded-lg ${scoreColor(cap(candidate.english_score))}`}>
                  <p className="text-xs font-medium mb-1">English</p>
                  <p className="text-lg font-bold">{cap(candidate.english_score)}%</p>
                </div>
              </div>

              {/* Briefing — shown by default */}
              {candidate.briefing && (
                <div className="bg-slate-50 rounded-lg p-4 mb-3">
                  <p className="text-sm text-slate-700 leading-relaxed">{candidate.briefing}</p>
                </div>
              )}

              {/* Expanded detail */}
              {expandedId === candidate.id && (
                <div className="border-t border-slate-200 pt-4 space-y-4">
                  {candidate.key_strengths && candidate.key_strengths.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-slate-800 mb-2">{t('results.keyStrengths')}</p>
                      <ul className="space-y-1">
                        {candidate.key_strengths.map((s, i) => (
                          <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">✓</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {candidate.gaps && candidate.gaps.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-slate-800 mb-2">{t('results.gapsAndMissing')}</p>
                      <ul className="space-y-1">
                        {candidate.gaps.map((g, i) => (
                          <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                            <span className="text-yellow-500 mt-0.5">⚠</span>
                            <span>{g}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {candidate.recommendation_reasoning && (
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm font-semibold text-blue-900 mb-1">Recommendation reasoning</p>
                      <p className="text-sm text-blue-800 leading-relaxed">{candidate.recommendation_reasoning}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
