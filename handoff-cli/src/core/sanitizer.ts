export class Sanitizer {
  private ignoredPatterns: Set<string>;

  constructor() {
    this.ignoredPatterns = new Set([
      'node_modules', '.git', '.next', 'dist', 'build', 'coverage',
      'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.DS_Store', '.handoff',
      '.env' // FIX 1: Completely block environment files from AST ingestion
    ]);
  }

  private calculateEntropy(str: string): number {
    const len = str.length;
    const frequencies = Array.from(str).reduce((freq, c) => {
      freq[c] = (freq[c] || 0) + 1;
      return freq;
    }, {} as Record<string, number>);

    return Object.values(frequencies).reduce(
      (sum, f) => sum - (f / len) * Math.log2(f / len),
      0
    );
  }

  public redactSecrets(content: string): string {
    // Redact standard known prefixes
    let sanitized = content.replace(
      /(sk_[a-zA-Z0-9]{24,}|AKIA[0-9A-Z]{16})/g,
      '[REDACTED_KNOWN_SECRET]'
    );

    const highEntropyRegex = /([a-zA-Z0-9_=+-\/\.]{24,})/g;

    sanitized = sanitized.replace(highEntropyRegex, (match) => {
      // 1. Let standard 40-character Git SHA-1 hashes pass through
      if (/^[a-fA-F0-9]{40}$/.test(match)) {
        return match;
      }

      // 2. Let obvious URLs and file paths pass through
      if (match.startsWith('http') || match.includes('://')) {
        return match;
      }
      // Base64 encoded secrets might use '/', but they don't look like standard file paths
      if (match.includes('/') && !match.includes('=')) {
        return match;
      }

      const entropy = this.calculateEntropy(match);
      const isHex = /^[a-fA-F0-9]{32,}$/.test(match);

      // 3. Catch true secrets without accidentally adding double-quotes
      if (isHex || entropy >= 4.0) {
        return '[REDACTED_SECRET]';
      }

      return match;
    });

    return sanitized;
  }

  public shouldIgnore(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/');
    for (const pattern of this.ignoredPatterns) {
      if (normalizedPath.includes(pattern)) return true;
    }
    return false;
  }
}