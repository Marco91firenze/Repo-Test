import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // User Profile
  getUserProfile: () => ipcRenderer.invoke('get-user-profile'),
  createUserProfile: (data: { id: string; company_name: string; email: string }) => ipcRenderer.invoke('create-user-profile', data),

  // Jobs
  getJobs: () => ipcRenderer.invoke('get-jobs'),
  getJob: (jobId: string) => ipcRenderer.invoke('get-job', jobId),
  createJob: (jobData: any) => ipcRenderer.invoke('create-job', jobData),
  deleteJob: (jobId: string) => ipcRenderer.invoke('delete-job', jobId),

  // CV Processing
  selectFiles: () => ipcRenderer.invoke('select-files'),
  processCv: (filePath: string, jobId: string) => ipcRenderer.invoke('process-cv', filePath, jobId),

  // Results
  getResults: (jobId: string) => ipcRenderer.invoke('get-results', jobId),
  getExistingFilenames: (jobId: string) => ipcRenderer.invoke('get-existing-filenames', jobId),
  deleteResult: (resultId: string) => ipcRenderer.invoke('delete-result', resultId),
  clearResults: (jobId: string) => ipcRenderer.invoke('clear-results', jobId),

  // Credits
  getCredits: () => ipcRenderer.invoke('get-credits'),
  purchaseCredits: (packageSize: string) => ipcRenderer.invoke('purchase-credits', packageSize),
  syncPurchases: () => ipcRenderer.invoke('sync-purchases'),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (key: string, value: string) => ipcRenderer.invoke('update-settings', key, value),

  // Ollama
  checkOllama: () => ipcRenderer.invoke('check-ollama'),
  setupOllama: () => ipcRenderer.invoke('setup-ollama'),
  onOllamaPullProgress: (callback: (data: { status: string; completed?: number; total?: number }) => void) => {
    ipcRenderer.on('ollama-pull-progress', (_event, data) => callback(data));
    return () => { ipcRenderer.removeAllListeners('ollama-pull-progress'); };
  },
});
