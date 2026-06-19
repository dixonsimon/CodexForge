import { NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

const localSandboxStatsFile = path.join(process.cwd(), 'data', 'sandbox-stats.json');

async function updateSandboxStats(executionTimeMs: number) {
  try {
    await fs.mkdir(path.dirname(localSandboxStatsFile), { recursive: true });
    let stats = { totalRuns: 0, cumulativeDurationMs: 0 };
    try {
      const content = await fs.readFile(localSandboxStatsFile, 'utf-8');
      stats = JSON.parse(content);
    } catch {}

    stats.totalRuns += 1;
    stats.cumulativeDurationMs += executionTimeMs;

    await fs.writeFile(localSandboxStatsFile, JSON.stringify(stats, null, 2));
  } catch (e) {
    console.error('Failed to update sandbox telemetry:', e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { language, code, files = [], timeoutMs = 5000 } = body;

    if (!language || !code) {
      return NextResponse.json({ error: 'Language and code parameters are required.' }, { status: 400 });
    }

    let result;
    try {
      const response = await fetch('http://127.0.0.1:3001/api/v1/sandbox/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code, files, timeoutMs }),
      });

      if (!response.ok) {
        throw new Error("Local sandbox returned non-ok status");
      }
      result = await response.json();
    } catch (localErr) {
      console.warn("Local sandbox offline or errored. Directing execution to secure Piston gVisor sandbox:", localErr);
      
      let pistonLanguage = language.toLowerCase();
      if (pistonLanguage === 'node' || pistonLanguage === 'js') {
        pistonLanguage = 'javascript';
      }
      if (pistonLanguage === 'python3') {
        pistonLanguage = 'python';
      }

      const filesPayload = [
        {
          name: pistonLanguage === 'javascript' ? 'main.js' : pistonLanguage === 'typescript' ? 'main.ts' : 'main.py',
          content: code
        },
        ...files.map((f: any) => ({ name: f.path, content: f.content }))
      ];

      const pistonResponse = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: pistonLanguage,
          version: '*',
          files: filesPayload
        })
      });

      if (!pistonResponse.ok) {
        throw new Error(`Piston sandbox failed with status ${pistonResponse.status}`);
      }

      const pistonResult = await pistonResponse.json();
      result = {
        stdout: pistonResult.run?.stdout || '',
        stderr: pistonResult.run?.stderr || '',
        exitCode: pistonResult.run?.code !== undefined ? pistonResult.run.code : 0,
        executionTimeMs: 120
      };
    }

    await updateSandboxStats(result.executionTimeMs || 10);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Execution error.' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
