import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getAuthenticatedUser } from '@/utils/supabase/auth';
import { getRedisClient } from '@/lib/redis';

const localEmbeddingsFile = path.join(process.cwd(), 'data', 'embeddings-fallback.json');

// Initialize Redis Client
const redisClient = getRedisClient();

let isRedisReady = false;
redisClient.on('connect', () => {
  isRedisReady = true;
  if (process.env.NEXT_PHASE !== 'phase-production-build') {
    console.log('[Redis] Connected successfully.');
  }
});
redisClient.on('error', (err) => {
  isRedisReady = false;
  if (process.env.NEXT_PHASE !== 'phase-production-build') {
    console.warn('[Redis] Connection offline, using in-memory fallbacks. Error:', err.message);
  }
});

// Declarations for fallback variables
declare global {
  var memoryRateLimits: Map<string, number[]> | undefined;
}

if (!globalThis.memoryRateLimits) {
  globalThis.memoryRateLimits = new Map<string, number[]>();
}

const localCache = new Map<string, { content: string; codeSnippet?: any }>();

// Caching wrappers
async function getFromCache(key: string): Promise<{ content: string; codeSnippet?: any } | null> {
  if (isRedisReady) {
    try {
      const data = await redisClient.get(`llm:prompt:cache:${key}`);
      if (data) return JSON.parse(data);
    } catch (err) {
      console.warn('[Redis Cache] Read error:', err);
    }
  }
  return localCache.get(key) || null;
}

async function saveToCache(key: string, data: { content: string; codeSnippet?: any }) {
  if (isRedisReady) {
    try {
      await redisClient.set(`llm:prompt:cache:${key}`, JSON.stringify(data), 'EX', 7200); // 2 Hours expiration
      return;
    } catch (err) {
      console.warn('[Redis Cache] Write error:', err);
    }
  }
  localCache.set(key, data);
}

// Sliding-window rate limiter
async function isRateLimited(userId: string, limit = 60, windowSeconds = 60): Promise<boolean> {
  const key = `rate:limit:${userId}:completions`;
  const now = Date.now();
  const clearBefore = now - windowSeconds * 1000;

  if (isRedisReady) {
    try {
      const pipeline = redisClient.multi();
      pipeline.zremrangebyscore(key, 0, clearBefore);
      pipeline.zadd(key, now, now.toString());
      pipeline.zcard(key);
      pipeline.expire(key, windowSeconds);
      const results = await pipeline.exec();
      if (results && results[2]) {
        const count = results[2][1] as number;
        return count > limit;
      }
    } catch (err) {
      console.warn('[Redis Rate Limiter] Error, falling back to memory:', err);
    }
  }

  const timestamps = globalThis.memoryRateLimits!.get(userId) || [];
  const validTimestamps = timestamps.filter((t) => t > clearBefore);
  validTimestamps.push(now);
  globalThis.memoryRateLimits!.set(userId, validTimestamps);
  return validTimestamps.length > limit;
}

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

async function saveAssistantMessage(conversationId: string | null | undefined, content: string) {
  if (!process.env.DATABASE_URL || !conversationId) return;
  try {
    const assistantCompletionTokens = Math.round(content.length / 4) || 1;
    await prisma.message.create({
      data: {
        conversationId,
        senderRole: 'assistant',
        content: content.trim(),
        completionTokens: assistantCompletionTokens,
      }
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });
  } catch (dbErr) {
    console.error("Failed to persist assistant reply:", dbErr);
  }
}

export async function POST(req: Request) {
  const traceParentHeader = req.headers.get('traceparent') || req.headers.get('x-trace-id') || '';
  let traceId = generateHexId(16);
  let parentSpanId: string | undefined = undefined;

  if (traceParentHeader) {
    const parts = traceParentHeader.split('-');
    if (parts.length >= 3) {
      traceId = parts[1];
      parentSpanId = parts[2];
    }
  }
  const spanId = generateHexId(8);
  const startTime = Date.now();
  let provider: 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'mock' = 'mock';
  let modelToUse = 'CodexForge-MoE';

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting check
  if (await isRateLimited(user.id)) {
    return NextResponse.json({ error: 'Too Many Requests. Rate limit exceeded (60 requests/minute).' }, { status: 429 });
  }

  // Load user custom external API keys from DB
  const keysMap = new Map<string, { apiKey: string; baseUrl?: string | null; defaultModel?: string | null }>();
  try {
    const dbKeys = await prisma.externalKey.findMany({
      where: { userId: user.id }
    });
    for (const k of dbKeys) {
      const cleanProv = k.provider.toLowerCase().trim();
      keysMap.set(cleanProv, {
        apiKey: k.apiKey,
        baseUrl: k.baseUrl,
        defaultModel: k.defaultModel
      });
    }
  } catch (dbKeysErr) {
    console.warn("Failed to load user external keys:", dbKeysErr);
  }

  const geminiKey = keysMap.get('gemini')?.apiKey || process.env.GEMINI_API_KEY || '';
  const openAIKey = keysMap.get('openai')?.apiKey || keysMap.get('chatgpt')?.apiKey || process.env.OPENAI_API_KEY || '';
  const anthropicKey = keysMap.get('anthropic')?.apiKey || keysMap.get('claude')?.apiKey || '';
  const deepseekKey = keysMap.get('deepseek')?.apiKey || '';

  try {
    const body = await req.json();
    const { messages, project_id, conversation_id, model, system_prompt } = body;
    const lastMessage = messages[messages.length - 1]?.content || '';

    // Choose Provider and Map selected Models
    modelToUse = model || 'CodexForge-MoE';
    let keyMissingWarning = '';
    let keyToUse = '';
    let customBaseUrl = '';

    const cleanModel = modelToUse.toLowerCase().trim();

    if (modelToUse === 'CodexForge-MoE') {
      if (geminiKey) {
        provider = 'gemini';
        modelToUse = 'gemini-3.5-flash';
        keyToUse = geminiKey;
      } else if (openAIKey) {
        provider = 'openai';
        modelToUse = 'gpt-5.4-mini-2026-03-17';
        keyToUse = openAIKey;
      } else {
        keyMissingWarning = `⚠️ [API Key Missing]: No Gemini or OpenAI API credentials configured for your CodexForge MoE model. Please configure your keys in the "API Keys" page.\n\n`;
        provider = 'mock';
      }
    } else if (cleanModel.includes('gpt') || cleanModel.includes('chatgpt') || cleanModel === 'openai') {
      if (openAIKey) {
        provider = 'openai';
        modelToUse = 'gpt-5.4-mini-2026-03-17';
        keyToUse = openAIKey;
      } else {
        keyMissingWarning = `⚠️ [API Key Missing]: OpenAI API key is not configured. Please add it in "API Keys" page.\n\n`;
        provider = 'mock';
      }
    } else if (cleanModel === 'gemini-3.5-flash' || cleanModel.includes('gemini')) {
      if (geminiKey) {
        provider = 'gemini';
        modelToUse = 'gemini-3.5-flash';
        keyToUse = geminiKey;
      } else {
        keyMissingWarning = `⚠️ [API Key Missing]: Gemini API key is not configured. Please add it in "API Keys" page.\n\n`;
        provider = 'mock';
      }
    } else if (cleanModel.includes('claude') || cleanModel.includes('anthropic')) {
      if (anthropicKey) {
        provider = 'anthropic';
        modelToUse = 'claude-haiku-4-5-20251001';
        keyToUse = anthropicKey;
      } else {
        keyMissingWarning = `⚠️ [API Key Missing]: Anthropic Claude API key is not configured. Please add it in "API Keys" page.\n\n`;
        provider = 'mock';
      }
    } else if (cleanModel.includes('deepseek')) {
      if (deepseekKey) {
        provider = 'deepseek';
        modelToUse = 'deepseek-chat';
        keyToUse = deepseekKey;
      } else {
        keyMissingWarning = `⚠️ [API Key Missing]: DeepSeek API key is not configured. Please add it in "API Keys" page.\n\n`;
        provider = 'mock';
      }
    } else {
      // Check if custom provider matches cleanModel or substring
      let matchedProviderKey = '';
      for (const prov of keysMap.keys()) {
        if (cleanModel === prov || cleanModel.includes(prov)) {
          matchedProviderKey = prov;
          break;
        }
      }

      if (matchedProviderKey) {
        const customProv = keysMap.get(matchedProviderKey)!;
        provider = 'openai'; // custom providers use standard OpenAI completions structure
        modelToUse = customProv.defaultModel || matchedProviderKey;
        keyToUse = customProv.apiKey;
        customBaseUrl = customProv.baseUrl || '';
      } else {
        // Fallback
        if (geminiKey) {
          provider = 'gemini';
          modelToUse = 'gemini-3.5-flash';
          keyToUse = geminiKey;
        } else if (openAIKey) {
          provider = 'openai';
          modelToUse = 'gpt-5.4-mini-2026-03-17';
          keyToUse = openAIKey;
        } else {
          provider = 'mock';
        }
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

    const cachedResponse = await getFromCache(cacheKey);
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
          let title = 'New Conversation';
          if (lastMessage) {
            const titleSnippet = lastMessage.substring(0, 30).trim();
            title = titleSnippet ? `${titleSnippet}...` : 'New Conversation';
          }

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

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:streamGenerateContent?key=${keyToUse}&alt=sse`, {
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
        } else {
          const errText = await res.text();
          console.warn(`Gemini API returned error status ${res.status}:`, errText);
          keyMissingWarning = `⚠️ [Gemini API Error - Status ${res.status}]: ${errText.substring(0, 200)}...\n\n`;
        }
      } catch (err: any) {
        console.warn("Gemini API call failed, attempting fallback:", err);
        keyMissingWarning = `⚠️ [Gemini API Call Failed]: ${err.message || err}\n\n`;
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

        let fetchUrl = "https://api.openai.com/v1/chat/completions";
        if (customBaseUrl) {
          if (customBaseUrl.endsWith("chat/completions")) {
            fetchUrl = customBaseUrl;
          } else {
            fetchUrl = customBaseUrl.endsWith("/") ? `${customBaseUrl}chat/completions` : `${customBaseUrl}/chat/completions`;
          }
        }

        const res = await fetch(fetchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${keyToUse}`
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
        } else {
          const errText = await res.text();
          console.warn(`OpenAI/Custom API returned error status ${res.status}:`, errText);
          keyMissingWarning = `⚠️ [API Error - Status ${res.status}]: ${errText.substring(0, 200)}...\n\n`;
        }
      } catch (err: any) {
        console.warn("OpenAI/Custom API call failed, attempting fallback:", err);
        keyMissingWarning = `⚠️ [API Call Failed]: ${err.message || err}\n\n`;
      }
    }

    if (provider === 'anthropic' && !reader) {
      try {
        const messagesPayload = messages.map((m: any) => ({
          role: (m.role === 'assistant' || m.senderRole === 'assistant') ? 'assistant' : 'user',
          content: m.content || m.text
        }));

        if (matches.length > 0 && messagesPayload.length > 0) {
          let context = "\n\n[CONTEXT DATA] Relevant code found in repository:\n";
          for (const m of matches) {
            context += `\nFile: ${m.payload.file_path} (${m.payload.type})\n\`\`\`\n${m.payload.code}\n\`\`\`\n`;
          }
          messagesPayload[messagesPayload.length - 1].content += context;
        }

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': keyToUse,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: modelToUse,
            messages: messagesPayload,
            system: promptInstruction || undefined,
            max_tokens: 1000,
            stream: true
          })
        });

        if (res.ok) {
          reader = res.body?.getReader();
        } else {
          const errText = await res.text();
          console.warn("Anthropic API returned error:", res.status, errText);
          keyMissingWarning = `⚠️ [Anthropic API Error - Status ${res.status}]: ${errText.substring(0, 200)}...\n\n`;
        }
      } catch (err: any) {
        console.warn("Anthropic API call failed:", err);
        keyMissingWarning = `⚠️ [Anthropic API Call Failed]: ${err.message || err}\n\n`;
      }
    }

    if (provider === 'deepseek' && !reader) {
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

        const res = await fetch("https://api.deepseek.com/chat/completions", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${keyToUse}`
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
        } else {
          const errText = await res.text();
          console.warn("DeepSeek API returned error:", res.status, errText);
          keyMissingWarning = `⚠️ [DeepSeek API Error - Status ${res.status}]: ${errText.substring(0, 200)}...\n\n`;
        }
      } catch (err: any) {
        console.warn("DeepSeek API call failed:", err);
        keyMissingWarning = `⚠️ [DeepSeek API Call Failed]: ${err.message || err}\n\n`;
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

          // Save mock completions in completions cache and persist to database
          if (assistantContent.trim()) {
            const parsedSnippet = parseCodeBlocks(assistantContent);
            await saveToCache(cacheKey, { content: assistantContent, codeSnippet: parsedSnippet });
          }
          await saveAssistantMessage(activeConversationId, assistantContent);
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
                  let lineToParse = cleanLine;
                  if (lineToParse.startsWith("data:")) {
                    lineToParse = lineToParse.substring(5).trim();
                  } else {
                    lineToParse = lineToParse.replace(/^,/, '').replace(/^\[/, '').replace(/\]$/, '').trim();
                  }

                  if (!lineToParse) continue;
                  try {
                    const obj = JSON.parse(lineToParse);
                    const text = obj.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                      assistantContent += text;
                      sendChunk({ token: text, finish_reason: null });
                    }
                  } catch (e) {
                    // Ignore parse errors for structural formatting elements
                  }
                  continue;
                }

                if (provider === 'openai' || provider === 'deepseek') {
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

                if (provider === 'anthropic') {
                  if (cleanLine.startsWith("data:")) {
                    const dataStr = cleanLine.substring(5).trim();
                    try {
                      const chunkObj = JSON.parse(dataStr);
                      if (chunkObj.type === "content_block_delta" && chunkObj.delta?.text) {
                        const text = chunkObj.delta.text;
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
              await saveToCache(cacheKey, { content: assistantContent, codeSnippet: parsedSnippet });
            }

            // Persist assistant reply to DB
            await saveAssistantMessage(activeConversationId, assistantContent);

            const durationMs = Date.now() - startTime;
            // Send OTLP trace span for successful completions
            await sendNextjsOtelSpan(
              `Completions Stream ${modelToUse}`,
              traceId,
              spanId,
              parentSpanId,
              durationMs,
              {
                'llm.model': modelToUse,
                'llm.provider': provider,
                'llm.prompt_cache_hit': cachedResponse ? 'true' : 'false',
                'llm.tokens_generated_estimate': String(Math.round(assistantContent.length / 4)),
                'http.status_code': '200',
              }
            );

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
    const durationMs = Date.now() - startTime;
    await sendNextjsOtelSpan(
      `Completions Stream ${modelToUse || 'unknown'}`,
      traceId,
      spanId,
      parentSpanId,
      durationMs,
      {
        'llm.model': modelToUse || 'unknown',
        'error': 'true',
        'error.message': error.message || 'Completions error.',
        'http.status_code': '500',
      }
    );
    return NextResponse.json({ error: error.message || 'Completions error.' }, { status: 500 });
  }
}

function generateHexId(bytes: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < bytes * 2; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

async function sendNextjsOtelSpan(
  name: string,
  traceId: string,
  spanId: string,
  parentSpanId: string | undefined,
  durationMs: number,
  attributes: Record<string, string>,
) {
  const endpoint = process.env.OTLP_TRACE_ENDPOINT || 'http://localhost:4318/v1/traces';
  const startTimeUnixNano = (BigInt(Date.now() - durationMs) * BigInt(1000000)).toString();
  const endTimeUnixNano = (BigInt(Date.now()) * BigInt(1000000)).toString();

  const payload = {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'frontend-nextjs' } },
            { key: 'telemetry.sdk.name', value: { stringValue: 'codexforge-otel-nextjs' } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: 'codexforge.nextjs.tracer' },
            spans: [
              {
                traceId,
                spanId,
                parentSpanId: parentSpanId || undefined,
                name,
                kind: 2, // SERVER
                startTimeUnixNano,
                endTimeUnixNano,
                attributes: Object.entries(attributes).map(([key, val]) => ({
                  key,
                  value: { stringValue: String(val) },
                })),
                status: {
                  code: attributes['error'] ? 2 : 1,
                },
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log(`[Telemetry Span] ${name} | Trace ID: ${traceId} | Duration: ${durationMs}ms`);
  } catch (err: any) {
    // Fail silently if OTLP collector is offline
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
