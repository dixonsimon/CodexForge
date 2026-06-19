"use client";

import { useState, useEffect } from "react";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  scope: string;
  created: string;
  status: "Active" | "Revoked";
}

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScope, setNewKeyScope] = useState("read:model");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  // Fetch keys from persistent backend on mount
  useEffect(() => {
    const loadApiKeys = async () => {
      try {
        const response = await fetch("/api/v1/keys");
        if (response.ok) {
          const data = await response.json();
          setKeys(data);
        }
      } catch (error) {
        console.error("Failed to fetch API keys from backend:", error);
      }
    };
    loadApiKeys();
  }, []);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    try {
      const response = await fetch("/api/v1/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName, scope: newKeyScope }),
      });

      if (response.ok) {
        const newKeyData = await response.json();
        setKeys((prev) => [newKeyData, ...prev]);
        setGeneratedKey(newKeyData.rawKey);
        setNewKeyName("");
      }
    } catch (error) {
      console.error("Failed to create API key:", error);
    }
  };

  const handleRevokeKey = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/keys/${id}`, {
        method: "DELETE",
      });

      if (response.status === 204) {
        setKeys((prev) =>
          prev.map((k) => (k.id === id ? { ...k, status: "Revoked" } : k))
        );
      }
    } catch (error) {
      console.error("Failed to revoke API key:", error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col gap-10 w-full min-h-screen bg-[#060606] text-white">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-transparent">
            Developer Credentials
          </h1>
          <p className="text-neutral-400 text-xs mt-2.5 font-medium">
            Issue and revoke secure credentials to authenticate external systems with the CodexForge cluster.
          </p>
        </div>
        <div className="text-[10px] text-neutral-400 font-bold font-mono bg-neutral-900 border border-[#1f1f1f] px-3.5 py-2 rounded-2xl">
          ENDPOINT: <span className="text-white">https://api.codexforge.ai/v1</span>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full">
        
        {/* Create Key Card */}
        <div className="bg-[#0c0c0c] border border-[#1f1f1f] p-6 rounded-3xl h-fit">
          <h2 className="text-sm font-bold text-white mb-4">Generate Token</h2>
          
          {generatedKey && (
            <div className="mb-6 p-4 rounded-2xl bg-neutral-950 border border-neutral-800 animate-fade-in">
              <span className="text-[9px] font-bold text-white block mb-2 uppercase tracking-widest text-emerald-400">
                Copy key (shown only once!)
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedKey}
                  className="bg-black border border-[#1f1f1f] rounded-xl px-3 py-2 text-xs font-mono text-white flex-1 focus:outline-none"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedKey);
                  }}
                  className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-slate-300 transition-colors border border-[#1f1f1f]"
                  title="Copy to clipboard"
                >
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => setGeneratedKey(null)}
                className="mt-3 text-[10px] font-bold text-neutral-400 hover:text-white transition-colors"
              >
                Dismiss Key View
              </button>
            </div>
          )}

          <form onSubmit={handleCreateKey} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Token Label</label>
              <input
                type="text"
                placeholder="e.g. CI/CD Pipeline Build"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="bg-black border border-[#1f1f1f] rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-neutral-500 transition-colors"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Scope Level</label>
              <div className="relative">
                <select
                  value={newKeyScope}
                  onChange={(e) => setNewKeyScope(e.target.value)}
                  className="w-full bg-black border border-[#1f1f1f] rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-neutral-500 transition-colors appearance-none cursor-pointer font-semibold"
                >
                  <option value="read:model">read:model (Inference Only)</option>
                  <option value="read:model, write:sandbox">read:model, write:sandbox</option>
                  <option value="admin:all">admin:all (Root Administrator)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-2.5 rounded-2xl bg-white text-black text-xs font-bold hover:bg-neutral-200 transition-all active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.05)]"
            >
              Generate Token
            </button>
          </form>
        </div>

        {/* Keys Table Card */}
        <div className="bg-[#0c0c0c] border border-[#1f1f1f] p-6 rounded-3xl lg:col-span-2 overflow-hidden flex flex-col">
          <h2 className="text-sm font-bold text-white mb-4">Active Credentials</h2>
          
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-[#1f1f1f] text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                  <th className="pb-3 font-semibold">Name</th>
                  <th className="pb-3 font-semibold">Token Prefix</th>
                  <th className="pb-3 font-semibold">Scopes</th>
                  <th className="pb-3 font-semibold">Issued At</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f1f]">
                {keys.map((k) => (
                  <tr key={k.id} className="text-xs text-neutral-300 hover:bg-black/20 transition-colors">
                    <td className="py-4 font-bold text-white">{k.name}</td>
                    <td className="py-4 font-mono text-neutral-400">{k.key}</td>
                    <td className="py-4">
                      <span className="px-2.5 py-0.5 rounded-lg bg-neutral-900 border border-[#1f1f1f] text-neutral-300 text-[9px] font-bold font-mono uppercase tracking-wider">
                        {k.scope}
                      </span>
                    </td>
                    <td className="py-4 text-neutral-400 font-medium">{k.created}</td>
                    <td className="py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          k.status === "Active"
                            ? "bg-neutral-900/50 text-white border-neutral-700"
                            : "bg-black text-neutral-600 border-neutral-900"
                        }`}
                      >
                        <span className={`h-1 w-1 rounded-full ${k.status === "Active" ? "bg-white" : "bg-neutral-600"}`} />
                        {k.status}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      {k.status === "Active" ? (
                        <button
                          onClick={() => handleRevokeKey(k.id)}
                          className="text-xs font-bold text-neutral-400 hover:text-white transition-colors"
                        >
                          Revoke
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-600 cursor-not-allowed font-medium">Revoked</span>
                      )}
                    </td>
                  </tr>
                ))}
                {keys.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-neutral-500 font-semibold text-xs">
                      No active API keys found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
