"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useSidebar } from "@/context/SidebarContext";
import Editor from "@monaco-editor/react";

interface FileItem {
  name: string;
  language: string;
  content: string;
}

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  codeSnippet?: {
    filename: string;
    code: string;
  };
}

const suggestionsByMode = {
  general: [
    { label: "Explain quantum physics", text: "Explain quantum physics in simple terms for a beginner" },
    { label: "Brainstorm app ideas", text: "Brainstorm 5 innovative startup ideas combining AI and gaming" },
    { label: "Write a poem", text: "Write a short poem about space exploration and code" },
    { label: "Draft a follow-up email", text: "Draft a polite follow-up email to a recruiter after an interview" },
  ],
  developer: [
    { label: "Write a Hello World program", text: "Write a code to say hello world" },
    { label: "Compute Fibonacci sequence", text: "Write python code to compute fibonacci sequence" },
    { label: "Create recursive Factorial", text: "Show recursive factorial code in Python" },
    { label: "Create FizzBuzz script", text: "Show me a python fizzbuzz example script" },
  ],
  creative: [
    { label: "Draft a blog post", text: "Write a blog post outline about the future of human-AI collaboration" },
    { label: "Create story hook", text: "Write an intriguing opening paragraph for a science fiction novel" },
    { label: "Write newsletter copy", text: "Draft a weekly tech newsletter intro highlighting AI agent breakthroughs" },
    { label: "Brainstorm YouTube hooks", text: "Generate 5 high-converting YouTube hooks for a programming channel" },
  ],
  tutor: [
    { label: "Explain neural networks", text: "How do neural networks learn from data? Explain step by step" },
    { label: "Understand recursion", text: "Explain recursion in computer science using a real-world analogy" },
    { label: "Explain time complexity", text: "What is Big O notation? Walk me through calculating it" },
    { label: "Learn how API routes work", text: "Explain Next.js API routes and the client-server request-response lifecycle" },
  ],
};

const renderFormattedText = (text: string) => {
  if (!text) return null;

  const lines = text.split("\n");
  let inList = false;
  let listType: "ul" | "ol" | null = null;
  const listItems: React.ReactNode[] = [];
  
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockLang = "";
  
  const elements: React.ReactNode[] = [];

  const parseInlineElements = (lineText: string, keyPrefix: string) => {
    const parts: React.ReactNode[] = [];
    let currentIdx = 0;
    let i = 0;
    
    while (i < lineText.length) {
      if (lineText[i] === "`") {
        const nextBacktick = lineText.indexOf("`", i + 1);
        if (nextBacktick !== -1) {
          if (i > currentIdx) {
            parts.push(lineText.substring(currentIdx, i));
          }
          const codeContent = lineText.substring(i + 1, nextBacktick);
          parts.push(
            <code key={`code-${keyPrefix}-${i}`} className="font-mono text-[10px] bg-neutral-900 border border-[#1f1f1f] rounded px-1.5 py-0.5 text-neutral-250 mx-0.5 font-semibold">
              {codeContent}
            </code>
          );
          i = nextBacktick + 1;
          currentIdx = i;
          continue;
        }
      }
      
      const isDoubleAsterisk = lineText[i] === "*" && lineText[i + 1] === "*";
      const isDoubleUnderscore = lineText[i] === "_" && lineText[i + 1] === "_";
      if (isDoubleAsterisk || isDoubleUnderscore) {
        const marker = isDoubleAsterisk ? "**" : "__";
        const nextMarker = lineText.indexOf(marker, i + 2);
        if (nextMarker !== -1) {
          if (i > currentIdx) {
            parts.push(lineText.substring(currentIdx, i));
          }
          const boldContent = lineText.substring(i + 2, nextMarker);
          parts.push(
            <strong key={`bold-${keyPrefix}-${i}`} className="font-bold text-white mx-0.5">
              {boldContent}
            </strong>
          );
          i = nextMarker + 2;
          currentIdx = i;
          continue;
        }
      }
      
      const isSingleAsterisk = lineText[i] === "*";
      const isSingleUnderscore = lineText[i] === "_";
      if (isSingleAsterisk || isSingleUnderscore) {
        const marker = isSingleAsterisk ? "*" : "_";
        const nextMarker = lineText.indexOf(marker, i + 1);
        if (nextMarker !== -1 && nextMarker > i + 1) {
          if (i > currentIdx) {
            parts.push(lineText.substring(currentIdx, i));
          }
          const italicContent = lineText.substring(i + 1, nextMarker);
          parts.push(
            <em key={`italic-${keyPrefix}-${i}`} className="italic text-neutral-200 mx-0.5">
              {italicContent}
            </em>
          );
          i = nextMarker + 1;
          currentIdx = i;
          continue;
        }
      }
      
      i++;
    }
    
    if (currentIdx < lineText.length) {
      parts.push(lineText.substring(currentIdx));
    }
    
    return parts.length > 0 ? parts : lineText;
  };

  const flushList = (index: number) => {
    if (listItems.length > 0) {
      if (listType === "ol") {
        elements.push(
          <ol key={`list-${index}`} className="list-decimal pl-5 my-2 flex flex-col gap-1 select-text">
            {[...listItems]}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`list-${index}`} className="list-disc pl-5 my-2 flex flex-col gap-1 select-text">
            {[...listItems]}
          </ul>
        );
      }
      listItems.length = 0;
      inList = false;
      listType = null;
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (!inCodeBlock) {
        flushList(index);
        inCodeBlock = true;
        codeBlockLang = trimmed.substring(3).trim();
        codeBlockLines = [];
      } else {
        const codeText = codeBlockLines.join("\n");
        elements.push(
          <div key={`code-block-${index}`} className="my-4 flex flex-col gap-2 rounded-2xl bg-black border border-[#1f1f1f] overflow-hidden select-none">
            <div className="flex items-center justify-between px-4 py-2 bg-neutral-900/50 border-b border-[#1f1f1f]">
              <span className="font-mono text-[10px] text-neutral-400">
                {codeBlockLang || "code"}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(codeText);
                  alert("Copied code to clipboard!");
                }}
                className="px-2.5 py-1 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-[10px] border border-[#1f1f1f] transition-all cursor-pointer"
              >
                Copy Code
              </button>
            </div>
            <pre className="font-mono text-[10px] text-white overflow-x-auto p-4 bg-black/60 leading-relaxed max-h-64 select-text">
              {codeText}
            </pre>
          </div>
        );
        inCodeBlock = false;
        codeBlockLang = "";
        codeBlockLines = [];
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      return;
    }

    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);

    if (trimmed.startsWith("### ")) {
      flushList(index);
      elements.push(
        <h3 key={`h3-${index}`} className="text-xs font-bold text-white mt-4 mb-1.5 first:mt-0 uppercase tracking-wider select-text">
          {parseInlineElements(trimmed.substring(4), `h3-${index}`)}
        </h3>
      );
    } else if (trimmed.startsWith("## ")) {
      flushList(index);
      elements.push(
        <h2 key={`h2-${index}`} className="text-sm font-bold text-white mt-5 mb-2 first:mt-0 select-text border-b border-[#1f1f1f] pb-1">
          {parseInlineElements(trimmed.substring(3), `h2-${index}`)}
        </h2>
      );
    } else if (trimmed.startsWith("# ")) {
      flushList(index);
      elements.push(
        <h1 key={`h1-${index}`} className="text-base font-bold text-white mt-6 mb-3 first:mt-0 select-text">
          {parseInlineElements(trimmed.substring(2), `h1-${index}`)}
        </h1>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (inList && listType !== "ul") {
        flushList(index);
      }
      inList = true;
      listType = "ul";
      listItems.push(
        <li key={`li-${index}-${listItems.length}`} className="text-neutral-300 leading-relaxed text-xs pl-0.5 select-text">
          {parseInlineElements(trimmed.substring(2), `li-${index}`)}
        </li>
      );
    } else if (numMatch) {
      if (inList && listType !== "ol") {
        flushList(index);
      }
      inList = true;
      listType = "ol";
      listItems.push(
        <li key={`li-${index}-${listItems.length}`} className="text-neutral-300 leading-relaxed text-xs pl-0.5 select-text">
          {parseInlineElements(numMatch[2], `li-${index}`)}
        </li>
      );
    } else {
      if (inList && trimmed === "") {
        flushList(index);
      } else if (inList) {
        flushList(index);
        elements.push(
          <p key={`p-${index}`} className="my-1.5 text-xs text-neutral-300 leading-relaxed select-text min-h-[1em] whitespace-pre-wrap">
            {parseInlineElements(line, `p-${index}`)}
          </p>
        );
      } else {
        elements.push(
          <p key={`p-${index}`} className="my-1.5 text-xs text-neutral-300 leading-relaxed select-text min-h-[1em] whitespace-pre-wrap">
            {parseInlineElements(line, `p-${index}`)}
          </p>
        );
      }
    }
  });

  if (inCodeBlock && codeBlockLines.length > 0) {
    const codeText = codeBlockLines.join("\n");
    elements.push(
      <div key={`code-block-end`} className="my-4 flex flex-col gap-2 rounded-2xl bg-black border border-[#1f1f1f] overflow-hidden select-none">
        <div className="flex items-center justify-between px-4 py-2 bg-neutral-900/50 border-b border-[#1f1f1f]">
          <span className="font-mono text-[10px] text-neutral-400">
            {codeBlockLang || "code"}
          </span>
        </div>
        <pre className="font-mono text-[10px] text-white overflow-x-auto p-4 bg-black/60 leading-relaxed max-h-64 select-text">
          {codeText}
        </pre>
      </div>
    );
  }

  flushList(lines.length);
  return elements;
};

const systemPromptByMode = {
  general: "You are CodexForge AI, a powerful, helpful and general-purpose conversational LLM assistant. You can write stories, analyze concepts, draft emails, explain complex ideas, chat casually, and write/run scripts. You are equipped with a Python/Node.js coding sandbox workspace panel on the right. When the user asks for code, provide it inside markdown blocks with clear explanations. You can help with any topic, not just programming.",
  developer: "You are CodexForge Software Engineer, a world-class coding assistant. You specialize in clean, efficient, well-documented code. Your primary goal is to help the user write, debug, and execute code in their sandboxed workspace. Focus on technical details, structure, performance, and explain the code concisely.",
  creative: "You are CodexForge Creative Writer, an AI specialized in brainstorming, creative writing, copywriting, and storytelling. Help the user draft engaging content, emails, essays, and stories. Use vivid imagery, premium vocabulary, and a tone tailored to the user's needs.",
  tutor: "You are CodexForge Tutor. Instead of giving answers directly, guide the user through the reasoning process by asking probing questions, explaining underlying concepts, and helping them learn step-by-step."
};

const getGreetingText = (mode: string) => {
  switch (mode) {
    case "developer":
      return "Hello! I am your CodexForge developer assistant. I'm connected to your sandboxed workspace. How can I help you program today?";
    case "creative":
      return "Hello! I am your CodexForge creative writing assistant. Let's draft compelling emails, stories, or outlines. What can I write for you?";
    case "tutor":
      return "Hello! I am your CodexForge tutor. Let's explore some new concepts and learn step-by-step. What would you like to study?";
    default:
      return "Hello! I am your CodexForge general AI assistant. I can write stories, analyze concepts, draft texts, or implement code blocks for execution inside the workspace sandbox. How can I help you today?";
  }
};

const agentSteps = [
  { id: 0, name: "Planner Agent", desc: "Analyzing prompt intent..." },
  { id: 1, name: "MoE Routing Engine", desc: "Selecting expert worker branches..." },
  { id: 2, name: "Synthesis Engine", desc: "Generating token completions..." },
  { id: 3, name: "Sandbox Security Review", desc: "Validating workspace compatibility..." },
];

export default function ChatPage() {
  const [selectedModel, setSelectedModel] = useState("CodexForge-MoE");
  const [selectedMode, setSelectedMode] = useState<'general' | 'developer' | 'creative' | 'tutor'>("general");

  const [isModelOpen, setIsModelOpen] = useState(false);
  const [isModeOpen, setIsModeOpen] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modelRef.current && !modelRef.current.contains(event.target as Node)) {
        setIsModelOpen(false);
      }
      if (modeRef.current && !modeRef.current.contains(event.target as Node)) {
        setIsModeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const [files, setFiles] = useState<Record<string, FileItem>>({
    "main.py": {
      name: "main.py",
      language: "python",
      content: `print("Welcome to CodexForge sandboxed workspace!")`,
    },
    "utils.py": {
      name: "utils.py",
      language: "python",
      content: `import time\n\ndef log_execution_time(func):\n    def wrapper(*args, **kwargs):\n        start = time.time()\n        result = func(*args, **kwargs)\n        end = time.time()\n        print(f"Executed in {end - start:.6f} seconds")\n        return result\n    return wrapper`,
    },
  });
  const [activeFileName, setActiveFileName] = useState("main.py");
  const [lockedFiles, setLockedFiles] = useState<Record<string, { userName: string; userId: string }>>({});
  const [chatInput, setChatInput] = useState("");
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      sender: "assistant",
      text: getGreetingText("general"),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [activeAgentStep, setActiveAgentStep] = useState(0);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string>(
    "Console logs idle. Run code in the workspace on the right to execute."
  );
  const [isRunning, setIsRunning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Not Synced");

  const supabase = createClient();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then((res: any) => {
      const u = res?.data?.user;
      if (u) {
        setUser(u);
      }
    });
  }, [supabase.auth]);

  const rawUserName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Developer";
  const cleanUserName = rawUserName.split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const firstName = cleanUserName.split(" ")[0];

  const {
    setConversations: setSidebarConversations,
    setActiveConversationId: setSidebarActiveConversationId,
    registerCallbacks,
    setSyncState,
  } = useSidebar();

  useEffect(() => {
    setSidebarConversations(conversations);
    setSidebarActiveConversationId(activeConversationId);
    setSyncState(isSyncing, syncStatus);
  }, [conversations, activeConversationId, isSyncing, syncStatus, setSidebarConversations, setSidebarActiveConversationId, setSyncState]);

  useEffect(() => {
    registerCallbacks({
      handleSelectConversation,
      handleNewSession,
      handleDeleteConversation,
      handleRenameConversation,
      handleSyncIndex,
    });
  }, [conversations, activeConversationId, isSyncing, syncStatus, selectedMode]);

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  useEffect(() => {
    if (!isThinking) {
      focusInput();
    }
  }, [isThinking, activeConversationId]);

  // Multi-Agent active step ticker
  useEffect(() => {
    let interval: any;
    if (isThinking) {
      setActiveAgentStep(0);
      interval = setInterval(() => {
        setActiveAgentStep((prev) => (prev < 3 ? prev + 1 : prev));
      }, 1000);
    } else {
      setActiveAgentStep(0);
    }
    return () => clearInterval(interval);
  }, [isThinking]);

  // Fetch conversation threads on component mount
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const response = await fetch(`/api/v1/conversations?t=${Date.now()}`, { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          setConversations(data);
          if (data.length > 0) {
            handleSelectConversation(data[0].id);
          }
        }
      } catch (error) {
        console.error("Failed to load conversations:", error);
      }
    };
    loadConversations();
  }, []);

  const handleSelectConversation = async (id: string) => {
    setActiveConversationId(id);
    try {
      const response = await fetch(`/api/v1/conversations/${id}?t=${Date.now()}`, { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        const mapped = data.messages.map((m: any) => ({
          id: m.id,
          sender: m.senderRole === "user" ? "user" : "assistant",
          text: m.content,
          timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          codeSnippet: parseCodeBlocks(m.content)
        }));
        setMessages(mapped.length > 0 ? mapped : [
          {
            id: "init",
            sender: "assistant",
            text: "Hello! This thread has no messages yet. Send a message to get started.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }
        ]);

        if (data.activeModel) {
          setSelectedModel(data.activeModel);
        }
      }
    } catch (error) {
      console.error("Failed to load conversation history:", error);
    }
  };

  const handleNewSession = () => {
    setActiveConversationId(null);
    setMessages([
      {
        id: "init",
        sender: "assistant",
        text: getGreetingText(selectedMode),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/v1/conversations/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (activeConversationId === id) {
          handleNewSession();
        }
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };
 
  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      const response = await fetch(`/api/v1/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (response.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
        );
      }
    } catch (error) {
      console.error("Failed to rename conversation:", error);
    }
  };

  const handleSyncIndex = async () => {
    setIsSyncing(true);
    setSyncStatus("Syncing...");
    try {
      const response = await fetch("/api/v1/repos/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: "workspace-project",
          github_repo_url: "https://github.com/dixon/workspace-project.git",
          branch: "main",
        }),
      });
      if (response.ok) {
        setSyncStatus("Indexed");
      } else {
        setSyncStatus("Error");
      }
    } catch (e) {
      console.error(e);
      setSyncStatus("Offline");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleModelChange = async (newModel: string) => {
    setSelectedModel(newModel);
    if (activeConversationId) {
      try {
        await fetch(`/api/v1/conversations/${activeConversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activeModel: newModel })
        });

        const convResp = await fetch(`/api/v1/conversations?t=${Date.now()}`, { cache: "no-store" });
        if (convResp.ok) {
          const convData = await convResp.json();
          setConversations(convData);
        }
      } catch (err) {
        console.error("Failed to update active model in DB:", err);
      }
    }
  };

  const handleModeChange = (newMode: 'general' | 'developer' | 'creative' | 'tutor') => {
    setSelectedMode(newMode);
    if (messages.length === 1 && messages[0].id === "init") {
      setMessages([
        {
          id: "init",
          sender: "assistant",
          text: getGreetingText(newMode),
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }
      ]);
    }
  };

  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then((res: any) => {
      const user = res?.data?.user;
      if (user) setCurrentUser(user);
    });
  }, []);

  const fetchLocks = async () => {
    try {
      const response = await fetch("/api/v1/projects/workspace-project/locks");
      if (response.ok) {
        const data = await response.json();
        const lockMap: Record<string, { userName: string; userId: string }> = {};
        data.forEach((lock: any) => {
          lockMap[lock.filePath] = { userName: lock.userName, userId: lock.userId };
        });
        setLockedFiles(lockMap);
      }
    } catch (error) {
      console.error("Failed to fetch active locks:", error);
    }
  };

  // Poll active locks every 5 seconds
  useEffect(() => {
    fetchLocks();
    const interval = setInterval(fetchLocks, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleFileLock = async (filename: string) => {
    const lockInfo = lockedFiles[filename];
    const isLocked = !!lockInfo;
    
    // If locked by someone else, prevent release
    if (isLocked && lockInfo.userId !== currentUser?.id) {
      alert(`File is locked by ${lockInfo.userName}. You cannot release this lock.`);
      return;
    }

    try {
      if (isLocked) {
        // Release lock
        const response = await fetch("/api/v1/projects/workspace-project/locks", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filePath: filename }),
        });
        if (response.ok) {
          await fetchLocks();
        }
      } else {
        // Acquire lock
        const response = await fetch("/api/v1/projects/workspace-project/locks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filePath: filename }),
        });
        if (response.ok) {
          await fetchLocks();
        } else if (response.status === 409) {
          const data = await response.json();
          alert(data.error || "Failed to acquire lock. The file is locked by another user.");
          await fetchLocks();
        }
      }
    } catch (error) {
      console.error("Failed to toggle file lock:", error);
    }
  };

  const activeFile = files[activeFileName];

  const parseCodeBlocks = (text: string) => {
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
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && !lockedFiles[activeFileName]) {
      setFiles((prev) => ({
        ...prev,
        [activeFileName]: {
          ...prev[activeFileName],
          content: value,
        },
      }));
    }
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setTerminalOutput(`[SANDBOX INITIALIZING] Spawning isolated workspace...\n[SANDBOX RUN] running ${activeFileName}\n...`);

    try {
      const additionalFiles = Object.values(files)
        .filter((f) => f.name !== activeFileName)
        .map((f) => ({ path: f.name, content: f.content }));

      const response = await fetch("/api/v1/sandbox/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: activeFile.language,
          code: activeFile.content,
          files: additionalFiles,
          timeoutMs: 5000,
          projectId: "workspace-project",
        }),
      });

      if (!response.ok) {
        throw new Error("Sandbox service returned an error status.");
      }

      const result = await response.json();

      let termOutput = `[SANDBOX INITIALIZING] Spawning isolated workspace...\n`;
      termOutput += `[SANDBOX RUN] running ${activeFileName}\n\n`;

      if (result.stdout) {
        termOutput += `${result.stdout}`;
      }
      if (result.stderr) {
        termOutput += `[STDERR]\n${result.stderr}`;
      }

      termOutput += `\n--------------------\n`;
      termOutput += `[FINISHED] Exit Code: ${result.exitCode} | Duration: ${result.executionTimeMs}ms`;

      setTerminalOutput(termOutput);
    } catch (error) {
      console.error(error);
      setTerminalOutput(
        `[ERROR] Failed to communicate with sandbox execution service. Ensure fallback execution APIs are working.`
      );
    } finally {
      setIsRunning(false);
    }
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsgId = Math.random().toString();
    const newUserMessage: Message = {
      id: userMsgId,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setChatInput("");
    setIsThinking(true);

    const assistantMsgId = Math.random().toString();
    let assistantText = "";

    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        sender: "assistant",
        text: "",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);

    try {
      const chatHistory = [
        ...messages
          .filter((m) => m.id !== "init")
          .map((m) => ({
            role: m.sender === "user" ? "user" : "assistant",
            content: m.text,
          })),
        { role: "user", content: textToSend },
      ];

      const response = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: activeConversationId || "new",
          project_id: "workspace-project",
          messages: chatHistory,
          model: selectedModel,
          system_prompt: systemPromptByMode[selectedMode],
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to communicate with agent service.");
      }

      setIsThinking(false);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine.startsWith("data:")) {
              const dataStr = cleanLine.substring(5).trim();
              try {
                const chunk = JSON.parse(dataStr);

                if (chunk.token) {
                  assistantText += chunk.token;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId ? { ...msg, text: assistantText } : msg
                    )
                  );
                }

                if (chunk.code_snippet) {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMsgId
                        ? { ...msg, codeSnippet: chunk.code_snippet }
                        : msg
                    )
                  );
                }

                if (chunk.conversation_id && chunk.conversation_id !== "default") {
                  if (activeConversationId !== chunk.conversation_id) {
                    setActiveConversationId(chunk.conversation_id);
                    const convResp = await fetch(`/api/v1/conversations?t=${Date.now()}`, { cache: "no-store" });
                    if (convResp.ok) {
                      const convData = await convResp.json();
                      setConversations(convData);
                    }
                  }
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setIsThinking(false);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
              ...msg,
              text: "I encountered a communication error. Please check your network and API key configurations.",
            }
            : msg
        )
      );
    }
  };

  const applyCodeSnippet = (filename: string, code: string) => {
    setFiles((prev) => ({
      ...prev,
      [filename]: {
        name: filename,
        language: filename.endsWith(".py") ? "python" : "javascript",
        content: code,
      },
    }));
    setActiveFileName(filename);
  };

  const suggestions = suggestionsByMode[selectedMode];

  const getWelcomeIcon = (mode: string) => {
    switch (mode) {
      case "developer": return "💻";
      case "creative": return "✍️";
      case "tutor": return "🎓";
      default: return "✨";
    }
  };

  const getWelcomeSubtitle = (mode: string) => {
    switch (mode) {
      case "developer": return "An isolated workspace environment with serverless code execution and metrics.";
      case "creative": return "Generate stories, draft outlines, copywrite, and edit content seamlessly.";
      case "tutor": return "Ask logical puzzles, break down complex concepts, and learn step-by-step.";
      default: return "Universal conversational assistant. Ask questions, translate, write, or brainstorm ideas.";
    }
  };

  return (
    <div className="flex-grow flex h-full overflow-hidden w-full relative bg-[#060606]">

      {/* CHAT PANEL */}
      <section className="flex-1 flex flex-col min-w-0 bg-[#060606] relative">

        {/* Floating Controller Header */}
        <div className="h-14 border-b border-[#1f1f1f] px-6 flex items-center justify-between flex-shrink-0 bg-[#060606] gap-4 overflow-visible select-none">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-white uppercase tracking-wider hidden sm:inline-block">CodexForge Agent</span>

            {/* Model selection dropdown */}
            <div className="relative" ref={modelRef}>
              <button
                onClick={() => setIsModelOpen(!isModelOpen)}
                className="flex items-center gap-2 bg-neutral-900/90 hover:bg-neutral-950 hover:text-white border border-[#1f1f1f] hover:border-neutral-800 rounded-xl text-neutral-300 px-3 py-1.5 text-xs font-medium focus:outline-none cursor-pointer transition-all duration-200 shadow-md active:scale-95"
              >
                <span>
                  {selectedModel === "CodexForge-MoE" && "CodexForge MoE (Default)"}
                  {selectedModel === "gpt-4o" && "ChatGPT (gpt-4o)"}
                  {selectedModel === "gemini-3.5-flash" && "Gemini (gemini-3.5-flash)"}
                </span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform duration-200 text-neutral-400 ${isModelOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isModelOpen && (
                <div className="absolute left-0 mt-2 w-56 rounded-2xl border border-[#222] bg-[#0c0c0c]/95 backdrop-blur-md p-1.5 shadow-2xl shadow-black/90 z-[100] transition-all duration-200 origin-top-left">
                  <button
                    onClick={() => {
                      handleModelChange("CodexForge-MoE");
                      setIsModelOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs rounded-xl cursor-pointer transition-all duration-200 ${
                      selectedModel === "CodexForge-MoE"
                        ? "bg-neutral-850 text-white font-semibold"
                        : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                    }`}
                  >
                    <span>CodexForge MoE (Default)</span>
                    {selectedModel === "CodexForge-MoE" && (
                      <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      handleModelChange("gpt-4o");
                      setIsModelOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs rounded-xl cursor-pointer transition-all duration-200 ${
                      selectedModel === "gpt-4o"
                        ? "bg-neutral-850 text-white font-semibold"
                        : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                    }`}
                  >
                    <span>ChatGPT (gpt-4o)</span>
                    {selectedModel === "gpt-4o" && (
                      <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      handleModelChange("gemini-3.5-flash");
                      setIsModelOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs rounded-xl cursor-pointer transition-all duration-200 ${
                      selectedModel === "gemini-3.5-flash"
                        ? "bg-neutral-850 text-white font-semibold"
                        : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                    }`}
                  >
                    <span>Gemini (gemini-3.5-flash)</span>
                    {selectedModel === "gemini-3.5-flash" && (
                      <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Mode selection dropdown */}
            <div className="relative" ref={modeRef}>
              <button
                onClick={() => setIsModeOpen(!isModeOpen)}
                className="flex items-center gap-2 bg-neutral-900/90 hover:bg-neutral-950 hover:text-white border border-[#1f1f1f] hover:border-neutral-800 rounded-xl text-neutral-300 px-3 py-1.5 text-xs font-medium focus:outline-none cursor-pointer transition-all duration-200 shadow-md active:scale-95"
              >
                <span>
                  {selectedMode === "general" && "💬 General Assistant"}
                  {selectedMode === "developer" && "💻 Code Specialist"}
                  {selectedMode === "creative" && "✍️ Creative Writer"}
                  {selectedMode === "tutor" && "🎓 Socratic Tutor"}
                </span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform duration-200 text-neutral-400 ${isModeOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isModeOpen && (
                <div className="absolute left-0 mt-2 w-56 rounded-2xl border border-[#222] bg-[#0c0c0c]/95 backdrop-blur-md p-1.5 shadow-2xl shadow-black/90 z-[100] transition-all duration-200 origin-top-left">
                  <button
                    onClick={() => {
                      handleModeChange("general");
                      setIsModeOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs rounded-xl cursor-pointer transition-all duration-200 ${
                      selectedMode === "general"
                        ? "bg-neutral-850 text-white font-semibold"
                        : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                    }`}
                  >
                    <span>💬 General Assistant</span>
                    {selectedMode === "general" && (
                      <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      handleModeChange("developer");
                      setIsModeOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs rounded-xl cursor-pointer transition-all duration-200 ${
                      selectedMode === "developer"
                        ? "bg-neutral-850 text-white font-semibold"
                        : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                    }`}
                  >
                    <span>💻 Code Specialist</span>
                    {selectedMode === "developer" && (
                      <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      handleModeChange("creative");
                      setIsModeOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs rounded-xl cursor-pointer transition-all duration-200 ${
                      selectedMode === "creative"
                        ? "bg-neutral-850 text-white font-semibold"
                        : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                    }`}
                  >
                    <span>✍️ Creative Writer</span>
                    {selectedMode === "creative" && (
                      <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      handleModeChange("tutor");
                      setIsModeOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs rounded-xl cursor-pointer transition-all duration-200 ${
                      selectedMode === "tutor"
                        ? "bg-neutral-850 text-white font-semibold"
                        : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                    }`}
                  >
                    <span>🎓 Socratic Tutor</span>
                    {selectedMode === "tutor" && (
                      <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowWorkspace(!showWorkspace)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${showWorkspace
                ? "bg-white text-black font-semibold hover:bg-white/90"
                : "bg-neutral-900 hover:bg-neutral-850 text-white border border-[#1f1f1f]"
              }`}
          >
            {showWorkspace ? "Close IDE Panel" : "Open IDE Panel"}
          </button>
        </div>

        {/* Chat Messages container */}
        <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center">
          <div className="w-full max-w-2xl flex flex-col gap-6">

            {messages.length === 1 && (
              <div className="flex flex-col items-center text-center my-8 animate-fade-in select-none">
                <div className="h-16 w-16 rounded-3xl bg-gradient-to-tr from-neutral-900 to-neutral-800 border border-[#222] flex items-center justify-center text-2xl mb-5 shadow-lg shadow-black/40">
                  {getWelcomeIcon(selectedMode)}
                </div>

                {/* Premium Gradient Header */}
                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-neutral-200 to-neutral-400">
                  Hello, {firstName}. How can I help you today?
                </h2>

                <p className="text-neutral-500 text-xs mt-2 max-w-md leading-relaxed">
                  {getWelcomeSubtitle(selectedMode)}
                </p>
              </div>
            )}

            {messages.map((msg) => {
              const codeSnippet = msg.codeSnippet || parseCodeBlocks(msg.text);
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-3xl p-4 text-xs leading-relaxed border transition-all ${msg.sender === "user"
                        ? "bg-neutral-900 border-[#262626] text-white rounded-tr-none"
                        : "bg-[#0e0e0e] border-[#1f1f1f] text-neutral-300 rounded-tl-none"
                      }`}
                  >
                    {renderFormattedText(msg.text)}

                    {codeSnippet && (
                      <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-black border border-[#1f1f1f] overflow-hidden select-none">
                        <div className="flex items-center justify-between px-4 py-2 bg-neutral-900/50 border-b border-[#1f1f1f]">
                          <span className="font-mono text-[10px] text-neutral-400">
                            {codeSnippet.filename}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                applyCodeSnippet(codeSnippet.filename, codeSnippet.code);
                                setShowWorkspace(true);
                              }}
                              className="px-2.5 py-1 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold text-[10px] transition-all cursor-pointer"
                            >
                              Apply & Open IDE
                            </button>
                            <button
                              onClick={() => applyCodeSnippet(codeSnippet.filename, codeSnippet.code)}
                              className="px-2.5 py-1 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-[10px] border border-[#1f1f1f] transition-all cursor-pointer"
                            >
                              Apply Code
                            </button>
                          </div>
                        </div>
                        <pre className="font-mono text-[10px] text-white overflow-x-auto p-4 bg-black/60 leading-relaxed max-h-64 select-text">
                          {codeSnippet.code}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isThinking && (
              <div className="flex gap-2 items-center self-start select-none w-full max-w-sm">
                <div className="bg-[#0e0e0e] border border-[#1f1f1f] rounded-3xl rounded-tl-none p-5 flex flex-col gap-3 w-full shadow-md">
                  <div className="flex items-center gap-2 border-b border-neutral-900 pb-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    <span className="text-[10px] text-white font-bold uppercase tracking-wider">MoE Coordination Pipeline</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {agentSteps.map((step) => {
                      const isCompleted = activeAgentStep > step.id;
                      const isActive = activeAgentStep === step.id;
                      return (
                        <div key={step.id} className="flex items-start gap-2.5 text-[10px]">
                          <span className={`h-4 w-4 rounded-full flex items-center justify-center font-bold flex-shrink-0 transition-all ${isCompleted ? "bg-emerald-950 text-emerald-400 border border-emerald-800" :
                              isActive ? "bg-white text-black border border-white" :
                                "bg-neutral-950 text-neutral-600 border border-neutral-850"
                            }`}>
                            {isCompleted ? "✓" : step.id + 1}
                          </span>
                          <div className="flex flex-col">
                            <span className={`font-semibold transition-colors ${isActive ? "text-white" : "text-neutral-500"}`}>
                              {step.name}
                            </span>
                            {isActive && (
                              <span className="text-[9px] text-neutral-400 animate-pulse mt-0.5">
                                {step.desc}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Suggestion Cards */}
        {messages.length === 1 && !isThinking && (
          <div className="w-full max-w-2xl mx-auto px-6 mb-4 select-none">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {suggestions.map((card, index) => (
                <button
                  key={index}
                  onClick={() => handleSendMessage(card.text)}
                  className="bg-[#0e0e0e] border border-[#1f1f1f] hover:border-neutral-750 hover:bg-neutral-900/60 rounded-2xl p-4 text-left text-xs text-neutral-300 font-medium transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                >
                  <div className="text-[9px] text-neutral-550 font-bold mb-1 uppercase tracking-wider">
                    {card.label}
                  </div>
                  {card.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input box */}
        <div className="p-6 bg-gradient-to-t from-[#060606] via-[#060606] to-transparent flex items-center justify-center flex-shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(chatInput);
            }}
            className="w-full max-w-2xl bg-[#0e0e0e] border border-[#1f1f1f] rounded-2xl p-2 flex items-center focus-within:border-neutral-750 transition-colors"
          >
            <input
              ref={inputRef}
              type="text"
              placeholder={`Send a message to CodexForge (${selectedModel})...`}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={isThinking}
              className="flex-1 bg-transparent border-0 outline-none px-4 py-2 text-xs text-white placeholder-neutral-600 disabled:opacity-50"
              autoFocus
            />
            <button
              type="submit"
              disabled={isThinking || !chatInput.trim()}
              className="p-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black transition-all disabled:opacity-20 active:scale-95 flex items-center justify-center cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      </section>

      {/* IDE WORKSPACE PANEL */}
      {showWorkspace && (
        <section className="absolute md:relative inset-0 md:inset-auto md:right-0 md:h-full w-full md:w-[45%] border-l border-[#1f1f1f] flex flex-col min-w-0 bg-[#060606] z-20 md:z-auto flex-shrink-0 animate-slide-in">

          {/* Padlock status header overlay */}
          {lockedFiles[activeFileName] && (
            <div className="absolute top-14 left-0 right-0 bg-[#120f0a] border-b border-[#291e13] text-amber-500 text-[10px] py-1.5 px-4 z-10 flex items-center justify-between select-none">
              <span className="flex items-center gap-1.5 font-bold">
                🔒 File Locked by {lockedFiles[activeFileName].userName}{lockedFiles[activeFileName].userId === currentUser?.id ? " (You)" : ""}
              </span>
              {lockedFiles[activeFileName].userId !== currentUser?.id && (
                <span className="text-[9px] text-amber-600 font-semibold font-mono">ReadOnly Mode Active</span>
              )}
            </div>
          )}

          <div className="h-14 border-b border-[#1f1f1f] bg-black px-4 flex items-center justify-between flex-shrink-0 select-none">
            {/* Close button for mobile inside IDE workspace header */}
            <button
              onClick={() => setShowWorkspace(false)}
              className="md:hidden p-1.5 rounded-xl border border-[#1f1f1f] hover:bg-neutral-900 text-neutral-450 hover:text-white mr-2"
              title="Close Workspace"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex gap-2 overflow-x-auto py-1 items-center flex-1 pr-2">
              {Object.keys(files).map((name) => (
                <div key={name} className="flex items-center gap-1 bg-neutral-950/40 rounded-xl px-1 border border-neutral-900">
                  <button
                    onClick={() => setActiveFileName(name)}
                    className={`px-2 py-1 text-xs font-semibold border-0 transition-all cursor-pointer rounded-lg ${activeFileName === name
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-500 hover:text-neutral-300"
                      }`}
                  >
                    {name}
                  </button>
                  <button
                    onClick={() => toggleFileLock(name)}
                    className={`p-1 hover:text-white transition-colors cursor-pointer text-[10px] ${lockedFiles[name] ? "text-amber-500" : "text-neutral-600 hover:text-neutral-400"
                      }`}
                    title={lockedFiles[name] ? `Locked by ${lockedFiles[name].userName}. Click to release/acquire.` : `Click to Lock ${name}`}
                  >
                    {lockedFiles[name] ? "🔒" : "🔓"}
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={handleRunCode}
              disabled={isRunning}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${isRunning
                  ? "bg-neutral-950 text-neutral-600 cursor-not-allowed"
                  : "bg-white text-black hover:bg-neutral-200 active:scale-95"
                }`}
            >
              {isRunning ? "Running" : "Run"}
            </button>
          </div>

          <div className="flex-1 relative bg-[#060606]">
            <Editor
              height="100%"
              language={activeFile.language}
              theme="vs-dark"
              value={activeFile.content}
              onChange={handleEditorChange}
              options={{
                fontSize: 12,
                minimap: { enabled: false },
                scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
                cursorBlinking: "smooth",
                padding: { top: 12 },
                lineHeight: 18,
                fontFamily: "var(--font-mono)",
                automaticLayout: true,
                readOnly: !!lockedFiles[activeFileName] && lockedFiles[activeFileName].userId !== currentUser?.id,
              }}
            />
          </div>

          <div className="h-44 border-t border-[#1f1f1f] bg-[#060606] flex flex-col flex-shrink-0">
            <div className="h-8 bg-black border-b border-[#1f1f1f] px-4 flex items-center justify-between select-none">
              <span className="text-[9px] font-semibold text-neutral-500 uppercase tracking-wider">
                Sandbox Console
              </span>
              <button
                onClick={() => setTerminalOutput("Console cleared.")}
                className="text-[9px] text-neutral-500 hover:text-neutral-300 font-semibold cursor-pointer"
              >
                Clear
              </button>
            </div>
            <pre className="flex-grow p-4 font-mono text-[10px] text-neutral-400 overflow-y-auto leading-relaxed whitespace-pre-wrap select-text">
              {terminalOutput}
            </pre>
          </div>
        </section>
      )}

    </div>
  );
}
