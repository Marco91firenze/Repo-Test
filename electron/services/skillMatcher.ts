export interface SkillVariation { canonical: string; variations: string[]; relatedSkills: string[]; }
export interface SkillMatchResult { found: boolean; variations: string[]; relatedFound: string[]; confidence: number; yearsUsed: number; mentionCount: number; inSkillsSection: boolean; inExperienceSection: boolean; }

const skillDatabase: SkillVariation[] = [
  { canonical: "JavaScript", variations: ["javascript","js","ecmascript","es6","es2015","es2020","vanilla js"], relatedSkills: ["TypeScript","Node.js","React","npm"] },
  { canonical: "TypeScript", variations: ["typescript","ts"], relatedSkills: ["JavaScript","Node.js","Angular"] },
  { canonical: "Python", variations: ["python","python3","python2","cpython"], relatedSkills: ["Django","Flask","FastAPI","pandas","NumPy"] },
  { canonical: "Java", variations: ["java","j2ee","jee","java ee","java se","openjdk"], relatedSkills: ["Spring","Maven","Hibernate","Gradle"] },
  { canonical: "C#", variations: ["c#","csharp","c sharp","c-sharp"], relatedSkills: [".NET","ASP.NET","Entity Framework","Unity"] },
  { canonical: "C++", variations: ["cpp","c plus plus"], relatedSkills: ["C","Systems Programming","STL"] },
  { canonical: "C", variations: ["c language","ansi c","c99","c11"], relatedSkills: ["C++","Embedded","Systems Programming"] },
  { canonical: "Go", variations: ["golang","go lang","go programming"], relatedSkills: ["Microservices","Docker","Kubernetes"] },
  { canonical: "Rust", variations: ["rust","rustlang"], relatedSkills: ["Systems Programming","WebAssembly"] },
  { canonical: "PHP", variations: ["php","php7","php8"], relatedSkills: ["Laravel","WordPress","Symfony"] },
  { canonical: "Ruby", variations: ["ruby","ruby on rails","rails","ror"], relatedSkills: ["Rails","Sinatra","RSpec"] },
  { canonical: "Swift", variations: ["swift","swiftui"], relatedSkills: ["iOS","Xcode","UIKit"] },
  { canonical: "Kotlin", variations: ["kotlin"], relatedSkills: ["Android","JVM","Java"] },
  { canonical: "Scala", variations: ["scala"], relatedSkills: ["JVM","Akka","Spark"] },
  { canonical: "R", variations: ["r programming","r language","rstudio","r-project"], relatedSkills: ["Statistics","Data Science"] },
  { canonical: "MATLAB", variations: ["matlab"], relatedSkills: ["Simulink","Signal Processing"] },
  { canonical: "Perl", variations: ["perl"], relatedSkills: ["Regex","Scripting"] },
  { canonical: "Dart", variations: ["dart"], relatedSkills: ["Flutter","Mobile Development"] },
  { canonical: "Elixir", variations: ["elixir"], relatedSkills: ["Phoenix","Erlang"] },
  { canonical: "Haskell", variations: ["haskell"], relatedSkills: ["Functional Programming"] },
  { canonical: "Shell Scripting", variations: ["bash","shell scripting","zsh","powershell","shell script"], relatedSkills: ["Linux","DevOps"] },
  { canonical: "SQL", variations: ["sql","structured query language","plsql","pl/sql","tsql","t-sql"], relatedSkills: ["MySQL","PostgreSQL","Database Design"] },
  { canonical: "HTML", variations: ["html","html5"], relatedSkills: ["CSS","Web Development"] },
  { canonical: "CSS", variations: ["css","css3","scss","sass","less"], relatedSkills: ["HTML","Tailwind","Bootstrap"] },
  { canonical: "Solidity", variations: ["solidity"], relatedSkills: ["Ethereum","Blockchain"] },
  { canonical: "VBA", variations: ["vba","visual basic","vb.net"], relatedSkills: ["Excel","Macros"] },
  { canonical: "Objective-C", variations: ["objective-c","objc","objective c"], relatedSkills: ["iOS","macOS"] },
  { canonical: "ABAP", variations: ["abap"], relatedSkills: ["SAP","ERP"] },
  { canonical: "React", variations: ["react","reactjs","react.js","react js","react hooks"], relatedSkills: ["JSX","Redux","Next.js","JavaScript"] },
  { canonical: "Angular", variations: ["angular","angularjs","angular.js","angular js"], relatedSkills: ["RxJS","NgRx","TypeScript"] },
  { canonical: "Vue.js", variations: ["vue","vuejs","vue.js","vue js","vue3"], relatedSkills: ["Vuex","Nuxt","Pinia"] },
  { canonical: "Next.js", variations: ["next.js","nextjs","next js"], relatedSkills: ["React","Vercel","SSR"] },
  { canonical: "Svelte", variations: ["svelte","sveltekit"], relatedSkills: ["JavaScript"] },
  { canonical: "jQuery", variations: ["jquery"], relatedSkills: ["JavaScript","DOM"] },
  { canonical: "Bootstrap", variations: ["bootstrap","bootstrap 5","bootstrap 4"], relatedSkills: ["CSS","Responsive Design"] },
  { canonical: "Tailwind CSS", variations: ["tailwind","tailwindcss","tailwind css"], relatedSkills: ["CSS"] },
  { canonical: "Material UI", variations: ["material ui","mui","material design"], relatedSkills: ["React","UI Design"] },
  { canonical: "Redux", variations: ["redux","redux toolkit","rtk"], relatedSkills: ["React","State Management"] },
  { canonical: "Webpack", variations: ["webpack"], relatedSkills: ["JavaScript","Build Tools"] },
  { canonical: "Storybook", variations: ["storybook"], relatedSkills: ["UI Components"] },
  { canonical: "Node.js", variations: ["nodejs","node.js","node js"], relatedSkills: ["Express","JavaScript","npm"] },
  { canonical: "Express", variations: ["express","expressjs","express.js"], relatedSkills: ["Node.js","REST API"] },
  { canonical: "NestJS", variations: ["nestjs","nest.js","nest js"], relatedSkills: ["Node.js","TypeScript"] },
  { canonical: "Django", variations: ["django","django rest framework","drf"], relatedSkills: ["Python","REST API"] },
  { canonical: "Flask", variations: ["flask"], relatedSkills: ["Python","REST API"] },
  { canonical: "FastAPI", variations: ["fastapi","fast api"], relatedSkills: ["Python","REST API"] },
  { canonical: "Spring", variations: ["spring","spring boot","spring framework","spring mvc","springboot"], relatedSkills: ["Java","Microservices"] },
  { canonical: ".NET", variations: [".net","dotnet","asp.net","asp.net core",".net core",".net framework","blazor"], relatedSkills: ["C#","Entity Framework","Azure"] },
  { canonical: "Laravel", variations: ["laravel"], relatedSkills: ["PHP"] },
  { canonical: "Symfony", variations: ["symfony"], relatedSkills: ["PHP"] },
  { canonical: "Rails", variations: ["rails","ruby on rails","ror"], relatedSkills: ["Ruby"] },
  { canonical: "MySQL", variations: ["mysql","mariadb"], relatedSkills: ["SQL","Database Design"] },
  { canonical: "PostgreSQL", variations: ["postgresql","postgres","psql"], relatedSkills: ["SQL","Database Design"] },
  { canonical: "MongoDB", variations: ["mongodb","mongo","mongoose"], relatedSkills: ["NoSQL"] },
  { canonical: "Redis", variations: ["redis"], relatedSkills: ["Caching","In-Memory Database"] },
  { canonical: "Elasticsearch", variations: ["elasticsearch","elastic search","elk","kibana"], relatedSkills: ["Search","Logging"] },
  { canonical: "Oracle Database", variations: ["oracle","oracle db","oracle database"], relatedSkills: ["SQL","Enterprise"] },
  { canonical: "SQL Server", variations: ["sql server","mssql","ms sql","microsoft sql server"], relatedSkills: ["SQL",".NET"] },
  { canonical: "SQLite", variations: ["sqlite","sqlite3"], relatedSkills: ["SQL"] },
  { canonical: "DynamoDB", variations: ["dynamodb","dynamo db"], relatedSkills: ["AWS","NoSQL"] },
  { canonical: "Cassandra", variations: ["cassandra","apache cassandra"], relatedSkills: ["NoSQL"] },
  { canonical: "Neo4j", variations: ["neo4j","graph database"], relatedSkills: ["Graph Database"] },
  { canonical: "Firebase", variations: ["firebase","firestore"], relatedSkills: ["Google Cloud","NoSQL"] },
  { canonical: "Supabase", variations: ["supabase"], relatedSkills: ["PostgreSQL"] },
  { canonical: "AWS", variations: ["aws","amazon web services"], relatedSkills: ["EC2","S3","Lambda","Cloud Computing"] },
  { canonical: "Azure", variations: ["azure","microsoft azure","azure devops"], relatedSkills: ["Cloud Computing",".NET"] },
  { canonical: "GCP", variations: ["gcp","google cloud","google cloud platform"], relatedSkills: ["Cloud Computing","BigQuery"] },
  { canonical: "Heroku", variations: ["heroku"], relatedSkills: ["PaaS"] },
  { canonical: "Vercel", variations: ["vercel"], relatedSkills: ["Next.js","Serverless"] },
  { canonical: "AWS Lambda", variations: ["lambda","aws lambda","serverless"], relatedSkills: ["AWS"] },
  { canonical: "AWS S3", variations: ["s3","aws s3","amazon s3"], relatedSkills: ["AWS"] },
  { canonical: "Docker", variations: ["docker","dockerfile","docker compose","docker-compose","containerization","containers"], relatedSkills: ["Kubernetes","DevOps","CI/CD"] },
  { canonical: "Kubernetes", variations: ["kubernetes","k8s","kubectl","helm","openshift"], relatedSkills: ["Docker","DevOps"] },
  { canonical: "Terraform", variations: ["terraform","hcl","infrastructure as code","iac"], relatedSkills: ["Cloud","DevOps"] },
  { canonical: "Ansible", variations: ["ansible","ansible playbook"], relatedSkills: ["DevOps","Automation"] },
  { canonical: "Jenkins", variations: ["jenkins"], relatedSkills: ["CI/CD","DevOps"] },
  { canonical: "GitHub Actions", variations: ["github actions","gh actions"], relatedSkills: ["CI/CD","GitHub"] },
  { canonical: "CI/CD", variations: ["ci/cd","cicd","ci cd","continuous integration","continuous deployment","continuous delivery"], relatedSkills: ["Jenkins","GitHub Actions","DevOps"] },
  { canonical: "Nginx", variations: ["nginx"], relatedSkills: ["Web Server","Reverse Proxy"] },
  { canonical: "Prometheus", variations: ["prometheus"], relatedSkills: ["Monitoring","Grafana"] },
  { canonical: "Grafana", variations: ["grafana"], relatedSkills: ["Monitoring"] },
  { canonical: "Datadog", variations: ["datadog"], relatedSkills: ["Monitoring","APM"] },
  { canonical: "Linux", variations: ["linux","unix","ubuntu","centos","debian","red hat","rhel","fedora"], relatedSkills: ["Shell Scripting","System Administration"] },
  { canonical: "Git", variations: ["git","version control","gitflow"], relatedSkills: ["GitHub","GitLab"] },
  { canonical: "GitHub", variations: ["github"], relatedSkills: ["Git","GitHub Actions"] },
  { canonical: "GitLab", variations: ["gitlab"], relatedSkills: ["Git","GitLab CI"] },
  { canonical: "REST API", variations: ["rest","restful","rest api","restful api"], relatedSkills: ["API Design","HTTP","JSON"] },
  { canonical: "GraphQL", variations: ["graphql","graph ql","apollo graphql"], relatedSkills: ["API Design"] },
  { canonical: "gRPC", variations: ["grpc","protocol buffers","protobuf"], relatedSkills: ["Microservices"] },
  { canonical: "Microservices", variations: ["microservices","micro services","microservice architecture","soa"], relatedSkills: ["Docker","Kubernetes"] },
  { canonical: "Kafka", variations: ["kafka","apache kafka"], relatedSkills: ["Event Streaming"] },
  { canonical: "RabbitMQ", variations: ["rabbitmq","rabbit mq","amqp"], relatedSkills: ["Message Queue"] },
  { canonical: "WebSocket", variations: ["websocket","websockets","socket.io","socketio"], relatedSkills: ["Real-time"] },
  { canonical: "OAuth", variations: ["oauth","oauth2","oauth 2.0","openid connect","oidc"], relatedSkills: ["Authentication","Security"] },
  { canonical: "JWT", variations: ["jwt","json web token"], relatedSkills: ["Authentication","Security"] },
  { canonical: "Unit Testing", variations: ["unit testing","unit tests","tdd","test driven development"], relatedSkills: ["Jest","JUnit","pytest"] },
  { canonical: "Jest", variations: ["jest"], relatedSkills: ["JavaScript","Testing"] },
  { canonical: "Cypress", variations: ["cypress"], relatedSkills: ["E2E Testing"] },
  { canonical: "Selenium", variations: ["selenium","selenium webdriver"], relatedSkills: ["E2E Testing"] },
  { canonical: "Playwright", variations: ["playwright"], relatedSkills: ["E2E Testing"] },
  { canonical: "Test Automation", variations: ["test automation","automated testing","qa automation"], relatedSkills: ["Selenium","Cypress"] },
  { canonical: "React Native", variations: ["react native","react-native"], relatedSkills: ["React","Mobile Development"] },
  { canonical: "Flutter", variations: ["flutter"], relatedSkills: ["Dart","Mobile Development"] },
  { canonical: "iOS Development", variations: ["ios","ios development"], relatedSkills: ["Swift","Xcode"] },
  { canonical: "Android Development", variations: ["android","android development","android studio"], relatedSkills: ["Kotlin","Java"] },
  { canonical: "Machine Learning", variations: ["machine learning","ml","deep learning","neural networks"], relatedSkills: ["TensorFlow","PyTorch","Data Science"] },
  { canonical: "Artificial Intelligence", variations: ["artificial intelligence","ai","generative ai","gen ai","genai"], relatedSkills: ["Machine Learning","NLP"] },
  { canonical: "TensorFlow", variations: ["tensorflow","keras"], relatedSkills: ["Machine Learning","Python"] },
  { canonical: "PyTorch", variations: ["pytorch","torch"], relatedSkills: ["Machine Learning","Python"] },
  { canonical: "scikit-learn", variations: ["scikit-learn","sklearn","scikit learn"], relatedSkills: ["Machine Learning","Python"] },
  { canonical: "NLP", variations: ["nlp","natural language processing","text mining","spacy","nltk","hugging face","huggingface","transformers"], relatedSkills: ["Machine Learning","AI"] },
  { canonical: "Computer Vision", variations: ["computer vision","image recognition","opencv"], relatedSkills: ["Machine Learning"] },
  { canonical: "Data Science", variations: ["data science","data analysis","data analytics","data engineering","data mining"], relatedSkills: ["Statistics","Python"] },
  { canonical: "pandas", variations: ["pandas"], relatedSkills: ["Python","Data Science"] },
  { canonical: "NumPy", variations: ["numpy"], relatedSkills: ["Python","Data Science"] },
  { canonical: "Apache Spark", variations: ["spark","apache spark","pyspark"], relatedSkills: ["Big Data"] },
  { canonical: "ETL", variations: ["etl","extract transform load","data pipeline","airflow","apache airflow"], relatedSkills: ["Data Engineering"] },
  { canonical: "Snowflake", variations: ["snowflake"], relatedSkills: ["Data Warehouse","SQL"] },
  { canonical: "LLM", variations: ["llm","large language model","chatgpt","gpt","openai","langchain","prompt engineering"], relatedSkills: ["AI","NLP"] },
  { canonical: "Power BI", variations: ["power bi","powerbi"], relatedSkills: ["Data Visualization","Business Intelligence"] },
  { canonical: "Tableau", variations: ["tableau"], relatedSkills: ["Data Visualization"] },
  { canonical: "Excel", variations: ["excel","microsoft excel","spreadsheets","pivot tables","vlookup"], relatedSkills: ["VBA","Data Analysis"] },
  { canonical: "Figma", variations: ["figma"], relatedSkills: ["UI Design","Prototyping"] },
  { canonical: "Adobe Photoshop", variations: ["photoshop","adobe photoshop"], relatedSkills: ["Graphic Design"] },
  { canonical: "Adobe Illustrator", variations: ["illustrator","adobe illustrator"], relatedSkills: ["Graphic Design"] },
  { canonical: "UX Design", variations: ["ux","ux design","user experience","ux research","usability testing"], relatedSkills: ["UI Design","Figma"] },
  { canonical: "UI Design", variations: ["ui design","user interface","interface design","visual design"], relatedSkills: ["UX Design","Figma"] },
  { canonical: "Cybersecurity", variations: ["cybersecurity","cyber security","information security","infosec"], relatedSkills: ["Network Security","Penetration Testing"] },
  { canonical: "Penetration Testing", variations: ["penetration testing","pen testing","pentest","ethical hacking"], relatedSkills: ["Cybersecurity"] },
  { canonical: "SIEM", variations: ["siem","splunk","qradar"], relatedSkills: ["Cybersecurity"] },
  { canonical: "Agile", variations: ["agile","agile methodology","agile development"], relatedSkills: ["Scrum","Kanban"] },
  { canonical: "Scrum", variations: ["scrum","scrum master","sprint","sprint planning"], relatedSkills: ["Agile","Project Management"] },
  { canonical: "Project Management", variations: ["project management","project manager","program management"], relatedSkills: ["Agile","Scrum","Jira"] },
  { canonical: "Product Management", variations: ["product management","product manager","product owner","product roadmap"], relatedSkills: ["Agile","UX"] },
  { canonical: "Jira", variations: ["jira","atlassian jira"], relatedSkills: ["Agile","Project Management"] },
  { canonical: "Lean", variations: ["lean","lean methodology","lean six sigma"], relatedSkills: ["Six Sigma"] },
  { canonical: "Six Sigma", variations: ["six sigma","dmaic","green belt","black belt"], relatedSkills: ["Lean"] },
  { canonical: "PMP", variations: ["pmp","project management professional"], relatedSkills: ["Project Management"] },
  { canonical: "Salesforce", variations: ["salesforce","sfdc","apex","salesforce crm","soql"], relatedSkills: ["CRM"] },
  { canonical: "SAP", variations: ["sap","sap erp","sap hana","sap s/4hana","sap fi","sap mm"], relatedSkills: ["ERP","ABAP"] },
  { canonical: "HubSpot", variations: ["hubspot"], relatedSkills: ["CRM","Marketing Automation"] },
  { canonical: "SEO", variations: ["seo","search engine optimization","search engine optimisation"], relatedSkills: ["Content Marketing","Google Analytics"] },
  { canonical: "SEM", variations: ["sem","search engine marketing","ppc","pay per click","google ads"], relatedSkills: ["SEO","Digital Marketing"] },
  { canonical: "Google Analytics", variations: ["google analytics","ga4"], relatedSkills: ["SEO","Data Analysis"] },
  { canonical: "Content Marketing", variations: ["content marketing","content strategy","copywriting","content creation"], relatedSkills: ["SEO","Digital Marketing"] },
  { canonical: "Digital Marketing", variations: ["digital marketing","online marketing"], relatedSkills: ["SEO","SEM"] },
  { canonical: "Financial Analysis", variations: ["financial analysis","financial modeling","financial modelling","fp&a","financial reporting"], relatedSkills: ["Excel","Accounting"] },
  { canonical: "Accounting", variations: ["accounting","bookkeeping","accounts payable","accounts receivable","gaap","ifrs"], relatedSkills: ["Financial Analysis"] },
  { canonical: "Risk Management", variations: ["risk management","risk assessment","risk analysis"], relatedSkills: ["Compliance"] },
  { canonical: "Recruiting", variations: ["recruiting","recruitment","talent acquisition","sourcing","headhunting"], relatedSkills: ["HR"] },
  { canonical: "HR Management", variations: ["human resources","hr management","people management","people operations"], relatedSkills: ["Recruiting"] },
  { canonical: "Compliance", variations: ["compliance","regulatory compliance","gdpr","hipaa","sox","aml","kyc"], relatedSkills: ["Risk Management"] },
  { canonical: "Supply Chain Management", variations: ["supply chain","supply chain management","scm","logistics","procurement"], relatedSkills: ["Operations"] },
  { canonical: "ERP", variations: ["erp","enterprise resource planning"], relatedSkills: ["SAP"] },
  { canonical: "Quality Management", variations: ["quality management","quality assurance","quality control","iso 9001","tqm"], relatedSkills: ["Six Sigma","Lean"] },
  { canonical: "AutoCAD", variations: ["autocad","auto cad"], relatedSkills: ["CAD","Engineering Design"] },
  { canonical: "SolidWorks", variations: ["solidworks","solid works"], relatedSkills: ["CAD"] },
  { canonical: "BIM", variations: ["bim","building information modeling"], relatedSkills: ["Revit","Architecture"] },
  { canonical: "Leadership", variations: ["leadership","team lead","team leader","tech lead","technical lead","team management","managing teams"], relatedSkills: ["Management","Communication"] },
  { canonical: "Communication", variations: ["communication","communication skills","public speaking","presentation skills","stakeholder management"], relatedSkills: ["Leadership","Teamwork"] },
  { canonical: "Teamwork", variations: ["teamwork","team player","collaboration","collaborative","cross-functional"], relatedSkills: ["Communication"] },
  { canonical: "Problem Solving", variations: ["problem solving","problem-solving","analytical thinking","critical thinking","troubleshooting"], relatedSkills: ["Analytical Skills"] },
  { canonical: "Mentoring", variations: ["mentoring","coaching","training","onboarding","knowledge transfer"], relatedSkills: ["Leadership"] },
  { canonical: "Negotiation", variations: ["negotiation","negotiations"], relatedSkills: ["Communication","Sales"] },
  { canonical: "Customer Service", variations: ["customer service","customer support","client relations","customer success"], relatedSkills: ["Communication"] },
  { canonical: "Sales", variations: ["sales","business development","account management","b2b sales","lead generation"], relatedSkills: ["Negotiation","CRM"] },
  { canonical: "AWS Certified", variations: ["aws certified","aws solutions architect","aws developer"], relatedSkills: ["AWS"] },
  { canonical: "CISSP", variations: ["cissp"], relatedSkills: ["Cybersecurity"] },
  { canonical: "CKA", variations: ["cka","certified kubernetes administrator","ckad"], relatedSkills: ["Kubernetes"] },
  { canonical: "ITIL", variations: ["itil","itil v4"], relatedSkills: ["IT Service Management"] },
  { canonical: "Scrum Master Certified", variations: ["csm","psm","certified scrum master"], relatedSkills: ["Scrum","Agile"] },
  { canonical: "CPA", variations: ["cpa","certified public accountant"], relatedSkills: ["Accounting"] },
  { canonical: "CFA", variations: ["cfa","chartered financial analyst"], relatedSkills: ["Finance"] },
];

function detectSections(text: string): { skillsSection: string; experienceSection: string; fullText: string } {
  const lines = text.split('\n');
  let cur = 'other';
  const s: Record<string, string[]> = { skills: [], experience: [], other: [] };
  const skillH = /^\s*(technical\s+)?skills|competenze|technologies|tech\s+stack|tools?\s*(&|and)\s*technologies|core\s+competencies|proficiencies/i;
  const expH = /^\s*(work\s+)?experience|employment|professional\s+experience|work\s+history|career\s+history|positions?\s+held/i;
  const otherH = /^\s*(education|qualifications|certifications?|training|interests|references|publications|awards|languages|summary|profile|objective|about\s+me)/i;
  for (const line of lines) {
    const t = line.trim();
    if (skillH.test(t)) { cur = 'skills'; continue; }
    if (expH.test(t)) { cur = 'experience'; continue; }
    if (otherH.test(t)) { cur = 'other'; continue; }
    if (t.length > 2 && t.length < 40 && /^[A-Z\s&\/]+$/.test(t)) cur = 'other';
    s[cur].push(line);
  }
  return { skillsSection: s.skills.join('\n'), experienceSection: s.experience.join('\n'), fullText: text };
}

function extractSkillYears(text: string, variations: string[]): number {
  for (const v of variations) {
    const e = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pats = [
      new RegExp('(\\d+)\\s*\\+?\\s*(?:years?|yrs?)\\s+(?:of\\s+)?(?:experience\\s+(?:in|with)\\s+)?(?:working\\s+with\\s+)?' + e, 'gi'),
      new RegExp(e + '\\s*[:\\(\\-]\\s*(\\d+)\\s*\\+?\\s*(?:years?|yrs?)', 'gi'),
      new RegExp(e + '\\s+\\(\\s*(\\d+)\\s*\\+?\\s*(?:years?|yrs?)\\s*\\)', 'gi'),
    ];
    for (const rx of pats) { const m = rx.exec(text); if (m) { const y = parseInt(m[1]); if (y > 0 && y <= 40) return y; } }
  }
  return 0;
}

function bigramSimilarity(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const bg = (s: string) => { const r = new Set<string>(); for (let i = 0; i < s.length - 1; i++) r.add(s.substring(i, i + 2)); return r; };
  const aB = bg(a.toLowerCase()), bB = bg(b.toLowerCase());
  let n = 0; for (const x of aB) if (bB.has(x)) n++;
  return (2 * n) / (aB.size + bB.size);
}

function fuzzyMatch(skill: string, text: string): { found: boolean; confidence: number; matchedTerm: string } {
  const sl = skill.toLowerCase();
  if (sl.length < 4) return { found: false, confidence: 0, matchedTerm: '' };
  const words = text.toLowerCase().split(/[\s,;|\/()[\]{}]+/).filter(w => w.length >= 3);
  for (const w of words) {
    if (Math.abs(w.length - sl.length) > 2) continue;
    const sim = bigramSimilarity(sl, w);
    if (sim >= 0.7) return { found: true, confidence: Math.round(sim * 50), matchedTerm: w };
  }
  const sentences = text.toLowerCase().split(/[.!?\n,;]+/);
  for (const sent of sentences) {
    const sw = sent.trim().split(/\s+/);
    for (let i = 0; i < sw.length - 1; i++) {
      const ph = sw[i] + ' ' + sw[i + 1];
      const sim = bigramSimilarity(sl, ph);
      if (sim >= 0.7) return { found: true, confidence: Math.round(sim * 55), matchedTerm: ph };
    }
  }
  return { found: false, confidence: 0, matchedTerm: '' };
}

function escapeRegex(str: string): string { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function buildWordBoundaryRegex(variation: string): RegExp {
  const e = escapeRegex(variation);
  if (variation.length <= 2) return new RegExp('(?:^|[\\s,;:(])' + e + '(?=[\\s,;:)\/+.]|$)', 'gi');
  return new RegExp('\\b' + e + '\\b', 'gi');
}

export function normalizeSkill(skill: string): string {
  const n = skill.toLowerCase().trim();
  for (const entry of skillDatabase) {
    if (entry.canonical.toLowerCase() === n) return entry.canonical;
    for (const v of entry.variations) { if (v === n) return entry.canonical; }
  }
  return skill.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export function findSkillMatches(cvText: string, requiredSkills: string[]): Map<string, SkillMatchResult> {
  const results = new Map<string, SkillMatchResult>();
  const sections = detectSections(cvText);
  for (const req of requiredSkills) {
    const canonical = normalizeSkill(req);
    const entry = skillDatabase.find(e => e.canonical === canonical);
    const foundVariations: string[] = [];
    const relatedFound: string[] = [];
    let totalMentions = 0, inSkillsSection = false, inExperienceSection = false, yearsUsed = 0;
    if (entry) {
      const allVars = [entry.canonical.toLowerCase(), ...entry.variations];
      for (const v of allVars) {
        const rx = buildWordBoundaryRegex(v);
        const ms = cvText.match(rx);
        if (ms && ms.length > 0) {
          if (!foundVariations.includes(v)) foundVariations.push(v);
          totalMentions += ms.length;
          if (sections.skillsSection && rx.test(sections.skillsSection)) inSkillsSection = true;
          if (sections.experienceSection && rx.test(sections.experienceSection)) inExperienceSection = true;
        }
      }
      for (const rel of entry.relatedSkills) {
        const re = skillDatabase.find(e => e.canonical === rel);
        const rv = re ? [re.canonical.toLowerCase(), ...re.variations] : [rel.toLowerCase()];
        for (const v of rv) { if (buildWordBoundaryRegex(v).test(cvText)) { if (!relatedFound.includes(rel)) relatedFound.push(rel); break; } }
      }
      yearsUsed = extractSkillYears(cvText, allVars);
    } else {
      const drx = buildWordBoundaryRegex(req.toLowerCase());
      const dm = cvText.match(drx);
      if (dm && dm.length > 0) {
        foundVariations.push(req.toLowerCase()); totalMentions = dm.length;
        if (sections.skillsSection && drx.test(sections.skillsSection)) inSkillsSection = true;
        if (sections.experienceSection && drx.test(sections.experienceSection)) inExperienceSection = true;
      } else {
        const fz = fuzzyMatch(req, cvText);
        if (fz.found) { foundVariations.push(fz.matchedTerm); totalMentions = 1; }
      }
      yearsUsed = extractSkillYears(cvText, [req.toLowerCase()]);
    }
    const found = foundVariations.length > 0;
    let confidence = 0;
    if (found) {
      if (totalMentions >= 5) confidence = 92;
      else if (totalMentions >= 3) confidence = 85;
      else if (totalMentions >= 2) confidence = 75;
      else confidence = 60;
      if (inSkillsSection) confidence += 8;
      if (inExperienceSection) confidence += 10;
      confidence += Math.min(15, relatedFound.length * 5);
      if (yearsUsed > 0) confidence += 5;
      if (totalMentions === 1 && !inSkillsSection && !inExperienceSection) confidence -= 15;
      confidence = Math.min(100, Math.max(10, confidence));
    } else if (relatedFound.length > 0) { confidence = Math.min(40, 15 + relatedFound.length * 8); }
    results.set(canonical, { found, variations: foundVariations, relatedFound, confidence, yearsUsed, mentionCount: totalMentions, inSkillsSection, inExperienceSection });
  }
  return results;
}

export function extractSkillEvidence(cvText: string, skill: string, maxLength: number = 200): string {
  if (!cvText || cvText.length === 0) return '';
  const entry = skillDatabase.find(e => e.canonical === skill);
  const vars = entry ? [entry.canonical.toLowerCase(), ...entry.variations] : [skill.toLowerCase()];
  const sections = detectSections(cvText);
  const sentences = cvText.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length > 10);
  if (sections.experienceSection) {
    const es = sections.experienceSection.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length > 10);
    for (const s of es) { const sl = s.toLowerCase(); for (const v of vars) { if (sl.includes(v)) return s.length > maxLength ? s.substring(0, maxLength) + '...' : s; } }
  }
  const scored: { text: string; score: number }[] = [];
  for (const s of sentences) { const sl = s.toLowerCase(); for (const v of vars) { if (sl.includes(v)) { scored.push({ text: s, score: s.split(/\s+/).length >= 5 ? s.split(/\s+/).length : 0 }); break; } } }
  scored.sort((a, b) => b.score - a.score);
  if (scored.length > 0) { const b = scored[0].text; return b.length > maxLength ? b.substring(0, maxLength) + '...' : b; }
  return '';
}
