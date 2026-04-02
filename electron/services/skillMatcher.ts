export interface SkillVariation {
  canonical: string;
  variations: string[];
  relatedSkills: string[];
}

const skillDatabase: SkillVariation[] = [
  { canonical: 'React', variations: ['react', 'reactjs', 'react.js', 'react js'], relatedSkills: ['JSX', 'Redux', 'React Hooks', 'React Native'] },
  { canonical: 'JavaScript', variations: ['javascript', 'js', 'ecmascript', 'es6', 'es2015', 'es2020'], relatedSkills: ['TypeScript', 'Node.js', 'npm'] },
  { canonical: 'TypeScript', variations: ['typescript', 'ts'], relatedSkills: ['JavaScript', 'Type Safety'] },
  { canonical: 'Node.js', variations: ['nodejs', 'node', 'node js'], relatedSkills: ['Express', 'JavaScript', 'npm'] },
  { canonical: 'Python', variations: ['python', 'python3', 'py'], relatedSkills: ['Django', 'Flask', 'FastAPI', 'pandas'] },
  { canonical: 'AWS', variations: ['aws', 'amazon web services'], relatedSkills: ['EC2', 'S3', 'Lambda', 'Cloud Computing'] },
  { canonical: 'Docker', variations: ['docker', 'containerization'], relatedSkills: ['Kubernetes', 'DevOps', 'Container Orchestration'] },
  { canonical: 'Kubernetes', variations: ['kubernetes', 'k8s'], relatedSkills: ['Docker', 'Container Orchestration', 'DevOps'] },
  { canonical: 'SQL', variations: ['sql', 'structured query language', 'mysql', 'postgresql', 'postgres', 'sqlite', 'mssql', 'oracle'], relatedSkills: ['Database Design', 'Query Optimization'] },
  { canonical: 'Git', variations: ['git', 'version control', 'github', 'gitlab', 'bitbucket'], relatedSkills: ['GitHub', 'GitLab', 'Version Control'] },
  { canonical: 'REST API', variations: ['rest', 'restful', 'rest api', 'restful api'], relatedSkills: ['API Design', 'HTTP', 'JSON'] },
  { canonical: 'GraphQL', variations: ['graphql', 'graph ql'], relatedSkills: ['API Design', 'Apollo'] },
  { canonical: 'CI/CD', variations: ['ci/cd', 'cicd', 'continuous integration', 'continuous deployment', 'continuous delivery'], relatedSkills: ['Jenkins', 'GitHub Actions', 'DevOps'] },
  { canonical: 'Agile', variations: ['agile', 'scrum', 'kanban', 'sprint'], relatedSkills: ['Project Management', 'Scrum', 'Sprint Planning'] },
  { canonical: 'Java', variations: ['java', 'j2ee', 'jee', 'spring boot', 'spring'], relatedSkills: ['Spring', 'Maven', 'Hibernate'] },
  { canonical: 'C#', variations: ['c#', 'csharp', 'c sharp', '.net', 'dotnet', 'asp.net'], relatedSkills: ['.NET', 'ASP.NET', 'Entity Framework'] },
  { canonical: 'C++', variations: ['c++', 'cpp'], relatedSkills: ['C', 'Systems Programming'] },
  { canonical: 'Go', variations: ['go', 'golang'], relatedSkills: ['Concurrency', 'Microservices'] },
  { canonical: 'Rust', variations: ['rust', 'rustlang'], relatedSkills: ['Systems Programming', 'Memory Safety'] },
  { canonical: 'PHP', variations: ['php', 'laravel', 'symfony'], relatedSkills: ['Laravel', 'WordPress', 'Symfony'] },
  { canonical: 'Ruby', variations: ['ruby', 'ruby on rails', 'rails', 'ror'], relatedSkills: ['Rails', 'Sinatra'] },
  { canonical: 'Swift', variations: ['swift', 'ios development', 'swiftui'], relatedSkills: ['iOS', 'Xcode', 'SwiftUI'] },
  { canonical: 'Kotlin', variations: ['kotlin', 'android development'], relatedSkills: ['Android', 'JVM'] },
  { canonical: 'Vue.js', variations: ['vue', 'vuejs', 'vue.js', 'vue js'], relatedSkills: ['Vuex', 'Nuxt'] },
  { canonical: 'Angular', variations: ['angular', 'angularjs', 'angular.js', 'angular js'], relatedSkills: ['RxJS', 'NgRx'] },
  { canonical: 'MongoDB', variations: ['mongodb', 'mongo', 'nosql'], relatedSkills: ['NoSQL', 'Mongoose'] },
  { canonical: 'Redis', variations: ['redis'], relatedSkills: ['Caching', 'In-Memory Database'] },
  { canonical: 'Terraform', variations: ['terraform', 'iac', 'infrastructure as code'], relatedSkills: ['Cloud Infrastructure', 'DevOps'] },
  { canonical: 'Machine Learning', variations: ['machine learning', 'ml', 'deep learning', 'neural networks', 'ai'], relatedSkills: ['TensorFlow', 'PyTorch', 'Data Science'] },
  { canonical: 'Data Science', variations: ['data science', 'data analysis', 'data analytics', 'data engineering'], relatedSkills: ['Statistics', 'pandas', 'Machine Learning'] },
  { canonical: 'Linux', variations: ['linux', 'unix', 'ubuntu', 'centos', 'debian'], relatedSkills: ['Shell Scripting', 'Bash', 'System Administration'] },
  { canonical: 'Azure', variations: ['azure', 'microsoft azure'], relatedSkills: ['Cloud Computing', 'DevOps'] },
  { canonical: 'GCP', variations: ['gcp', 'google cloud', 'google cloud platform'], relatedSkills: ['Cloud Computing', 'BigQuery'] },
  { canonical: 'Figma', variations: ['figma'], relatedSkills: ['UI Design', 'Prototyping'] },
  { canonical: 'Salesforce', variations: ['salesforce', 'sfdc', 'apex', 'salesforce crm'], relatedSkills: ['CRM', 'Apex'] },
  { canonical: 'SAP', variations: ['sap', 'sap erp', 'abap', 'sap hana'], relatedSkills: ['ERP', 'ABAP'] },
  { canonical: 'Excel', variations: ['excel', 'microsoft excel', 'spreadsheets', 'vba', 'macros'], relatedSkills: ['VBA', 'Data Analysis'] },
  { canonical: 'Power BI', variations: ['power bi', 'powerbi'], relatedSkills: ['Data Visualization', 'Business Intelligence'] },
  { canonical: 'Tableau', variations: ['tableau'], relatedSkills: ['Data Visualization', 'Business Intelligence'] },
  { canonical: 'Project Management', variations: ['project management', 'pmp', 'prince2', 'program management'], relatedSkills: ['Agile', 'Scrum', 'Leadership'] },
];

export function normalizeSkill(skill: string): string {
  const normalized = skill.toLowerCase().trim();
  for (const entry of skillDatabase) {
    if (entry.variations.includes(normalized) || entry.canonical.toLowerCase() === normalized) {
      return entry.canonical;
    }
  }
  return skill.charAt(0).toUpperCase() + skill.slice(1).toLowerCase();
}

export interface SkillMatchResult {
  found: boolean;
  variations: string[];
  relatedFound: string[];
  confidence: number;
}

export function findSkillMatches(
  cvText: string,
  requiredSkills: string[]
): Map<string, SkillMatchResult> {
  const results = new Map<string, SkillMatchResult>();
  const cvLower = cvText.toLowerCase();

  for (const requiredSkill of requiredSkills) {
    const canonical = normalizeSkill(requiredSkill);
    const entry = skillDatabase.find(e => e.canonical === canonical);

    const foundVariations: string[] = [];
    const relatedFound: string[] = [];

    if (entry) {
      for (const variation of entry.variations) {
        if (cvLower.includes(variation)) {
          foundVariations.push(variation);
        }
      }
      for (const related of entry.relatedSkills) {
        if (cvLower.includes(related.toLowerCase())) {
          relatedFound.push(related);
        }
      }
    } else {
      if (cvLower.includes(requiredSkill.toLowerCase())) {
        foundVariations.push(requiredSkill.toLowerCase());
      }
    }

    const found = foundVariations.length > 0;
    let confidence = 0;

    if (found) {
      confidence = 70;
      const mentionCount = foundVariations.reduce((count, variation) => {
        const regex = new RegExp(variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        return count + (cvText.match(regex) || []).length;
      }, 0);

      if (mentionCount > 3) confidence = 90;
      else if (mentionCount > 1) confidence = 80;

      if (relatedFound.length > 0) {
        confidence = Math.min(100, confidence + 5);
      }
    } else if (relatedFound.length > 0) {
      confidence = 30;
    }

    results.set(canonical, { found, variations: foundVariations, relatedFound, confidence });
  }

  return results;
}

export function extractSkillEvidence(cvText: string, skill: string, maxLength: number = 150): string {
  const skillLower = skill.toLowerCase();
  const entry = skillDatabase.find(e => e.canonical === skill);
  const variations = entry ? entry.variations : [skillLower];

  const sentences = cvText.split(/[.!?\n]+/);

  for (const sentence of sentences) {
    const sentenceLower = sentence.toLowerCase();
    for (const variation of variations) {
      if (sentenceLower.includes(variation)) {
        const trimmed = sentence.trim();
        if (trimmed.length > maxLength) {
          return trimmed.substring(0, maxLength) + '...';
        }
        return trimmed;
      }
    }
  }

  return '';
}
