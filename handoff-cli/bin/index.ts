#!/usr/bin/env node
// Silence native-module deprecation noise (e.g. tree-sitter "main" field warnings)
process.removeAllListeners('warning');
process.on('warning', () => {});

// Catch Ctrl+C to restore the cursor and exit cleanly
process.on('SIGINT', () => {
  process.stdout.write('\x1B[?25h'); // Force cursor back on
  process.stdout.write('\n\n( ×_×) Process interrupted.\n');
  process.exit(130);
});

import * as p from '@clack/prompts';
import pc from 'picocolors';
import boxen from 'boxen';
import fs from 'fs';
import fg from 'fast-glob';
import path from 'path';

// 2. Restored Core Imports with NEW Gemini Auth
import { Sanitizer } from '../src/core/sanitizer.ts';
import { ASTExtractor } from '../src/core/parser.ts';
import { parseGitHistory } from '../src/core/git.ts';
import { getSavedKey, saveKey, clearKey, getGeminiKey, saveGeminiKey } from '../src/core/auth.ts';
import { generateHandoffReport } from '../src/core/ai.ts';
import { verifyHandoffReport } from '../src/core/verifier.ts';
import { generateHtmlReport } from '../../handoff-web/app/lib/html.ts';

// =====================================================================
// 0. TINY HELPERS
// =====================================================================
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
const clearLine = () => process.stdout.write('\r\x1B[K');

// =====================================================================
// 1. BIG BLOCK SIGN
// =====================================================================
const GLYPH_H = 8;
const GLYPH_W = 6;
const GUTTER = ' ';
const SPACE_GLYPH = Array(GLYPH_H).fill(' '.repeat(GLYPH_W));

const FONT: Record<string, string[]> = {
  H: ['█    █', '█    █', '█    █', '██████', '█    █', '█    █', '█    █', '█    █'],
  A: [' ████ ', '█    █', '█    █', '██████', '█    █', '█    █', '█    █', '█    █'],
  N: ['█    █', '██   █', '█ █  █', '█  █ █', '█   ██', '█    █', '█    █', '█    █'],
  D: ['█████ ', '█    █', '█    █', '█    █', '█    █', '█    █', '█    █', '█████ '],
  O: [' ████ ', '█    █', '█    █', '█    █', '█    █', '█    █', '█    █', ' ████ '],
  F: ['██████', '█     ', '█     ', '█████ ', '█     ', '█     ', '█     ', '█     '],
  I: ['██████', '  █   ', '  █   ', '  █   ', '  █   ', '  █   ', '  █   ', '██████'],
  '.': ['      ', '      ', '      ', '      ', '      ', '      ', '      ', ' ██   '],
  ' ': SPACE_GLYPH,
};

function renderBigText(word: string): string[] {
  const glyphs = word.toUpperCase().split('').map((ch) => FONT[ch] ?? SPACE_GLYPH);
  const rows: string[] = [];
  for (let r = 0; r < GLYPH_H; r++) {
    rows.push(glyphs.map((g) => g[r]).join(GUTTER));
  }
  return rows;
}

const FLICKER_CHARS = ['░', '▒', '▓', '█'];

async function printBigSign(word: string) {
  const rows = renderBigText(word);
  const width = rows[0].length;
  
  // Get actual terminal width, fallback to 80
  const termWidth = process.stdout.columns || 80;

  // BULLETPROOF CHECK: If the terminal is too narrow, skip the animation entirely.
  if (termWidth <= width + 2) {
    for (const row of rows) {
      console.log(pc.bold(pc.white(row.slice(0, termWidth - 1))));
    }
    return; 
  }

  for (const row of rows) {
    for (let pass = 0; pass < 3; pass++) {
      const noisy = row
        .split('')
        .map((ch) => (ch === ' ' ? ' ' : FLICKER_CHARS[Math.floor(Math.random() * FLICKER_CHARS.length)]))
        .join('');
      clearLine();
      process.stdout.write(pc.dim(noisy));
      await sleep(16);
    }
    clearLine();
    process.stdout.write(pc.bold(pc.white(row)) + '\n');
  }

  for (let i = 0; i < width; i += 3) {
    process.stdout.write(`\x1B[${GLYPH_H}A`);
    for (const row of rows) {
      const lit =
        row.slice(0, i) +
        pc.inverse(row.slice(i, Math.min(i + 3, width))) +
        row.slice(Math.min(i + 3, width));
      clearLine();
      process.stdout.write(pc.bold(pc.white(lit)) + '\n');
    }
    await sleep(10);
  }

  process.stdout.write(`\x1B[${GLYPH_H}A`);
  for (const row of rows) {
    clearLine();
    process.stdout.write(pc.bold(pc.white(row)) + '\n');
  }
}

// =====================================================================
// 2. INK MASCOT
// =====================================================================
type MascotState = 'idle' | 'scan' | 'think' | 'success' | 'error' | 'warn' | 'retry';

const ORBIT = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const PULSE = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃', '▂', '▁'];

const FACES: Record<MascotState, string[]> = {
  idle:    ['( •‿•)', '( •‿•)', '( •‿•)', '( -‿-)', '( •‿•)'],
  scan:    ['( •_•)', '( ⚆_⚆)', '( •_•)', '( ⚆_•)', '( •_⚆)'],
  think:   ['( •.•)', '( •.•)', '( ~.~)', '( •.•)'],
  retry:   ['( ⊙_⊙)', '( o_o)', '( ⊙_⊙)', '( ⊙.⊙)'],
  success: ['( ⌐■_■)'],
  error:   ['( ×_×)'],
  warn:    ['( º_º)'],
};

class InkMascot {
  private timer: NodeJS.Timeout | null = null;
  private orbitFrame = 0;
  private faceFrame = 0;
  private pulseFrame = 0;
  private message = '';
  private state: MascotState = 'idle';

  start(message: string, state: MascotState = 'scan') {
    this.message = message;
    this.state = state;
    this.orbitFrame = 0;
    this.pulseFrame = 0;
    process.stdout.write('\x1B[?25l');
    this.timer = setInterval(() => this.render(), 90);
    this.render();
  }

  update(message: string) {
    this.message = message;
  }

  private render() {
    const faces = FACES[this.state];
    if (Math.random() < 0.09) this.faceFrame = (this.faceFrame + 1) % faces.length;
    const face = faces[this.faceFrame];
    const orbit = ORBIT[this.orbitFrame % ORBIT.length];
    const wave = this.message ? PULSE[this.pulseFrame % PULSE.length] : '';

    clearLine();
    process.stdout.write(
      this.message
        ? `${pc.bold(face)}  ${pc.dim(orbit)} ${pc.white(this.message)} ${pc.dim(wave)}`
        : `${pc.bold(face)}  ${pc.dim(orbit)}`
    );

    this.orbitFrame++;
    this.pulseFrame++;
  }

  async pulse(ms: number, state: MascotState = 'idle') {
    this.start('', state);
    await sleep(ms);
    if (this.timer) clearInterval(this.timer);
    clearLine();
    process.stdout.write('\x1B[?25h');
  }

  async stop(message: string, type: 'success' | 'error' | 'warn' = 'success') {
    if (this.timer) clearInterval(this.timer);
    clearLine();
    process.stdout.write('\x1B[?25h');

    if (type === 'success') await this.inkBurst();

    const face = FACES[type][0];
    process.stdout.write(`${pc.bold(face)}  ${pc.bold(message)}\x1B[K\n`);
  }

  private async inkBurst() {
    const rings = ['·', '∘', '○', '◯', '●'];
    for (const r of rings) {
      clearLine();
      process.stdout.write(`${pc.dim(r)}  ${pc.dim('synthesizing')}`);
      await sleep(45);
    }
    clearLine();
  }
}

// =====================================================================
// 3. BOOT SEQUENCE
// =====================================================================
async function printBootLog() {
  const lines = ['sanitizer.core', '::parser', 'git::history', 'handshake :: ready'];
  for (const line of lines) {
    process.stdout.write(pc.dim('  › '));
    for (const ch of line) {
      process.stdout.write(pc.dim(ch));
      await sleep(6);
    }
    process.stdout.write(pc.dim('  ok') + '\n');
    await sleep(55);
  }
  process.stdout.write('\n');
}

async function bootSequence() {
  process.stdout.write('\x1Bc'); // Hard Clear
  await printBootLog();

  const boot = new InkMascot();
  await boot.pulse(350, 'think');

  process.stdout.write('\n');
  await printBigSign('HANDOFF.IO');
  process.stdout.write('\n');

  const subtitle = 'Automated documentation';
  process.stdout.write('  ');
  for (const ch of subtitle) {
    process.stdout.write(pc.dim(ch));
    await sleep(10);
  }
  process.stdout.write('\n');

  process.stdout.write(pc.dim('  ' + '─'.repeat(40)) + '\n');

  const tagline = 'Handoff.io · Lend a hand';
  process.stdout.write('  ');
  for (const ch of tagline) {
    process.stdout.write(pc.dim(pc.italic ? pc.italic(ch) : ch));
    await sleep(6);
  }
  process.stdout.write('\n\n');

  await boot.pulse(600, 'idle');
}

// =====================================================================
// 4. MONOREPO GUARDRAIL
// =====================================================================
interface RootCheckResult {
  looksLikeMonorepoRoot: boolean;
  warning?: string;
}

function checkMonorepoContext(cwd: string): RootCheckResult {
  const entries = fs.readdirSync(cwd);
  const hasPackageJson = entries.includes('package.json');
  const hasWorkspaceConfig = entries.some((e: string) =>
    ['pnpm-workspace.yaml', 'lerna.json', 'nx.json', 'turbo.json'].includes(e)
  );

  let dir = cwd;
  let foundParentRoot = false;

  for (let i = 0; i < 4; i++) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
    const parentEntries = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    if (parentEntries.some((e: string) => ['pnpm-workspace.yaml', 'lerna.json', 'nx.json', 'turbo.json'].includes(e)) || parentEntries.includes('apps') || parentEntries.includes('packages')) {
      foundParentRoot = true;
      break;
    }
  }

  if (foundParentRoot) {
    return {
      looksLikeMonorepoRoot: false,
      warning: `Detected a monorepo root above the current directory. Sibling packages will be missed. Run this from the monorepo root instead.`,
    };
  }
  return { looksLikeMonorepoRoot: hasWorkspaceConfig };
}

// =====================================================================
// AUTHENTICATION HELPERS
// =====================================================================
async function promptForKey(): Promise<string> {
  const newKey = await p.text({
    message: pc.bold('Authentication Required. Paste your Handoff.io API key:'),
    placeholder: 'handoff_live_...',
    validate(val) {
      if (!val) return 'API Key is required to proceed.';
    }
  });

  if (p.isCancel(newKey)) {
    p.cancel('Authentication aborted.');
    process.exit(0);
  }

  const keyString = (newKey as string).trim();
  saveKey(keyString);
  return keyString;
}

// --- NEW: GEMINI BYOK PROMPT ---
async function promptForGeminiKey(): Promise<string> {
  const newKey = await p.text({
    message: pc.bold('Demo Mode: Enter your Google Gemini API Key (starts with AIza...):'),
    placeholder: 'AIzaSy...',
    validate(val) {
      if (!val) return 'Gemini API Key is required to run the local AI synthesis.';
    }
  });

  if (p.isCancel(newKey)) {
    p.cancel('Authentication aborted.');
    process.exit(0);
  }

  const keyString = (newKey as string).trim();
  saveGeminiKey(keyString);
  return keyString;
}

// =====================================================================
// 5. MAIN EXECUTION FLOW
// =====================================================================
async function main() {
  const args = process.argv.slice(2);
  
  // Extract update ID if present
  let updateId: string | null = null;
  const updateIndex = args.indexOf('--update');
  if (updateIndex !== -1 && args.length > updateIndex + 1) {
    updateId = args[updateIndex + 1];
  }

  if (args.includes('logout')) {
    clearKey();
    console.log(`\n( -_-) ${pc.dim('Logged out. Keys wiped from local system.')}\n`);
    process.exit(0);
  }
  
  if (args.includes('login')) {
    clearKey();
    process.stdout.write('\x1Bc');
    console.log(`\n( •_•) ${pc.dim('Secure Login Initialization')}\n`);
    await promptForKey();
    await promptForGeminiKey();
    console.log(`\n( ⌐■_■) ${pc.bold('Keys saved. You are ready to run handoff.')}\n`);
    process.exit(0);
  }

  await bootSequence();
  const mascot = new InkMascot();

  p.intro(pc.bold(updateId ? `Initialize Re-Scan (Updating ${updateId})` : 'Initialize Scan'));

  // --- HANDOFF AUTHENTICATION CHECK ---
  let apiKey = getSavedKey();
  if (!apiKey) {
    apiKey = await promptForKey();
    p.log.success('Handoff API Key validated locally.');
  }

  // --- GEMINI AUTHENTICATION CHECK ---
  let geminiKey = getGeminiKey();
  if (!geminiKey) {
    geminiKey = await promptForGeminiKey();
    p.log.success('Gemini API Key saved locally.');
  }

  await mascot.pulse(250, 'idle');

  const action = await p.select({
    message: 'Define documentation target:',
    options: [
      { value: '.', label: 'Current directory', hint: 'runs in .' },
      { value: 'other', label: 'External repository', hint: 'enter a folder path' }
    ]
  });

  if (p.isCancel(action)) {
    p.cancel('Handoff scan aborted.');
    process.exit(0);
  }

  let targetDir = '.';
  if (action === 'other') {
    const inputPath = await p.text({
      message: 'Target path (e.g., ../client-project):',
      validate(val) {
        if (!val) return 'Path is required.';
        if (!fs.existsSync(path.resolve(process.cwd(), val))) return 'Directory does not exist.';
      }
    });
    if (p.isCancel(inputPath)) process.exit(0);
    targetDir = inputPath as string;
  }

  const projectPath = path.resolve(process.cwd(), targetDir);

  const rootCheck = checkMonorepoContext(projectPath);
  if (rootCheck.warning) {
    p.log.warn(pc.dim(rootCheck.warning));
    const proceed = await p.confirm({ message: 'Continue anyway?', initialValue: false });
    if (p.isCancel(proceed) || !proceed) process.exit(0);
  }

  await mascot.pulse(250, 'idle');
  mascot.start('Mapping git history & computing AST signatures...', 'scan');

  let gitData;
  try {
    gitData = await parseGitHistory(projectPath);
  } catch (err: any) {
    gitData = { branch: 'none', latestCommit: { message: 'Local directory scan' } };
  }

  const sanitizer = new Sanitizer();
  const astExtractor = new ASTExtractor(sanitizer);
  const ecosystems = astExtractor.detectEcosystem(projectPath);
  const dirTree = astExtractor.generateDirectoryTree(projectPath);

  const allFiles = await fg('**/*', { cwd: projectPath, dot: true, onlyFiles: true });
  const validFiles = allFiles.filter((file) => !sanitizer.shouldIgnore(file));

  const structuralMap = [];
  let infraAndSchemaCount = 0;

  for (let i = 0; i < validFiles.length; i++) {
    const relativeFile = validFiles[i];
    const absolutePath = path.join(projectPath, relativeFile);
    const parsed = astExtractor.parseFile(absolutePath);

    if (i % 3 === 0 || i === validFiles.length - 1) {
      mascot.update(`Parsing ${pc.dim(`[${i + 1}/${validFiles.length}]`)} ${relativeFile}`);
    }

    if (parsed) {
      if (parsed.isRaw) infraAndSchemaCount++;
      structuralMap.push({
        file: relativeFile,
        language: parsed.language,
        isRaw: parsed.isRaw,
        rawContent: parsed.rawContent,
        symbols: parsed.nodes
      });
    }
  }

  const totalSymbols = structuralMap.reduce((acc, f) => acc + (f.symbols?.length || 0), 0);
  await mascot.stop('Extraction complete.');

  const summaryText = [
    `${pc.bold('Branch:')}          ${gitData.branch}`,
    `${pc.bold('Files Scanned:')}   ${validFiles.length}`,
    `${pc.bold('Ecosystems:')}      ${ecosystems.join(', ') || 'General'}`,
    `${pc.bold('AST Signatures:')}  ${totalSymbols}`,
    `${pc.bold('Schemas/Configs:')} ${infraAndSchemaCount}`,
    `${pc.bold('Sanitization:')}    ${pc.dim('Shannon entropy & secret masks applied')}`
  ].join('\n');

  console.log(
    boxen(summaryText, {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderColor: 'white',
      borderStyle: 'double',
      title: pc.inverse(' MANIFEST SUMMARY '),
    })
  );

  const confirmUpload = await p.confirm({
    message: pc.bold('Ready to synthesize the codebase using local AI?'),
    initialValue: true
  });

  if (p.isCancel(confirmUpload) || !confirmUpload) {
    p.cancel('Transmission aborted.');
    process.exit(0);
  }

  const manifest = {
    meta: {
      scannedAt: new Date().toISOString(),
      ecosystems,
      directoryTree: dirTree,
      totalFilesScanned: validFiles.length
    },
    git: gitData,
    architecture: structuralMap
  };

  const manifestPath = path.join(projectPath, 'handoff-manifest.json');
  const reportPath = path.join(projectPath, 'handoff-report.json');
  const htmlPath = path.join(projectPath, 'handoff-report.html');

  // --- 1. RUN YOUR EXISTING LOCAL AI PIPELINE ---
  mascot.start('Initializing Gemini AI Map-Reduce pipeline...', 'think');

  let verifiedReport;
  try {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // --- NEW: PASS GEMINI KEY AS 3RD ARGUMENT ---
    const rawReport = await generateHandoffReport(manifest, projectPath, geminiKey, (status) => {
      mascot.update(status);
    });

    mascot.update('Running deterministic verification pass...');
    verifiedReport = verifyHandoffReport(rawReport, manifest);

    mascot.update('Compiling executive HTML delivery portal...');
    const htmlReport = generateHtmlReport(verifiedReport);
    
    fs.writeFileSync(reportPath, JSON.stringify(verifiedReport, null, 2));
    fs.writeFileSync(htmlPath, htmlReport, 'utf-8');

  } catch (err: any) {
    await mascot.stop(`AI Synthesis failed: ${err.message}`, 'error');
    process.exit(1);
  }

  // --- 2. CLOUD UPLOAD ---
  let uploadSuccess = false;

  while (!uploadSuccess) {
    mascot.start('Uploading finalized report to Handoff.io server...', 'think');

    try {
      // NOTE: Make sure to change localhost:3000 to your deployed Vercel URL when ready!
      const res = await fetch("http://localhost:3000/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({ manifest, report: verifiedReport, updateId })
      });

      if (res.status === 401) {
        await mascot.stop('API Key rejected.', 'error');
        p.log.warn(pc.bold('Your API key is invalid or was revoked on the dashboard.'));
        clearKey();
        apiKey = await promptForKey();
        continue;
      }

      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      await mascot.stop('Transmission complete.');
      
      p.note(
        updateId 
          ? `Project Update Ready. Check your dashboard to view the refreshed portal.`
          : `Portal Ready. Check your dashboard to view and rename this project.`,
        'Success'
      );

      // 3. AUTO-CLEANUP
      if (fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);
      if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
      if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
      
      p.outro(pc.dim('Phase 3 complete. Cleaned up local temp files. Safely exit terminal.'));
      uploadSuccess = true;

    } catch (err: any) {
      await mascot.stop(`Network error: ${err.message}`, 'error');
      const retry = await p.confirm({ message: 'Retry transmission?', initialValue: true });
      if (!retry || p.isCancel(retry)) process.exit(1);
    }
  }
}

main().catch((err) => {
  console.log(`\n( ×_×) ${pc.bold('Fatal Error:')} ${err.message}\n`);
  process.exitCode = 1;
});