import { useState, useEffect } from 'react';
import { Briefcase, MapPin, Languages, Clock, ChevronRight } from 'lucide-react';
import { JobDetail } from './JobDetail';

interface Job {
  id: string;
  title: string;
  location: string;
  english_level: string;
  minimum_experience: number;
  required_skills: string;
  status: string;
  created_at: string;
}

interface JobListProps {
  onJobSelected: (jobId: string) => void;
}

export function JobList({ onJobSelected: _onJobSelected }: JobListProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const result = await (window as any).electronAPI.getJobs();
      if (result?.success && result.data) {
        setJobs(result.data);
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    }
    setLoading(false);
  };

  if (selectedJobId) {
    return <JobDetail jobId={selectedJobId} onBack={() => { setSelectedJobId(null); loadJobs(); }} />;
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <Briefcase className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No jobs yet</h3>
        <p className="text-slate-600">Create your first job to start screening CVs</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 mb-4">Your Jobs</h2>
      <div className="space-y-4">
        {jobs.map((job) => {
          const skills: string[] = JSON.parse(job.required_skills || '[]');
          return (
            <div
              key={job.id}
              className="border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
              onClick={() => setSelectedJobId(job.id)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <h3 className="text-lg font-semibold text-slate-900">{job.title}</h3>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        job.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div className="flex items-center space-x-2 text-sm text-slate-600">
                      <MapPin className="w-4 h-4" />
                      <span>{job.location}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-slate-600">
                      <Languages className="w-4 h-4" />
                      <span>English: {job.english_level}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-slate-600">
                      <Clock className="w-4 h-4" />
                      <span>{job.minimum_experience}+ years</span>
                    </div>
                  </div>

                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {skills.map((skill) => (
                        <span
                          key={skill}
                          className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <ChevronRight className="w-5 h-5 text-slate-400 ml-4 flex-shrink-0" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
