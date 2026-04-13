import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Plus, X, Wifi } from 'lucide-react';

interface JobFormProps {
  onJobCreated: () => void;
}

export function JobForm({ onJobCreated }: JobFormProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [isRemote, setIsRemote] = useState(false);
  const [englishLevel, setEnglishLevel] = useState('B2');
  const [minExperience, setMinExperience] = useState(0);
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setSkillInput('');
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError('');

    try {
      const result = await (window as any).electronAPI.createJob({
        id: crypto.randomUUID(),
        title,
        location: isRemote && !location ? 'Remote' : location,
        is_remote: isRemote ? 1 : 0,
        english_level: englishLevel,
        minimum_experience: minExperience,
        required_skills: skills,
        description,
      });

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to create job');
      }

      setTitle('');
      setLocation('');
      setIsRemote(false);
      setEnglishLevel('B2');
      setMinExperience(0);
      setSkills([]);
      setDescription('');
      setIsOpen(false);
      onJobCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition-colors"
      >
        <Plus className="w-5 h-5" />
        <span>{t('jobForm.createNewJob')}</span>
      </button>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-900">{t('jobForm.createNewJob')}</h2>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t('jobForm.jobTitle')}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t('jobForm.placeholderTitle')}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t('jobForm.location')}
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={isRemote ? 'Optional — job is remote' : t('jobForm.placeholderLocation')}
              required={!isRemote}
            />
            <label className="mt-2 flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isRemote}
                onChange={(e) => setIsRemote(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-600 flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 text-blue-500" />
                This job is remote
              </span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t('jobForm.minimumEnglishLevel')}
            </label>
            <select
              value={englishLevel}
              onChange={(e) => setEnglishLevel(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="A1">A1 (Beginner)</option>
              <option value="A2">A2 (Elementary)</option>
              <option value="B1">B1 (Intermediate)</option>
              <option value="B2">B2 (Upper Intermediate)</option>
              <option value="C1">C1 (Advanced)</option>
              <option value="C2">C2 (Proficient)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t('jobForm.minimumExperience')}
            </label>
            <input
              type="number"
              value={minExperience}
              onChange={(e) => setMinExperience(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="0"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            {t('jobForm.requiredSkills')}
          </label>
          <div className="flex space-x-2 mb-3">
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t('jobForm.placeholderSkill')}
            />
            <button
              type="button"
              onClick={addSkill}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg transition-colors"
            >
              {t('jobForm.add')}
            </button>
          </div>
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center space-x-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm"
                >
                  <span>{skill}</span>
                  <button type="button" onClick={() => removeSkill(skill)} className="hover:text-blue-900">
                    <X className="w-4 h-4" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            {t('jobForm.jobDescription')}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={4}
            placeholder={t('jobForm.placeholderDescription')}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex space-x-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? t('jobForm.creating') : t('jobForm.createJob')}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-6 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-3 rounded-lg transition-colors"
          >
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
