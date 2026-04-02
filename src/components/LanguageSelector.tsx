import { useLanguage, Language } from '../contexts/LanguageContext';

const languages: { code: Language; label: string; name: string }[] = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'it', label: 'IT', name: 'Italiano' },
  { code: 'es', label: 'ES', name: 'Español' },
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'de', label: 'DE', name: 'Deutsch' },
  { code: 'pt-BR', label: 'PT', name: 'Português' },
  { code: 'nl', label: 'NL', name: 'Nederlands' },
];

export default function LanguageSelector() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex gap-2">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLanguage(lang.code)}
          className={`px-3 py-1 rounded-lg font-semibold text-sm transition-all ${
            language === lang.code
              ? 'bg-blue-600 text-white'
              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
          }`}
          title={lang.name}
          aria-label={`Switch to ${lang.name}`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
