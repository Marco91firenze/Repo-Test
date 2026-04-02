export interface ElectronAPI {
  // User Profile
  getUserProfile: () => Promise<{ success: boolean; data?: any; error?: string }>;
  createUserProfile: (data: { id: string; company_name: string; email: string }) => Promise<{ success: boolean; data?: any; error?: string }>;

  // Jobs
  getJobs: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
  getJob: (jobId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  createJob: (jobData: any) => Promise<{ success: boolean; error?: string }>;
  deleteJob: (jobId: string) => Promise<{ success: boolean; error?: string }>;

  // CV Processing
  selectFiles: () => Promise<string[]>;
  processCv: (filePath: string, jobId: string) => Promise<{ success: boolean; data?: any; error?: string }>;

  // Results
  getResults: (jobId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
  deleteResult: (resultId: string) => Promise<{ success: boolean; error?: string }>;
  clearResults: (jobId: string) => Promise<{ success: boolean; error?: string }>;

  // Credits
  getCredits: () => Promise<{ success: boolean; data?: { credits_remaining: number }; error?: string }>;
  purchaseCredits: (packageSize: string) => Promise<{ success: boolean; error?: string }>;
  syncPurchases: () => Promise<{ success: boolean; data?: { new_credits: number }; error?: string }>;

  // Settings
  getSettings: () => Promise<{ success: boolean; data?: Record<string, string>; error?: string }>;
  updateSettings: (key: string, value: string) => Promise<{ success: boolean; error?: string }>;

  // Ollama
  checkOllama: () => Promise<{ success: boolean; data?: { available: boolean; models?: string[]; url?: string }; error?: string }>;
  setupOllama: () => Promise<{ success: boolean; data?: { model: string }; error?: string }>;
  onOllamaPullProgress: (callback: (data: { status: string; completed?: number; total?: number }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
