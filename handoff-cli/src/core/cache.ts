import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export class CacheEngine {
  private cachePath: string;
  private cache: Record<string, any>;

  constructor(projectPath: string) {
    this.cachePath = path.join(projectPath, '.handoff', 'cache.json');
    this.cache = {};
    if (fs.existsSync(this.cachePath)) {
      try {
        this.cache = JSON.parse(fs.readFileSync(this.cachePath, 'utf-8'));
      } catch {
        this.cache = {};
      }
    }
  }

  public hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  public get(hash: string) {
    return this.cache[hash];
  }

  public set(hash: string, data: any) {
    this.cache[hash] = data;
  }

  public save(projectPath: string) {
    const dir = path.join(projectPath, '.handoff');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2));
  }
}