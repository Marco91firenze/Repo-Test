import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { initializeDatabase, getUserProfile, createUserProfile, getJobs, getJob, createJob, deleteJob, getResultsForJob, deleteResult, clearResultsForJob, getSetting, setSetting, getAllSettings, deductCredit, updateCredits } from './services/database.js';
import { processCVFile } from './services/cvProcessor.js';
import { checkOllamaStatus, ensureModelAvailable } from './services/ollamaClient.js';
import { openCheckout, syncPurchases } from './services/purchaseManager.js';

let mainWindow: BrowserWindow | null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = !app.isPackaged;

  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', async () => {
  await initializeDatabase();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// ── User Profile ──

ipcMain.handle('get-user-profile', async () => {
  try {
    const profile = getUserProfile();
    return { success: true, data: profile || null };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('create-user-profile', async (_event, data: { id: string; company_name: string; email: string }) => {
  try {
    const profile = createUserProfile(data);
    return { success: true, data: profile };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// ── Jobs ──

ipcMain.handle('get-jobs', async () => {
  try {
    const jobs = getJobs();
    return { success: true, data: jobs };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('get-job', async (_event, jobId: string) => {
  try {
    const job = getJob(jobId);
    return { success: true, data: job || null };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('create-job', async (_event, jobData: {
  id: string;
  title: string;
  location: string;
  english_level: string;
  minimum_experience: number;
  required_skills: string[];
  description: string;
  scoring_parameters?: Record<string, unknown> | null;
}) => {
  try {
    const job = createJob(jobData);
    return { success: true, data: job };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('delete-job', async (_event, jobId: string) => {
  try {
    deleteJob(jobId);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// ── CV Processing ──

ipcMain.handle('select-files', async () => {
  if (!mainWindow) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'CV Files', extensions: ['pdf', 'docx', 'doc'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return result.filePaths;
});

ipcMain.handle('process-cv', async (_event, filePath: string, jobId: string) => {
  try {
    const result = await processCVFile(filePath, jobId);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// ── Results ──

ipcMain.handle('get-results', async (_event, jobId: string) => {
  try {
    const results = getResultsForJob(jobId);
    // Parse JSON fields for frontend consumption
    const parsed = results.map(r => ({
      ...r,
      skill_breakdown: JSON.parse(r.skill_breakdown || '[]'),
      key_strengths: JSON.parse(r.key_strengths || '[]'),
      gaps: JSON.parse(r.gaps || '[]'),
      risk_factors: JSON.parse(r.risk_factors || '[]'),
      reasoning_chain: JSON.parse(r.reasoning_chain || '{}'),
      skill_evidence: JSON.parse(r.skill_evidence || '{}'),
      skill_variations_matched: JSON.parse(r.skill_variations_matched || '{}'),
    }));
    return { success: true, data: parsed };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('delete-result', async (_event, resultId: string) => {
  try {
    deleteResult(resultId);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('clear-results', async (_event, jobId: string) => {
  try {
    clearResultsForJob(jobId);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// ── Credits ──

ipcMain.handle('get-credits', async () => {
  try {
    const profile = getUserProfile();
    return { success: true, data: { credits_remaining: profile?.credits_remaining ?? 0, total_cvs_selected: profile?.total_cvs_selected ?? 0 } };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('purchase-credits', async (_event, packageSize: 'batch_100' | 'batch_1000') => {
  try {
    const result = await openCheckout(packageSize);
    return result;
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('sync-purchases', async () => {
  try {
    const result = await syncPurchases();
    if (result.success) {
      const profile = getUserProfile();
      return { success: true, data: { credits_remaining: profile?.credits_remaining ?? 0, new_credits: result.newCredits } };
    }
    return result;
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// ── Settings ──

ipcMain.handle('get-settings', async () => {
  try {
    const settings = getAllSettings();
    return { success: true, data: settings };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('update-settings', async (_event, key: string, value: string) => {
  try {
    setSetting(key, value);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// ── Ollama ──

ipcMain.handle('check-ollama', async () => {
  try {
    const ollamaUrl = getSetting('ollama_url') || 'http://localhost:11434';
    const status = await checkOllamaStatus(ollamaUrl);
    return { success: true, data: status };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('setup-ollama', async () => {
  try {
    const ollamaUrl = getSetting('ollama_url') || 'http://localhost:11434';
    const preferredModel = getSetting('ollama_model') || 'llama3.1:8b';

    const modelName = await ensureModelAvailable(
      preferredModel,
      ollamaUrl,
      (status, completed, total) => {
        if (mainWindow) {
          mainWindow.webContents.send('ollama-pull-progress', { status, completed, total });
        }
      }
    );

    if (modelName) {
      return { success: true, data: { model: modelName } };
    } else {
      return { success: false, error: 'Ollama is not running. Please install and start Ollama first.' };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
});
