import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GithubApiService {
  private readonly logger = new Logger(GithubApiService.name);
  private readonly token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || '';

  private getHeaders() {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'CodexForge-Agent',
    };
    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }
    return headers;
  }

  async getPRFiles(owner: string, repo: string, prNumber: number): Promise<any[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`;
    this.logger.log(`Fetching files for PR #${prNumber} from ${url}`);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`GitHub API returned status ${response.status}: ${await response.text()}`);
      }

      return (await response.json()) as any[];
    } catch (error: any) {
      this.logger.error(`Failed to fetch PR files: ${error.message}`);
      return [];
    }
  }

  async postPRComment(owner: string, repo: string, prNumber: number, body: string): Promise<boolean> {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;
    this.logger.log(`Posting PR comment to ${url}`);

    if (!this.token) {
      this.logger.warn('GITHUB_PERSONAL_ACCESS_TOKEN is not set. Simulating comment print to console:');
      console.log(`[Simulated GitHub Comment PR #${prNumber}]:\n${body}`);
      return true;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        throw new Error(`GitHub API returned status ${response.status}: ${await response.text()}`);
      }

      return true;
    } catch (error: any) {
      this.logger.error(`Failed to post PR comment: ${error.message}`);
      return false;
    }
  }

  async setCommitStatus(
    owner: string,
    repo: string,
    sha: string,
    state: 'pending' | 'success' | 'failure' | 'error',
    description: string,
  ): Promise<boolean> {
    const url = `https://api.github.com/repos/${owner}/${repo}/statuses/${sha}`;
    this.logger.log(`Setting commit status to ${state} for ${sha} at ${url}`);

    if (!this.token) {
      this.logger.warn('GITHUB_PERSONAL_ACCESS_TOKEN is not set. Simulating status update.');
      console.log(`[Simulated Commit Status ${sha}]: state=${state}, desc=${description}`);
      return true;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state,
          description: description.substring(0, 140), // GitHub limits description to 140 chars
          context: 'CodexForge / Agent PR Reviewer',
        }),
      });

      if (!response.ok) {
        throw new Error(`GitHub API returned status ${response.status}: ${await response.text()}`);
      }

      return true;
    } catch (error: any) {
      this.logger.error(`Failed to set commit status: ${error.message}`);
      return false;
    }
  }
}
