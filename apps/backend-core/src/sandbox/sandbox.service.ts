import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface SandboxExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
}

@Injectable()
export class SandboxService {
  private totalRuns = 0;
  private cumulativeDurationMs = 0;

  getStats() {
    return {
      totalRuns: this.totalRuns,
      averageDurationMs: this.totalRuns > 0 ? Math.round(this.cumulativeDurationMs / this.totalRuns) : 0,
    };
  }

  /**
   * Executes code safely in a temporary local runtime context.
   */
  async executeCode(
    language: string,
    code: string,
    files: Array<{ path: string; content: string }>,
    timeoutMs = 5000,
  ): Promise<SandboxExecutionResult> {
    // 1. Create a unique temporary directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codexforge-sandbox-'));
    
    try {
      // 2. Write additional workspace files
      for (const file of files) {
        const filePath = path.join(tempDir, file.path);
        // Ensure parent subdirectories exist
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, file.content, 'utf-8');
      }

      // 3. Write main execution file
      let mainFileName = 'main.js';
      let executeCmd = '';
      
      switch (language.toLowerCase()) {
        case 'javascript':
        case 'node':
          mainFileName = 'main.js';
          executeCmd = `node ${mainFileName}`;
          break;
        case 'typescript':
          mainFileName = 'main.ts';
          // Use ts-node to run directly (locally required)
          executeCmd = `npx ts-node ${mainFileName}`;
          break;
        case 'python':
        case 'python3':
          mainFileName = 'main.py';
          executeCmd = `python ${mainFileName}`;
          break;
        default:
          throw new Error(`Unsupported execution language: ${language}`);
      }

      const mainFilePath = path.join(tempDir, mainFileName);
      await fs.writeFile(mainFilePath, code, 'utf-8');

      // 4. Execute subprocess with hard timeout constraints
      const startTime = Date.now();
      
      return await new Promise<SandboxExecutionResult>((resolve, reject) => {
        const processRef = exec(
          executeCmd,
          { cwd: tempDir, timeout: timeoutMs },
          (error: any, stdout: string, stderr: string) => {
            const endTime = Date.now();
            const executionTimeMs = endTime - startTime;

            let exitCode = 0;
            if (error) {
              exitCode = error.code !== undefined ? error.code : 1;
              // If killed due to timeout, error.killed is true
              if (error.signal === 'SIGTERM' || error.signal === 'SIGKILL') {
                stderr += `\n[Execution Error] Process terminated due to timeout exceeded (${timeoutMs}ms)`;
                exitCode = 124; // standard core exit code for timeout
              }
            }

            this.totalRuns += 1;
            this.cumulativeDurationMs += executionTimeMs;

            resolve({
              exitCode,
              stdout,
              stderr,
              executionTimeMs,
            });
          },
        );
      });
    } catch (e: any) {
      throw new InternalServerErrorException(e.message || 'Error occurred during sandbox compilation');
    } finally {
      // 5. Always clean up files to prevent storage leakages
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (err) {
        console.error(`Failed to clean sandbox directory: ${tempDir}`, err);
      }
    }
  }
}
