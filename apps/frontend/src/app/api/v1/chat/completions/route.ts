import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getAuthenticatedUser } from '@/utils/supabase/auth';

const localEmbeddingsFile = path.join(process.cwd(), 'data', 'embeddings-fallback.json');

// In-memory LLM response cache
const promptCache = new Map<string, { content: string; codeSnippet?: any }>();

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

function parseCodeBlocks(text: string) {
  const regex = /```(python|js|javascript|plaintext|json)?\n([\s\S]*?)```/g;
  const matches = [...text.matchAll(regex)];
  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    return {
      filename: lastMatch[1] && lastMatch[1].startsWith("py") ? "main.py" : "index.js",
      code: lastMatch[2].trim(),
    };
  }
  return null;
}

// Standard local mock responses if LLM APIs are offline
function getLocalResponse(prompt: string) {
  const query = prompt.toLowerCase().trim();

  let isConversational = true;
  const codeKeywords = ["code", "write", "program", "function", "script", "class", "print", "implement", "create", "generate", "fizzbuzz", "fibonacci", "factorial", "reverse"];
  for (const word of codeKeywords) {
    if (query.includes(word)) {
      isConversational = false;
      break;
    }
  }

  if (isConversational) {
    if (["hello", "hi", "hey", "greetings", "yo"].some(w => query.includes(w))) {
      return {
        text: "Hello! I am CodexForge, your advanced generative intelligence assistant. I am ready to converse, answer general questions, or help you write code in your sandbox. How can I help you today?",
        snippet: null
      };
    }
    if (query.includes("how are you") || query.includes("how's it going")) {
      return {
        text: "I'm doing excellent and ready to assist you! We can discuss literature, science, history, or dive straight into sandbox coding. What is on your mind?",
        snippet: null
      };
    }
    return {
      text: `I received your query: '${prompt}'. As a general-purpose language intelligence, I can write stories, analyze concepts, draft text, or implement code blocks for execution inside the workspace sandbox!`,
      snippet: null
    };
  }

  if (query.includes("hello world") || query.includes("say hello")) {
    return {
      text: "Sure! Here is the python script to print 'Hello, World!' to the console.",
      snippet: { filename: "main.py", code: 'print("Hello, World!")' }
    };
  }
  if (query.includes("fibonacci")) {
    return {
      text: "Here is an implementation of a Fibonacci sequence generator. It computes the first n terms of the sequence.",
      snippet: {
        filename: "main.py",
        code: 'def calculate_fibonacci(n):\n    if n <= 0:\n        return []\n    elif n == 1:\n        return [0]\n    \n    fib = [0, 1]\n    while len(fib) < n:\n        fib.append(fib[-1] + fib[-2])\n    return fib\n\nprint("Fibonacci Sequence (10 terms):", calculate_fibonacci(10))'
      }
    };
  }
  return {
    text: `Here is a boilerplate python script matching your code request: '${prompt}':`,
    snippet: {
      filename: "main.py",
      code: `# Boilerplate generated for: ${prompt}\ndef run_task():\n    print('Executing custom task...')\n\nrun_task()`
    }
  };
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { messages, project_id, conversation_id, model, system_prompt } = body;
    const lastMessage = messages[messages.length - 1]?.content || '';

    // Choose Provider and Map selected Models
    let provider: 'gemini' | 'openai' | 'mock' = 'mock';
    let modelToUse = model || 'CodexForge-MoE';
    let keyMissingWarning = '';

    if (modelToUse === 'CodexForge-MoE') {
      if (process.env.GEMINI_API_KEY) {
        provider = 'gemini';
        modelToUse = 'gemini-3.5-flash';
      } else if (process.env.OPENAI_API_KEY) {
        provider = 'openai';
        modelToUse = 'gpt-5.4-mini-2026-03-17';
      } else {
        keyMissingWarning = `⚠️ [API Key Missing]: No Gemini or OpenAI API credentials configured for your CodexForge MoE model. Falling back to offline mock...\n\n`;
        provider = 'mock';
      }
    } else if (modelToUse === 'gpt-4o') {
      if (process.env.OPENAI_API_KEY) {
        provider = 'openai';
        modelToUse = 'gpt-5.4-mini-2026-03-17';
      } else {
        keyMissingWarning = `⚠️ [API Key Missing]: OpenAI API key is not configured. Falling back to offline mock...\n\n`;
        provider = 'mock';
      }
    } else if (modelToUse === 'gemini-3.5-flash') {
      if (process.env.GEMINI_API_KEY) {
        provider = 'gemini';
        modelToUse = 'gemini-3.5-flash';
      } else {
        keyMissingWarning = `⚠️ [API Key Missing]: Gemini API key is not configured. Falling back to offline mock...\n\n`;
        provider = 'mock';
      }
    } else {
      if (process.env.GEMINI_API_KEY) {
        provider = 'gemini';
        modelToUse = 'gemini-3.5-flash';
      } else if (process.env.OPENAI_API_KEY) {
        provider = 'openai';
        modelToUse = 'gpt-5.4-mini-2026-03-17';
      } else {
        provider = 'mock';
      }
    }

    // Custom system prompt prepend if using our proprietary CodexForge-MoE model
    let promptInstruction = system_prompt || '';
    if (model === 'CodexForge-MoE') {
      promptInstruction = `You are CodexForge MoE, a highly intelligent proprietary Mixture of Experts AI assistant developed by CodexForge. You orchestrate multiple worker agents to solve complex questions, write code, explain concepts, and debug problems. You utilize active file context and execute code safely inside the sandboxed console. Always speak with clarity, precision, and authority. ${system_prompt || ''}`;
    }

    const encoder = new TextEncoder();

    // 1. LLM Completions Caching Lookups
    const cacheKey = createHash('sha256')
      .update(`${modelToUse}_${promptInstruction}_${JSON.stringify(messages)}`)
      .digest('hex');

    const cachedResponse = promptCache.get(cacheKey);
    if (cachedResponse) {
      console.log("LLM Cache Hit for key:", cacheKey);

      const cachedStream = new ReadableStream({
        async start(controller) {
          const sendChunk = (data: any) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          sendChunk({ token: "⚡ [CodexForge Cache Hit]: Response loaded from local LLM Cache...\n\n", finish_reason: null });

          const tokens = cachedResponse.content.split(' ');
          for (const token of tokens) {
            sendChunk({ token: token + ' ', finish_reason: null });
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          if (cachedResponse.codeSnippet) {
            sendChunk({ token: '', finish_reason: 'stop', code_snippet: cachedResponse.codeSnippet, conversation_id: conversation_id || 'default' });
          } else {
            sendChunk({ token: '', finish_reason: 'stop', conversation_id: conversation_id || 'default' });
          }
          controller.close();
        }
      });

      return new Response(cachedStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      });
    }

    // Resolve or create SQL-persisted conversation thread
    let activeConversationId = conversation_id;
    if (process.env.DATABASE_URL) {
      try {
        if (activeConversationId && activeConversationId !== 'default' && activeConversationId !== 'new') {
          const exists = await prisma.conversation.findFirst({
            where: { id: activeConversationId, userId: user.id }
          });
          if (!exists) activeConversationId = null;
        } else {
          activeConversationId = null;
        }

        if (!activeConversationId) {
          const titleSnippet = lastMessage.substring(0, 30).trim();
          const title = titleSnippet ? `${titleSnippet}...` : 'New Conversation';
          const newConv = await prisma.conversation.create({
            data: {
              userId: user.id,
              title,
              activeModel: model || 'CodexForge-MoE',
            }
          });
          activeConversationId = newConv.id;
        } else {
          await prisma.conversation.update({
            where: { id: activeConversationId },
            data: { activeModel: model || 'CodexForge-MoE' }
          });
        }

        // Persist User message inside DB
        const userPromptTokens = Math.round(lastMessage.length / 4) || 1;
        await prisma.message.create({
          data: {
            conversationId: activeConversationId,
            senderRole: 'user',
            content: lastMessage,
            promptTokens: userPromptTokens,
          }
        });
      } catch (dbErr) {
        console.warn("Database failed during conversation initialization:", dbErr);
      }
    }

    // 2. Perform semantic search (RAG)
    let matches: any[] = [];
    if (project_id) {
      const queryVector = getTokenVector(lastMessage);

      try {
        if (!process.env.DATABASE_URL) throw new Error("No DB config");
        const indexes = await prisma.fileIndex.findMany({
          where: { projectId: project_id }
        });

        for (const idx of indexes) {
          if (idx.embedding) {
            const data = JSON.parse(idx.embedding);
            const score = queryVector.reduce((sum, q, i) => sum + q * (data.vector[i] || 0), 0);
            if (score > 0.05) {
              matches.push({ score, payload: data.payload });
            }
          }
        }
      } catch (dbErr) {
        try {
          const content = await fs.readFile(localEmbeddingsFile, 'utf-8');
          const data = JSON.parse(content);
          const projectData = data.filter((item: any) => item.payload.project_id === project_id);
          for (const item of projectData) {
            const score = queryVector.reduce((sum, q, i) => sum + q * (item.vector[i] || 0), 0);
            if (score > 0.05) {
              matches.push({ score, payload: item.payload });
            }
          }
        } catch { }
      }
      matches.sort((a, b) => b.score - a.score);
      matches = matches.slice(0, 3);
    }

    // 3. Stream completions via selected API
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined = undefined;

    if (provider === 'gemini') {
      try {
        const contents = messages.map((m: any) => ({
          role: (m.role === 'assistant' || m.senderRole === 'assistant') ? 'model' : 'user',
          parts: [{ text: m.content || m.text }]
        }));

        if (matches.length > 0 && contents.length > 0) {
          let context = "\n\n[CONTEXT DATA] Relevant code found in repository:\n";
          for (const m of matches) {
            context += `\nFile: ${m.payload.file_path} (${m.payload.type})\n\`\`\`\n${m.payload.code}\n\`\`\`\n`;
          }
          contents[contents.length - 1].parts[0].text += context;
        }

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:streamGenerateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: promptInstruction ? {
              parts: [{ text: promptInstruction }]
            } : undefined,
            generationConfig: { temperature: 0.2, maxOutputTokens: 1000 }
          })
        });

        if (res.ok) {
          reader = res.body?.getReader();
        }
      } catch (err) {
        console.warn("Gemini API call failed, attempting fallback:", err);
      }
    }

    if (provider === 'openai' && !reader) {
      try {
        const messagesPayload = messages.map((m: any) => ({
          role: m.role || m.senderRole || 'user',
          content: m.content || m.text
        }));

        if (promptInstruction) {
          messagesPayload.unshift({ role: 'system', content: promptInstruction });
        }

        if (matches.length > 0 && messagesPayload.length > 0) {
          let context = "\n\n[CONTEXT DATA] Relevant code found in repository:\n";
          for (const m of matches) {
            context += `\nFile: ${m.payload.file_path} (${m.payload.type})\n\`\`\`\n${m.payload.code}\n\`\`\`\n`;
          }
          messagesPayload[messagesPayload.length - 1].content += context;
        }

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: modelToUse,
            messages: messagesPayload,
            temperature: 0.2,
            max_tokens: 1000,
            stream: true
          })
        });

        if (res.ok) {
          reader = res.body?.getReader();
        }
      } catch (err) {
        console.warn("OpenAI API call failed, attempting fallback:", err);
      }
    }

    const decoder = new TextDecoder();
    let assistantContent = '';

    const stream = new ReadableStream({
      async start(controller) {
        const sendChunk = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        if (keyMissingWarning) {
          sendChunk({ token: keyMissingWarning, finish_reason: null });
          assistantContent += keyMissingWarning;
        }

        if (!reader) {
          const localResp = getLocalResponse(lastMessage);
          const tokens = localResp.text.split(' ');
          for (const token of tokens) {
            sendChunk({ token: token + ' ', finish_reason: null });
            assistantContent += token + ' ';
            await new Promise(resolve => setTimeout(resolve, 20));
          }

          if (localResp.snippet) {
            sendChunk({
              token: '',
              finish_reason: 'stop',
              code_snippet: localResp.snippet,
              conversation_id: activeConversationId || 'default'
            });
            assistantContent += '\n\n' + localResp.snippet.code;
          } else {
            sendChunk({
              token: '',
              finish_reason: 'stop',
              conversation_id: activeConversationId || 'default'
            });
          }
        } else {
          try {
            let buffer = '';
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                const cleanLine = line.trim();
                if (!cleanLine) continue;

                if (provider === 'gemini') {
                  try {
                    const cleaned = cleanLine.replace(/^,/, '').replace(/^\[/, '').replace(/\]$/, '').trim();
                    if (!cleaned) continue;
                    const obj = JSON.parse(cleaned);
                    const text = obj.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                      assistantContent += text;
                      sendChunk({ token: text, finish_reason: null });
                    }
                  } catch {
                    if (cleanLine.startsWith("data:")) {
                      const dataStr = cleanLine.substring(5).trim();
                      try {
                        const obj = JSON.parse(dataStr);
                        const text = obj.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                          assistantContent += text;
                          sendChunk({ token: text, finish_reason: null });
                        }
                      } catch { }
                    }
                  }
                  continue;
                }

                if (provider === 'openai') {
                  if (cleanLine.startsWith("data:")) {
                    const dataStr = cleanLine.substring(5).trim();
                    if (dataStr === "[DONE]") continue;

                    try {
                      const chunkObj = JSON.parse(dataStr);
                      const text = chunkObj.choices?.[0]?.delta?.content;
                      if (text) {
                        assistantContent += text;
                        sendChunk({ token: text, finish_reason: null });
                      }
                    } catch { }
                  }
                  continue;
                }
              }
            }
          } catch (streamErr) {
            console.error("Error streaming from agent:", streamErr);
          } finally {
            // Save inside completions cache
            if (assistantContent.trim()) {
              const parsedSnippet = parseCodeBlocks(assistantContent);
              promptCache.set(cacheKey, { content: assistantContent, codeSnippet: parsedSnippet });
            }

            // Persist assistant reply to DB
            if (process.env.DATABASE_URL && activeConversationId) {
              try {
                const assistantCompletionTokens = Math.round(assistantContent.length / 4) || 1;
                await prisma.message.create({
                  data: {
                    conversationId: activeConversationId,
                    senderRole: 'assistant',
                    content: assistantContent.trim(),
                    completionTokens: assistantCompletionTokens,
                  }
                });

                await prisma.conversation.update({
                  where: { id: activeConversationId },
                  data: { updatedAt: new Date() }
                });
              } catch (dbErr) {
                console.error("Failed to persist assistant reply:", dbErr);
              }
            }
            sendChunk({ token: '', finish_reason: 'stop', conversation_id: activeConversationId || 'default' });
            controller.close();
          }
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Completions error.' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
