import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Download, Trophy, ChevronDown, ChevronUp, Trash2, FileText, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getExportTranslation } from '../utils/exportTranslations';

interface ScoringParameter {
  name: string;
  max_score: number;
  requirement: string;
}

interface Job {
  id: string;
  title: string;
  scoring_parameters?: string | null;
}

interface SkillScore {
  skill: string;
  percentage: number;
  assessment: string;
  evidence?: string;
}

interface ReasoningChain {
  experience_reasoning: string;
  skills_reasoning: string;
  location_reasoning: string;
  english_reasoning: string;
  overall_reasoning: string;
}

interface Candidate {
  id: string;
  job_id: string;
  candidate_name: string;
  fit_score: number;
  experience_score: number;
  skills_score: number;
  location_score: number;
  english_score: number;
  experience_quality_score: number;
  skill_relevance_score: number;
  confidence_level: number;
  years_experience: number;
  location: string;
  english_level: string;
  other_languages: string;
  summary: string;
  created_at: string;
  skill_breakdown: SkillScore[];
  key_strengths: string[];
  gaps: string[];
  risk_factors: string[];
  recommendation: string;
  recommendation_reasoning: string;
  reasoning_chain: ReasoningChain;
  skill_evidence: Record<string, string>;
  skill_variations_matched: Record<string, string[]>;
}

export function ResultsDashboard() {
  const { language, t } = useLanguage();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<{ name: string; summary: string } | null>(null);

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

  const getScoringParams = () => {
    const currentJob = jobs.find(j => j.id === selectedJobId);
    if (currentJob?.scoring_parameters) {
      try {
        return JSON.parse(currentJob.scoring_parameters);
      } catch {}
    }
    return {
      param1: { name: 'Experience', max_score: 40 },
      param2: { name: 'Skills', max_score: 30 },
      param3: { name: 'Location', max_score: 15 },
      param4: { name: 'English', max_score: 15 },
    };
  };

  const prepareWorksheetData = () => {
    const scoringParams = getScoringParams();
    const currentJob = jobs.find(j => j.id === selectedJobId);

    const worksheetData: any[][] = [
      [getExportTranslation(language, 'candidateRankingReport')],
      [getExportTranslation(language, 'jobTitle'), currentJob?.title || ''],
      [getExportTranslation(language, 'exportDate'), new Date().toLocaleDateString()],
      [getExportTranslation(language, 'totalCandidates'), candidates.length],
      [],
      [
        getExportTranslation(language, 'rank'),
        getExportTranslation(language, 'candidateName'),
        getExportTranslation(language, 'overallFitScore'),
        `${scoringParams.param1.name} ${getExportTranslation(language, 'score')}`,
        `${scoringParams.param1.name} %`,
        `${scoringParams.param2.name} ${getExportTranslation(language, 'score')}`,
        `${scoringParams.param2.name} %`,
        `${scoringParams.param3.name} ${getExportTranslation(language, 'score')}`,
        `${scoringParams.param3.name} %`,
        `${scoringParams.param4.name} ${getExportTranslation(language, 'score')}`,
        `${scoringParams.param4.name} %`,
        getExportTranslation(language, 'yearsExperience'),
        getExportTranslation(language, 'location'),
        getExportTranslation(language, 'englishLevel'),
        getExportTranslation(language, 'otherLanguages'),
        getExportTranslation(language, 'summary'),
      ],
    ];

    candidates.forEach((c, index) => {
      worksheetData.push([
        index + 1,
        c.candidate_name,
        c.fit_score,
        c.experience_score,
        Math.round((c.experience_score / scoringParams.param1.max_score) * 100),
        c.skills_score,
        Math.round((c.skills_score / scoringParams.param2.max_score) * 100),
        c.location_score,
        Math.round((c.location_score / scoringParams.param3.max_score) * 100),
        c.english_score,
        Math.round((c.english_score / scoringParams.param4.max_score) * 100),
        c.years_experience,
        c.location,
        c.english_level,
        c.other_languages || '',
        c.summary,
      ]);
    });

    return { worksheetData, currentJob };
  };

  const exportToExcel = () => {
    const { worksheetData, currentJob } = prepareWorksheetData();
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    worksheet['!cols'] = [
      { wch: 6 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 50 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidate Rankings');
    XLSX.writeFile(workbook, `${currentJob?.title || 'candidates'}-rankings-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 75) return 'text-green-600 bg-green-50';
    if (percentage >= 50) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getSkillBarColor = (percentage: number) => {
    if (percentage >= 75) return 'bg-green-500';
    if (percentage >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getFitScoreColor = (score: number) => {
    if (score >= 75) return 'bg-green-600';
    if (score >= 50) return 'bg-orange-600';
    return 'bg-red-600';
  };

  const scoringParams = getScoringParams();

  if (loading && jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
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
      <div className="border-b border-slate-200">
        <div className="flex space-x-1 overflow-x-auto">
          {jobs.map((job) => (
            <button
              key={job.id}
              onClick={() => setSelectedJobId(job.id)}
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors ${
                selectedJobId === job.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {job.title}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        {candidates.length > 0 && (
          <>
            <button
              onClick={clearAllResults}
              className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Trash2 className="w-5 h-5" />
              <span>{t('results.clearAllResults')}</span>
            </button>
            <button
              onClick={exportToExcel}
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Download className="w-5 h-5" />
              <span>{t('results.exportToExcel')}</span>
            </button>
          </>
        )}
      </div>

      {candidates.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('results.noResultsYet')}</h3>
          <p className="text-slate-600">{t('results.uploadCVsMessage')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-slate-600 mb-4">
            {t('results.showing')} {candidates.length} {candidates.length !== 1 ? t('results.candidates') : t('results.candidate')}
          </div>

          {candidates.map((candidate, index) => (
            <div
              key={candidate.id}
              className="border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-4 flex-1">
                  <div
                    className={`w-12 h-12 rounded-full ${getFitScoreColor(candidate.fit_score)} flex items-center justify-center text-white font-bold text-lg`}
                  >
                    {candidate.fit_score}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-1">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {candidate.candidate_name}
                      </h3>
                      {index === 0 && <Trophy className="w-5 h-5 text-yellow-500" />}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => { setSelectedSummary({ name: candidate.candidate_name, summary: candidate.summary }); setSummaryModalOpen(true); }}
                    className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                    title={t('results.viewSummary')}
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => deleteCandidate(candidate.id)}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                    title={t('results.deleteResult')}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === candidate.id ? null : candidate.id)}
                    className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    {expandedId === candidate.id ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className={`p-3 rounded-lg ${getPercentageColor((candidate.experience_score / scoringParams.param1.max_score) * 100)}`}>
                  <p className="text-xs font-medium mb-1">{scoringParams.param1.name}</p>
                  <p className="text-lg font-bold">{Math.round((candidate.experience_score / scoringParams.param1.max_score) * 100)}%</p>
                </div>
                <div className={`p-3 rounded-lg ${getPercentageColor((candidate.skills_score / scoringParams.param2.max_score) * 100)}`}>
                  <p className="text-xs font-medium mb-1">{scoringParams.param2.name}</p>
                  <p className="text-lg font-bold">{Math.round((candidate.skills_score / scoringParams.param2.max_score) * 100)}%</p>
                </div>
                <div className={`p-3 rounded-lg ${getPercentageColor((candidate.location_score / scoringParams.param3.max_score) * 100)}`}>
                  <p className="text-xs font-medium mb-1">{scoringParams.param3.name}</p>
                  <p className="text-lg font-bold">{Math.round((candidate.location_score / scoringParams.param3.max_score) * 100)}%</p>
                </div>
                <div className={`p-3 rounded-lg ${getPercentageColor((candidate.english_score / scoringParams.param4.max_score) * 100)}`}>
                  <p className="text-xs font-medium mb-1">{scoringParams.param4.name}</p>
                  <p className="text-lg font-bold">{Math.round((candidate.english_score / scoringParams.param4.max_score) * 100)}%</p>
                </div>
              </div>

              {expandedId === candidate.id && (
                <div className="border-t border-slate-200 pt-4 space-y-4">
                  <div className="grid grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500 mb-1">{t('results.experience')}</p>
                      <p className="font-semibold text-slate-900">{candidate.years_experience} {t('results.years')}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1">{t('results.location')}</p>
                      <p className="font-semibold text-slate-900">{candidate.location || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1">{t('results.englishLevel')}</p>
                      <p className="font-semibold text-slate-900">{candidate.english_level}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1">{t('results.expQuality')}</p>
                      <p className="font-semibold text-slate-900">{candidate.experience_quality_score || 0}%</p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1">{t('results.confidence')}</p>
                      <p className="font-semibold text-slate-900">{candidate.confidence_level || 0}%</p>
                    </div>
                  </div>

                  {candidate.recommendation && (
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-slate-700 text-sm font-semibold">{t('results.hiringRecommendation')}</p>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          candidate.recommendation === 'strong_yes' ? 'bg-green-100 text-green-700' :
                          candidate.recommendation === 'yes' ? 'bg-green-50 text-green-600' :
                          candidate.recommendation === 'maybe' ? 'bg-yellow-50 text-yellow-600' :
                          candidate.recommendation === 'no' ? 'bg-red-50 text-red-600' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {candidate.recommendation.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-slate-600 text-sm leading-relaxed">{candidate.recommendation_reasoning}</p>
                    </div>
                  )}

                  {candidate.key_strengths && candidate.key_strengths.length > 0 && (
                    <div>
                      <p className="text-slate-700 text-sm mb-2 font-semibold">{t('results.keyStrengths')}</p>
                      <ul className="space-y-1">
                        {candidate.key_strengths.map((strength, idx) => (
                          <li key={idx} className="text-sm text-slate-600 flex items-start">
                            <span className="text-green-500 mr-2">&#10003;</span>
                            <span>{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {candidate.gaps && candidate.gaps.length > 0 && (
                    <div>
                      <p className="text-slate-700 text-sm mb-2 font-semibold">{t('results.gapsAndMissing')}</p>
                      <ul className="space-y-1">
                        {candidate.gaps.map((gap, idx) => (
                          <li key={idx} className="text-sm text-slate-600 flex items-start">
                            <span className="text-yellow-500 mr-2">&#9888;</span>
                            <span>{gap}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {candidate.risk_factors && candidate.risk_factors.length > 0 && (
                    <div>
                      <p className="text-slate-700 text-sm mb-2 font-semibold">{t('results.riskFactors')}</p>
                      <ul className="space-y-1">
                        {candidate.risk_factors.map((risk, idx) => (
                          <li key={idx} className="text-sm text-slate-600 flex items-start">
                            <span className="text-red-500 mr-2">&#10005;</span>
                            <span>{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {candidate.skill_breakdown && candidate.skill_breakdown.length > 0 && (
                    <div>
                      <p className="text-slate-700 text-sm mb-3 font-semibold">{t('results.skillBreakdown')}</p>
                      <div className="space-y-3">
                        {candidate.skill_breakdown.map((skill, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-slate-700">{skill.skill}</span>
                              <span className={`font-bold ${
                                skill.percentage >= 75 ? 'text-green-600' :
                                skill.percentage >= 50 ? 'text-orange-600' : 'text-red-600'
                              }`}>{skill.percentage}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${getSkillBarColor(skill.percentage)}`}
                                style={{ width: `${skill.percentage}%` }}
                              />
                            </div>
                            <p className="text-xs text-slate-600 mt-1">{skill.assessment}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-slate-700 text-sm mb-2 font-semibold">{t('results.summary')}</p>
                    <p className="text-slate-900 text-sm leading-relaxed">{candidate.summary}</p>
                  </div>

                  {candidate.reasoning_chain && candidate.reasoning_chain.experience_reasoning && (
                    <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                      <p className="text-blue-900 text-sm font-semibold">{t('results.detailedAnalysis')}</p>
                      <div className="space-y-2 text-sm">
                        {candidate.reasoning_chain.experience_reasoning && (
                          <div>
                            <p className="font-medium text-blue-800 mb-1">{t('results.experience')}:</p>
                            <p className="text-blue-700">{candidate.reasoning_chain.experience_reasoning}</p>
                          </div>
                        )}
                        {candidate.reasoning_chain.skills_reasoning && (
                          <div>
                            <p className="font-medium text-blue-800 mb-1">{t('results.skills')}:</p>
                            <p className="text-blue-700">{candidate.reasoning_chain.skills_reasoning}</p>
                          </div>
                        )}
                        {candidate.reasoning_chain.location_reasoning && candidate.reasoning_chain.location_reasoning !== 'Not applicable - remote position' && (
                          <div>
                            <p className="font-medium text-blue-800 mb-1">{t('results.location')}:</p>
                            <p className="text-blue-700">{candidate.reasoning_chain.location_reasoning}</p>
                          </div>
                        )}
                        {candidate.reasoning_chain.english_reasoning && (
                          <div>
                            <p className="font-medium text-blue-800 mb-1">{t('results.englishLevel')}:</p>
                            <p className="text-blue-700">{candidate.reasoning_chain.english_reasoning}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {summaryModalOpen && selectedSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">{selectedSummary.name}</h3>
                <p className="text-sm text-slate-600 mt-1">{t('results.candidateSummary')}</p>
              </div>
              <button
                onClick={() => { setSummaryModalOpen(false); setSelectedSummary(null); }}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-slate-900 leading-relaxed whitespace-pre-wrap">{selectedSummary.summary}</p>
            </div>
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end">
              <button
                onClick={() => { setSummaryModalOpen(false); setSelectedSummary(null); }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors font-medium"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
