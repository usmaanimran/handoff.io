import { simpleGit } from 'simple-git';
import type { SimpleGit } from 'simple-git';

export interface GitHandoffData {
  branch: string;
  latestCommit: {
    hash: string;
    message: string;
    author_name: string;
    date: string;
  };
  recentCommits: Array<{
    hash: string;
    message: string;
    date: string;
  }>;
  diffSummary: {
    changedFiles: number;
    insertions: number;
    deletions: number;
  };
}

export async function parseGitHistory(repoPath: string): Promise<GitHandoffData> {
  const git: SimpleGit = simpleGit(repoPath);

  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    throw new Error('Target directory is not an initialized Git repository.');
  }

  const branchSummary = await git.branch();
  const currentBranch = branchSummary.current || 'main';

  const logSummary = await git.log({ maxCount: 15 });
  const latest = logSummary.latest;

  let diffSummary = { changedFiles: 0, insertions: 0, deletions: 0 };
  try {
    const diff = await git.diffSummary(['HEAD~5', 'HEAD']);
    diffSummary = {
      changedFiles: diff.changed,
      insertions: diff.insertions,
      deletions: diff.deletions
    };
  } catch {
    // If fewer than 5 commits exist, diff against Git's universal empty tree magic hash
    try {
      const diff = await git.diffSummary(['4b825dc642cb6eb9a060e54bf8d69288fbee4904', 'HEAD']);
      diffSummary = {
        changedFiles: diff.changed,
        insertions: diff.insertions,
        deletions: diff.deletions
      };
    } catch {
      diffSummary = { changedFiles: 0, insertions: 0, deletions: 0 };
    }
  }

  return {
    branch: currentBranch,
    latestCommit: {
      hash: latest?.hash || 'unknown',
      message: latest?.message || 'No commit message',
      author_name: latest?.author_name || 'Anonymous',
      date: latest?.date || new Date().toISOString()
    },
    recentCommits: logSummary.all.map((c) => ({
      hash: c.hash.slice(0, 7),
      message: c.message,
      date: c.date
    })),
    diffSummary
  };
}