import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Cpp from 'tree-sitter-cpp';
import Java from 'tree-sitter-java';

// @ts-ignore
import CSharp from 'tree-sitter-c-sharp';
// @ts-ignore
import Go from 'tree-sitter-go';
// @ts-ignore
import Rust from 'tree-sitter-rust';
// @ts-ignore
import Php from 'tree-sitter-php';
// @ts-ignore
import Ruby from 'tree-sitter-ruby';

import fs from 'fs';
import path from 'path';
// Added the explicit .ts extension here
import { Sanitizer } from './sanitizer.ts';

export interface FileStructure {
  filePath: string;
  language: string;
  isRaw?: boolean;
  rawContent?: string;
  nodes: any[];
}

export class ASTExtractor {
  private parser: Parser;
  private sanitizer: Sanitizer;

  constructor(sanitizer: Sanitizer) {
    this.parser = new Parser();
    this.sanitizer = sanitizer;
  }

  public detectEcosystem(projectRoot: string): string[] {
    const ecosystems: string[] = [];
    if (fs.existsSync(path.join(projectRoot, 'package.json'))) ecosystems.push('Node/Web');
    if (fs.existsSync(path.join(projectRoot, 'ProjectSettings', 'ProjectSettings.asset'))) ecosystems.push('Unity 3D/VR');
    if (fs.existsSync(path.join(projectRoot, 'Cargo.toml'))) ecosystems.push('Rust/Systems');
    if (fs.existsSync(path.join(projectRoot, 'go.mod'))) ecosystems.push('Go/Backend');
    if (fs.existsSync(path.join(projectRoot, 'pubspec.yaml'))) ecosystems.push('Flutter/Mobile');
    
    try {
      const files = fs.readdirSync(projectRoot);
      if (files.some(f => f.endsWith('.uproject'))) ecosystems.push('Unreal Engine 5/Gaming');
    } catch { /* ignore */ }

    return ecosystems;
  }

  public generateDirectoryTree(dirPath: string, prefix = '', depth = 0, maxDepth = 3): string {
    if (depth > maxDepth) return '';
    let tree = '';
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const item of items) {
        if (this.sanitizer.shouldIgnore(item.name)) continue;
        tree += `${prefix}├── ${item.name}\n`;
        if (item.isDirectory()) {
          tree += this.generateDirectoryTree(path.join(dirPath, item.name), `${prefix}│   `, depth + 1, maxDepth);
        }
      }
    } catch { /* ignore */ }
    return tree;
  }

  private setLanguage(ext: string): string | null {
    switch (ext) {
      case '.js':
      case '.jsx':
        this.parser.setLanguage(JavaScript);
        return 'javascript';
      case '.ts':
        this.parser.setLanguage(TypeScript.typescript);
        return 'typescript';
      case '.tsx':
        this.parser.setLanguage(TypeScript.tsx);
        return 'typescriptreact';
      case '.py':
        this.parser.setLanguage(Python);
        return 'python';
      case '.cpp':
      case '.cc':
      case '.h':
      case '.hpp':
        this.parser.setLanguage(Cpp);
        return 'cpp';
      case '.java':
        this.parser.setLanguage(Java);
        return 'java';
      case '.cs':
        this.parser.setLanguage(CSharp);
        return 'csharp';
      case '.go':
        this.parser.setLanguage(Go);
        return 'go';
      case '.rs':
        this.parser.setLanguage(Rust);
        return 'rust';
      case '.php':
        this.parser.setLanguage((Php as any).php || Php);
        return 'php';
      case '.rb':
        this.parser.setLanguage(Ruby);
        return 'ruby';
      default:
        return null;
    }
  }

  public parseFile(filePath: string): FileStructure | null {
    const fileName = path.basename(filePath).toLowerCase();
    const ext = path.extname(filePath).toLowerCase();

    // 1. API Contracts & Infrastructure Direct Ingestion
    const isContractOrInfra =
      ext === '.sql' ||
      ext === '.prisma' ||
      ext === '.graphql' ||
      ext === '.gql' ||
      fileName.includes('swagger') ||
      fileName.includes('openapi') ||
      fileName === 'dockerfile' ||
      fileName.includes('docker-compose');

    if (isContractOrInfra) {
      try {
        const rawContent = this.sanitizer.redactSecrets(fs.readFileSync(filePath, 'utf-8'));
        return {
          filePath,
          language: ext.replace('.', '') || 'config',
          isRaw: true,
          rawContent: rawContent.slice(0, 8000),
          nodes: [{ type: 'schema', name: fileName, startLine: 1 }]
        };
      } catch {
        return null;
      }
    }

    const lang = this.setLanguage(ext);

    // 2. Unknown Text Fallback
    if (!lang) {
      try {
        const rawSource = fs.readFileSync(filePath, 'utf-8');
        if (rawSource.includes('\0')) return null; // Skip binary files
        return {
          filePath,
          language: 'unknown',
          isRaw: true,
          rawContent: this.sanitizer.redactSecrets(rawSource).slice(0, 1500),
          nodes: [{ type: 'infra', name: fileName, startLine: 1 }]
        };
      } catch {
        return null;
      }
    }

    // 3. Known AST Parsing
    let sourceCode: string;
    try {
      sourceCode = this.sanitizer.redactSecrets(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return null;
    }

    const tree = this.parser.parse(sourceCode);
    const nodes: any[] = [];

    const traverse = (node: Parser.SyntaxNode) => {
      if (node.type.includes('function') || node.type.includes('method')) {
        const idNode = node.childForFieldName('name') || node.childForFieldName('declarator');
        if (idNode) {
          nodes.push({
            type: 'function',
            name: idNode.text,
            startLine: node.startPosition.row + 1
          });
        }
      }
      if (node.type.includes('class') || node.type.includes('struct')) {
        const idNode = node.childForFieldName('name');
        if (idNode) {
          nodes.push({
            type: 'class',
            name: idNode.text,
            startLine: node.startPosition.row + 1
          });
        }
      }
      for (let i = 0; i < node.childCount; i++) {
        traverse(node.child(i)!);
      }
    };

    traverse(tree.rootNode);
    return { filePath, language: lang, nodes };
  }
}