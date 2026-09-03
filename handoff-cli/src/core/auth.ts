import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_FILE = path.join(os.homedir(), '.handoff_config.json');

interface Config {
  apiKey?: string;     // Your Handoff.io Dashboard Key
  geminiKey?: string;  // The user's personal Google Gemini Key
}

function getConfig(): Config {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch (err) {
      return {};
    }
  }
  return {};
}

function saveConfig(config: Config): void {
  // Saves the keys locally with strict OS-level permissions (mode 0o600)
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), {
    encoding: 'utf-8',
    mode: 0o600 
  });
}

// --- Handoff API Key ---
export function getSavedKey(): string | null {
  return getConfig().apiKey || null;
}

export function saveKey(apiKey: string): void {
  saveConfig({ ...getConfig(), apiKey });
}

// --- Gemini API Key ---
export function getGeminiKey(): string | null {
  return getConfig().geminiKey || null;
}

export function saveGeminiKey(geminiKey: string): void {
  saveConfig({ ...getConfig(), geminiKey });
}

// --- Clear All ---
export function clearKey(): void {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
  }
}