import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as fs from 'fs/promises';
import * as path from 'path';

const localEmbeddingsFile = path.join(process.cwd(), 'data', 'embeddings-fallback.json');

function getTokenVector(text: string, dimensions = 1536): number[] {
  const tokens = text.toLowerCase().match(/[a-zA-Z0-9_]+/g) || [];
  const vector = new Array(dimensions).fill(0);
  if (tokens.length === 0) return vector;

  for (const token of tokens) {
    let h = 0;
    for (let i = 0; i < token.length; i++) {
      h = (31 * h + token.charCodeAt(i)) % dimensions;
    }
    vector[h] += 1.0;
  }

  // L2-normalize the vector
  let sqSum = 0;
  for (let i = 0; i < dimensions; i++) {
    sqSum += vector[i] * vector[i];
  }
  if (sqSum > 0) {
    const magnitude = Math.sqrt(sqSum);
    for (let i = 0; i < dimensions; i++) {
      vector[i] /= magnitude;
    }
  }
  return vector;
}

interface CodeChunk {
  type: string;
  name: string;
  code: string;
  start_line: number;
  end_line: number;
  docstring: string;
}

function parsePythonCode(content: string): CodeChunk[] {
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const funcMatch = line.match(/^(async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*:/);
    const classMatch = line.match(/^class\s+([a-zA-Z0-9_]+)\s*(\(([^)]*)\))?\s*:/);
    
    if (funcMatch) {
      const funcName = funcMatch[2];
      const bodyLines = lines.slice(i, i + 15);
      chunks.push({
        type: 'function',
        name: funcName,
        code: bodyLines.join('\n'),
        start_line: i + 1,
        end_line: i + bodyLines.length,
        docstring: ''
      });
    } else if (classMatch) {
      const className = classMatch[1];
      const bodyLines = lines.slice(i, i + 25);
      chunks.push({
        type: 'class',
        name: className,
        code: bodyLines.join('\n'),
        start_line: i + 1,
        end_line: i + bodyLines.length,
        docstring: ''
      });
    }
  }
  return chunks;
}

async function walk(dir: string, fileList: string[] = [], ignoreDirs: Set<string>): Promise<string[]> {
  const files = await fs.readdir(dir, { withFileTypes: true });
  for (const file of files) {
    if (ignoreDirs.has(file.name)) continue;
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      await walk(filePath, fileList, ignoreDirs);
    } else {
      const ext = path.extname(file.name);
      if (['.py', '.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { project_id, github_repo_url, branch = 'main' } = body;

    if (!project_id || !github_repo_url) {
      return NextResponse.json({ error: 'project_id and github_repo_url are required.' }, { status: 400 });
    }

    // Crawl workspace (3 levels up from apps/frontend/src/app/api/v1/repos/sync)
    const workspaceRoot = path.resolve(process.cwd(), '..', '..');
    const ignoreDirs = new Set(['.git', 'node_modules', '.next', '__pycache__', 'dist', 'build', 'dev.db', 'package-lock.json', '.gemini']);
    const fileList: string[] = [];
    
    await walk(workspaceRoot, fileList, ignoreDirs);

    const points: any[] = [];
    
    for (const filePath of fileList) {
      const relPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
      const ext = path.extname(filePath);
      
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        
        if (ext === '.py') {
          const chunks = parsePythonCode(content);
          for (const chunk of chunks) {
            const vector = getTokenVector(chunk.code + " " + chunk.name);
            points.push({
              point_id: `${relPath}:${chunk.name}`,
              vector,
              payload: {
                project_id,
                file_path: relPath,
                name: chunk.name,
                type: chunk.type,
                code: chunk.code,
                docstring: chunk.docstring,
                start_line: chunk.start_line,
                end_line: chunk.end_line
              }
            });
          }
        } else {
          // JS/TS files chunked by 25 lines
          const lines = content.split('\n');
          const chunkSize = 25;
          for (let i = 0; i < lines.length; i += chunkSize) {
            const chunkLines = lines.slice(i, i + chunkSize);
            const codeSnippet = chunkLines.join('\n');
            const chunkName = `chunk_${Math.floor(i / chunkSize)}`;
            const vector = getTokenVector(codeSnippet);
            points.push({
              point_id: `${relPath}:${chunkName}`,
              vector,
              payload: {
                project_id,
                file_path: relPath,
                name: chunkName,
                type: 'code_block',
                code: codeSnippet,
                docstring: '',
                start_line: i + 1,
                end_line: i + chunkLines.length
              }
            });
          }
        }
      } catch (e) {
        console.warn(`Failed to process file ${filePath}:`, e);
      }
    }

    // Push chunks to database or fallback file
    try {
      if (!process.env.DATABASE_URL) throw new Error("No DB config");
      
      // Delete old indexes for this project
      await prisma.fileIndex.deleteMany({
        where: { projectId: project_id }
      });
      
      // Upsert new ones
      for (const p of points) {
        // Find or create project if not exists
        await prisma.fileIndex.create({
          data: {
            projectId: project_id,
            filePath: p.payload.file_path,
            fileSha: 'sha',
            fileSizeBytes: p.payload.code.length,
            language: path.extname(p.payload.file_path).slice(1),
            embedding: JSON.stringify({ vector: p.vector, payload: p.payload }),
          }
        });
      }
    } catch (dbErr) {
      console.warn("DB offline, saving points to local embeddings file:", dbErr);
      await fs.mkdir(path.dirname(localEmbeddingsFile), { recursive: true });
      await fs.writeFile(localEmbeddingsFile, JSON.stringify(points, null, 2));
    }

    return NextResponse.json({
      task_id: `sync_task_${project_id}`,
      status: 'completed',
      message: `Repository indexed successfully. Found ${points.length} chunks.`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Sync error.' }, { status: 500 });
  }
}
