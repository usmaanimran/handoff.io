import { GoogleGenerativeAI } from '@google/generative-ai';
import { CacheEngine } from './cache.ts';
import { verifyHandoffReport } from './verifier.ts';

export interface HandoffReport {
  projectType: 'web-api' | 'fullstack-app' | 'cli-tool' | 'library' | 'microservice' | 'monorepo' | 'game' | 'mobile-app';
  executiveView: {
    title: string;
    summary: string;
    businessValue: string;
    featuresDelivered: string[];
    userFlows: Array<{
      flowName: string;
      steps: Array<{
        stepNumber: number;
        action: string;
      }>;
    }>;
  };
  developerRunbook: {
    architectureOverview: string;
    mermaidDiagram: string;
    uiComponents: Array<{
      name: string;
      purpose: string;
      sourceFile: string;
    }>;
    httpEndpoints: Array<{
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'GRAPHQL' | 'RPC';
      path: string;
      description: string;
      sourceFile: string;
    }>;
    coreModules: Array<{
      moduleName: string;
      purpose: string;
      exportedSymbols: string[];
      sourceFile: string;
    }>;
    databaseSchema: {
      ormOrEngine: string;
      modelsOrTables: Array<{
        name: string;
        description: string;
      }>;
      summary: string;
    };
    environmentVariables: Array<{
      name: string;
      purpose: string;
      required: boolean;
      defaultValue?: string;
    }>;
    infrastructureAndServices: string[];
    setupInstructions: string[];
  };
}

interface IntermediateChunkSummary {
  domain: string;
  moduleRole: string;
  identifiedUIComponents: Array<{
    name: string;
    purpose: string;
    sourceFile: string;
  }>;
  identifiedHttpRoutes: Array<{
    method: string;
    path: string;
    description: string;
    sourceFile: string;
  }>;
  identifiedCoreModules: Array<{
    moduleName: string;
    purpose: string;
    exportedSymbols: string[];
    sourceFile: string;
  }>;
  identifiedEnvVars: Array<{
    name: string;
    purpose: string;
    required: boolean;
  }>;
  databaseStructures: string[];
  keyInternalDependencies: string[];
}

function sanitizeMermaidLabels(mermaidBlock: string): string {
  const nodePattern = /(\w+)(\[|\(\[|\[\(|\{\{|\(|\{)([^"\]\)\}][^\]\)\}]*)(\]|\)\]|\)\]|\}\}|\)|\})/g;
  return mermaidBlock.replace(nodePattern, (match, id, openBracket, label, closeBracket) => {
    const needsQuoting = /[\/\.\:\-\s]/.test(label) && !label.startsWith('"');
    if (needsQuoting) {
      const escaped = label.replace(/"/g, '#quot;');
      return `${id}${openBracket}"${escaped}"${closeBracket}`;
    }
    return match;
  });
}

function partitionIntoChunks(files: any[], maxFilesPerChunk = 12): Array<{ domain: string; files: any[] }> {
  const directoryGroups: { [key: string]: any[] } = {};
  for (const item of files) {
    const parts = item.file.split(/[/\\]/);
    const domain = parts.length > 1 ? parts.slice(0, 2).join('/') : 'root';
    if (!directoryGroups[domain]) {
      directoryGroups[domain] = [];
    }
    directoryGroups[domain].push(item);
  }
  const chunks: Array<{ domain: string; files: any[] }> = [];
  for (const [domain, groupFiles] of Object.entries(directoryGroups)) {
    for (let i = 0; i < groupFiles.length; i += maxFilesPerChunk) {
      chunks.push({
        domain: `${domain} (part ${Math.floor(i / maxFilesPerChunk) + 1})`,
        files: groupFiles.slice(i, i + maxFilesPerChunk)
      });
    }
  }
  return chunks;
}

const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];

async function generateWithFallback(genAI: any, promptText: string): Promise<string> {
  let lastError;
  for (const modelName of FALLBACK_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: 'application/json' }
      });
      const response = await model.generateContent(promptText);
      return response.response.text();
    } catch (error: any) {
      lastError = error;
      if (error.message && (error.message.includes('401') || error.message.includes('403'))) {
        throw error;
      }
    }
  }
  throw lastError;
}

async function mapChunk(
  chunk: { domain: string; files: any[] },
  genAI: any,
  cacheEngine: CacheEngine
): Promise<IntermediateChunkSummary> {
  const payloadString = JSON.stringify(chunk.files);
  const chunkHash = cacheEngine.hashContent(payloadString);
  const cachedSummary = cacheEngine.get(chunkHash);
  if (cachedSummary) {
    return cachedSummary;
  }
  const mapPrompt = `
    You are an expert AST Static Code Analyzer.
    Analyze the following metadata chunk for the domain: "${chunk.domain}".
    Strictly adhere to this JSON format:
    {
      "domain": "${chunk.domain}",
      "moduleRole": "Concise summary of what this chunk of files handles",
      "identifiedUIComponents": [
        {
          "name": "Component/Page Name",
          "purpose": "What this UI handles or renders",
          "sourceFile": "path/to/file.tsx"
        }
      ],
      "identifiedHttpRoutes": [
        {
          "method": "GET|POST|PUT|DELETE|PATCH",
          "path": "/exact/endpoint/path",
          "description": "Functional description of route",
          "sourceFile": "path/to/file.ts"
        }
      ],
      "identifiedCoreModules": [
        {
          "moduleName": "Class or Module Name",
          "purpose": "What this module computes or manages",
          "exportedSymbols": ["functionName1", "ClassName"],
          "sourceFile": "path/to/file.ts"
        }
      ],
      "identifiedEnvVars": [
        {
          "name": "ENV_VAR_NAME",
          "purpose": "Why this variable is accessed",
          "required": true
        }
      ],
      "databaseStructures": ["Table or Model names referenced"],
      "keyInternalDependencies": ["Internal libraries or files imported"]
    }
    RULES:
    1. NEXT.JS APP ROUTER: Files named 'route.ts' or 'route.js' define HTTP endpoints. Place them ONLY in 'identifiedHttpRoutes'. Infer the path from the folder structure (e.g., 'app/api/auth/route.ts' -> '/api/auth').
    2. NEXT.JS FRONTEND: Files named 'page.tsx', 'layout.tsx', or containing React components define the UI. Place them ONLY in 'identifiedUIComponents'.
    3. Backend logic, classes, utilities, and CLI commands go in 'identifiedCoreModules'.
  `;
  const responseText = await generateWithFallback(genAI, `${mapPrompt}\n\nCHUNK METADATA:\n${payloadString}`);
  const result = JSON.parse(responseText) as IntermediateChunkSummary;
  cacheEngine.set(chunkHash, result);
  return result;
}

async function reduceSummaries(
  chunkSummaries: IntermediateChunkSummary[],
  manifest: any,
  infraFiles: any[],
  genAI: any
): Promise<HandoffReport> {
  const reducePrompt = `
    You are a Principal Solutions Architect compiling the definitive Project Delivery & Handoff Report.
    You have received verified intermediate domain summaries extracted from code ASTs, raw infrastructure configs, and Git history.
    Ecosystems detected by CLI: ${(manifest.meta.ecosystems || []).join(', ') || 'Custom'}
    Directory Topology (Use this to understand the project skeleton even if code ASTs are missing):
    ${manifest.meta.directoryTree || 'Not available'}
    
    Produce an enterprise-grade JSON report adhering strictly to this schema:
    {
      "projectType": "cli-tool|web-api|fullstack-app|library|microservice|monorepo|game|mobile-app",
      "executiveView": {
        "title": "Project or Engine Name",
        "summary": "High-level non-technical summary of what was delivered.",
        "businessValue": "Measurable business outcomes and efficiency gained.",
        "featuresDelivered": ["Array of delivered user-facing and architectural capabilities"],
        "userFlows": [
          {
            "flowName": "Name of the process (e.g., User Authentication)",
            "steps": [
              { "stepNumber": 1, "action": "Operator executes CLI command" }
            ]
          }
        ]
      },
      "developerRunbook": {
        "architectureOverview": "Exhaustive technical summary of module topology and execution lifecycle.",
        "mermaidDiagram": "A valid Mermaid.js graph visualizing the system topology.",
        "uiComponents": [
          {
            "name": "Component or Page Name",
            "purpose": "Responsibility of this frontend view",
            "sourceFile": "File path"
          }
        ],
        "httpEndpoints": [
          {
            "method": "GET|POST|PUT|DELETE|PATCH",
            "path": "Route path",
            "description": "Action taken",
            "sourceFile": "File path"
          }
        ],
        "coreModules": [
          {
            "moduleName": "Core Service / Engine Name",
            "purpose": "Responsibility",
            "exportedSymbols": ["symbol1", "symbol2"],
            "sourceFile": "File path"
          }
        ],
        "databaseSchema": {
          "ormOrEngine": "Database engine or ORM name",
          "modelsOrTables": [
            {
              "name": "TableName or ModelName",
              "description": "Fields and relations mapped"
            }
          ],
          "summary": "Architectural explanation of data storage."
        },
        "environmentVariables": [
          {
            "name": "KEY_NAME",
            "purpose": "Description of variable",
            "required": true,
            "defaultValue": "optional default"
          }
        ],
        "infrastructureAndServices": ["All detected third-party SDKs, cloud infra, and tools"],
        "setupInstructions": ["Step-by-step verified setup instructions."]
      }
    }
    
    CRITICAL QUALITY RULES:
    1. ZERO HALLUCINATION on HTTP Endpoints. Ensure Next.js API routes (e.g., 'app/api/.../route.ts') are captured perfectly.
    2. 'mermaidDiagram' must be clean, valid Mermaid code without markdown backticks.
    3. Include frontend architectures (pages, components, UI state) in 'uiComponents' and represent the User -> UI -> API flow in the 'mermaidDiagram'.
    4. Strongly factor the Directory Topology and Ecosystems into your architecture overview.
    5. MERMAID SYNTAX   NODE LABELS:
        - ANY node text containing a slash (/), dot (.), colon (:), parenthesis, or hyphen-space combo MUST be wrapped in double quotes inside the brackets.
        - Never emit a raw path or filename as a label without quotes. Example: CLI["bin/index.ts - CLIRunner"]
        - If a label needs a literal double quote inside it, use #quot; instead.
  `;
  const payload = {
    gitHistory: manifest.git,
    infrastructureFiles: infraFiles,
    moduleSummaries: chunkSummaries
  };
  const responseText = await generateWithFallback(genAI, `${reducePrompt}\n\nSYNTHESIS DATA:\n${JSON.stringify(payload, null, 2)}`);
  return JSON.parse(responseText) as HandoffReport;
}

export async function generateHandoffReport(
  manifest: any,
  projectPath: string,
  geminiApiKey: string, 
  onProgress?: (status: string) => void
): Promise<HandoffReport> {
  const cleanKey = geminiApiKey ? geminiApiKey.replace(/['"\s]/g, '').trim() : '';

  if (!cleanKey || cleanKey.startsWith('handoff_live_')) {
    throw new Error('\n\n❌ INVALID GEMINI KEY ❌\nYou pasted your Handoff dashboard key instead of a Google Gemini API Key.\nRun `handoff auth` to reset and enter your actual Gemini key.\n');
  }

  const genAI = new GoogleGenerativeAI(cleanKey);
  const cacheEngine = new CacheEngine(projectPath);
  const files = manifest.architecture || [];
  const infraFiles = files.filter((f: any) => f.isRaw);
  const codeFiles = files.filter((f: any) => !f.isRaw);
  const chunks = partitionIntoChunks(codeFiles);
  const chunkSummaries: IntermediateChunkSummary[] = [];
  const batchSize = 3;

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  for (let i = 0; i < chunks.length; i += batchSize) {
    const currentBatch = chunks.slice(i, i + batchSize);
    if (onProgress) {
      onProgress(`Mapping codebase modules (${Math.min(i + batchSize, chunks.length)}/${chunks.length})...`);
    }
    const results = await Promise.all(currentBatch.map(chunk => mapChunk(chunk, genAI, cacheEngine)));
    chunkSummaries.push(...results);
    
    cacheEngine.save(projectPath);
    
    if (i + batchSize < chunks.length) {
      await delay(4500); 
    }
  }

  if (onProgress) {
    onProgress('Synthesizing enterprise handoff report...');
  }
  const rawReport = await reduceSummaries(chunkSummaries, manifest, infraFiles, genAI);
  if (rawReport.developerRunbook?.mermaidDiagram) {
    rawReport.developerRunbook.mermaidDiagram = sanitizeMermaidLabels(rawReport.developerRunbook.mermaidDiagram);
  }
  return verifyHandoffReport(rawReport, manifest);
}