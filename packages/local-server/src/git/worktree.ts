/**
 * Git worktree manager.
 *
 * Worktrees allow checking out a branch into a separate directory while
 * the main repo stays on its own branch. Kira uses one worktree per workspace
 * so each agent gets an isolated working directory.
 *
 * Worktree base directory is configurable (like Rust WorktreeManager):
 *   - KIRA_WORKTREE_DIR env var overrides default
 *   - Default: ~/.local/share/kira-code/worktrees
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { mkdir, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { simpleGit } from 'simple-git';

const execFileAsync = promisify(execFile);

// ============================================================================
// Worktree directory resolution
// ============================================================================

let worktreeDirOverride: string | undefined;

/**
 * Override the worktree base directory (for testing or custom configuration).
 * Must be called before any worktree operations.
 */
export function setWorktreeDirOverride(path: string): void {
  worktreeDirOverride = path;
}

/**
 * Get the worktree base directory.
 * Priority: setWorktreeDirOverride() > KIRA_WORKTREE_DIR env > ~/.local/share/kira-code/worktrees
 */
export function getWorktreeBaseDir(): string {
  if (worktreeDirOverride) {
    return worktreeDirOverride;
  }
  const envOverride = process.env.KIRA_WORKTREE_DIR;
  if (envOverride) {
    return envOverride;
  }
  return join(homedir(), '.local', 'share', 'kira-code', 'worktrees');
}

/**
 * Get the path for a specific workspace's worktree.
 */
export function getWorktreePath(workspaceId: string): string {
  return join(getWorktreeBaseDir(), `workspace-${workspaceId}`);
}

// ============================================================================
// Worktree operations
// ============================================================================

export interface CreateWorktreeOptions {
  /** Path to the main git repository */
  repoPath: string;
  /** Workspace ID — used to compute the worktree path */
  workspaceId: string;
  /** Branch to check out in the worktree */
  branchName: string;
  /** Base branch to create new branch from (only used when createBranch is true) */
  baseBranch?: string;
  /** If true, create the branch before adding the worktree. If false, branch must exist. */
  createBranch?: boolean;
}

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
  isBare: boolean;
}

/**
 * Create a git worktree for a workspace.
 *
 * If createBranch is true, creates the branch from baseBranch first.
 * If createBranch is false, the branch must already exist locally.
 */
export async function createWorktree(options: CreateWorktreeOptions): Promise<string> {
  const {
    repoPath,
    workspaceId,
    branchName,
    baseBranch = 'main',
    createBranch = false,
  } = options;

  const worktreePath = getWorktreePath(workspaceId);
  const git = simpleGit(repoPath);

  // Create branch if requested
  if (createBranch) {
    await git.checkoutBranch(branchName, baseBranch);
    // Switch back to original branch — worktree will handle the checkout
    const currentBranch = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim();
    if (currentBranch === branchName) {
      // We just created and switched to it; check out the base to undo that
      await git.checkout(baseBranch);
    }
    // Create the branch without checking it out
    await git.raw(['branch', '-D', branchName]).catch(() => {}); // delete the just-created branch
    await git.raw(['branch', branchName, baseBranch]);
  }

  // Ensure parent directory exists
  await mkdir(dirname(worktreePath), { recursive: true });

  // Add the worktree
  await git.raw(['worktree', 'add', worktreePath, branchName]);

  return worktreePath;
}

/**
 * Delete a workspace's worktree.
 *
 * Uses --force because the worktree may have uncommitted changes.
 * Also runs `git worktree prune` to clean stale refs.
 */
export async function deleteWorktree(repoPath: string, workspaceId: string): Promise<void> {
  const worktreePath = getWorktreePath(workspaceId);
  const git = simpleGit(repoPath);

  if (existsSync(worktreePath)) {
    try {
      await git.raw(['worktree', 'remove', '--force', worktreePath]);
    } catch {
      // If worktree remove fails (e.g., stale), manually remove the directory
      await rm(worktreePath, { recursive: true, force: true });
    }
  }

  // Always prune to clean up stale worktree refs
  await git.raw(['worktree', 'prune']).catch(() => {});
}

/**
 * List all worktrees for a repository.
 */
export async function listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  const git = simpleGit(repoPath);
  const output = await git.raw(['worktree', 'list', '--porcelain']);

  const worktrees: WorktreeInfo[] = [];
  let current: Partial<WorktreeInfo> = {};

  for (const line of output.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current.path) worktrees.push(current as WorktreeInfo);
      current = { path: line.slice('worktree '.length), isBare: false };
    } else if (line.startsWith('HEAD ')) {
      current.head = line.slice('HEAD '.length);
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice('branch refs/heads/'.length);
    } else if (line === 'bare') {
      current.isBare = true;
    }
  }
  if (current.path) worktrees.push(current as WorktreeInfo);

  return worktrees;
}

// ============================================================================
// GitHub PR fetch
// ============================================================================

export interface FetchPrBranchOptions {
  /** Path to the main git repository */
  repoPath: string;
  /** PR number */
  prNumber: number;
  /** Local branch name to create (e.g. "pr/123") */
  localBranch: string;
  /** Remote name (default: "origin") */
  remote?: string;
}

/**
 * Fetch a GitHub PR branch into a local branch using the `gh` CLI.
 *
 * Requires `gh` CLI to be installed and authenticated.
 * Works for both public and private repositories.
 */
export async function fetchPrBranch(options: FetchPrBranchOptions): Promise<void> {
  const { repoPath, prNumber, localBranch, remote = 'origin' } = options;

  // Verify gh CLI is installed
  try {
    await execFileAsync('gh', ['--version']);
  } catch {
    throw new Error(
      'GitHub CLI (`gh`) is not installed or not in PATH.\n' +
      'Please install it from https://cli.github.com/ and run `gh auth login`.'
    );
  }

  // Verify gh is authenticated
  try {
    await execFileAsync('gh', ['auth', 'status'], { cwd: repoPath });
  } catch {
    throw new Error(
      'GitHub CLI (`gh`) is not authenticated.\n' +
      'Please run `gh auth login` to authenticate.'
    );
  }

  // Fetch the PR branch via git directly
  const git = simpleGit(repoPath);
  try {
    await git.raw(['fetch', remote, `pull/${prNumber}/head:${localBranch}`]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch PR #${prNumber}: ${message}`);
  }
}

// ============================================================================
// URL parsing
// ============================================================================

export interface ParsedPrUrl {
  owner: string;
  repo: string;
  prNumber: number;
}

/**
 * Parse a GitHub PR URL.
 * Supports:
 *   https://github.com/owner/repo/pull/123
 *   https://github.com/owner/repo/pull/123/files
 */
export function parsePrUrl(url: string): ParsedPrUrl {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) {
    throw new Error(
      `Invalid GitHub PR URL: "${url}"\n` +
      'Expected format: https://github.com/owner/repo/pull/123'
    );
  }
  return {
    owner: match[1],
    repo: match[2],
    prNumber: parseInt(match[3], 10),
  };
}
