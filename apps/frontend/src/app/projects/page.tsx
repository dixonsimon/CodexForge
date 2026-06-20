"use client";

import { useEffect, useState } from "react";

interface UserProfile {
  id: string;
  name: string | null;
  email: string;
}

interface Member {
  id: string;
  userId: string;
  role: string;
  user: UserProfile;
}

interface Project {
  id: string;
  name: string;
  githubRepoUrl: string;
  defaultBranch: string;
}

interface Organization {
  id: string;
  name: string;
  ownerId: string;
  owner: UserProfile;
  members: Member[];
  projects: Project[];
}

export default function ProjectsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  
  const [newOrgName, setNewOrgName] = useState("");
  const [newProjName, setNewProjName] = useState("");
  const [newProjRepo, setNewProjRepo] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchOrgs = async () => {
    try {
      const res = await fetch("/api/v1/organizations");
      if (res.ok) {
        const data = await res.json();
        setOrgs(data);
        if (data.length > 0 && !selectedOrgId) {
          setSelectedOrgId(data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const showMsg = (text: string, isError = false) => {
    setMessage({ text, isError });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    try {
      const res = await fetch("/api/v1/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrgName }),
      });

      if (res.ok) {
        const newOrg = await res.json();
        setOrgs((prev) => [...prev, newOrg]);
        setSelectedOrgId(newOrg.id);
        setNewOrgName("");
        showMsg(`Organization "${newOrg.name}" created successfully.`);
      } else {
        const data = await res.json();
        showMsg(data.error || "Failed to create organization.", true);
      }
    } catch (err: any) {
      showMsg("Network error occurred.", true);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !newProjName.trim() || !newProjRepo.trim()) return;

    try {
      const res = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProjName,
          githubRepoUrl: newProjRepo,
          orgId: selectedOrgId,
        }),
      });

      if (res.ok) {
        const newProject = await res.json();
        setOrgs((prev) =>
          prev.map((org) => {
            if (org.id === selectedOrgId) {
              return { ...org, projects: [...org.projects, newProject] };
            }
            return org;
          })
        );
        setNewProjName("");
        setNewProjRepo("");
        showMsg(`Project "${newProject.name}" linked successfully.`);
      } else {
        const data = await res.json();
        showMsg(data.error || "Failed to link project.", true);
      }
    } catch (err: any) {
      showMsg("Network error occurred.", true);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !newMemberEmail.trim()) return;

    try {
      const res = await fetch(`/api/v1/organizations/${selectedOrgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newMemberEmail, role: "DEVELOPER" }),
      });

      if (res.ok) {
        const newMember = await res.json();
        setOrgs((prev) =>
          prev.map((org) => {
            if (org.id === selectedOrgId) {
              return { ...org, members: [...org.members, newMember] };
            }
            return org;
          })
        );
        setNewMemberEmail("");
        showMsg(`Member invited successfully.`);
      } else {
        const data = await res.json();
        showMsg(data.error || "Failed to invite member.", true);
      }
    } catch (err: any) {
      showMsg("Network error occurred.", true);
    }
  };

  const activeOrg = orgs.find((o) => o.id === selectedOrgId);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#060606] text-neutral-500 font-semibold text-xs">
        Loading Environments & Teams...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12 flex flex-col gap-10 w-full min-h-screen bg-[#060606] text-white">
      
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-transparent">
          Projects & Teams
        </h1>
        <p className="text-neutral-400 text-xs mt-2.5 font-medium">
          Manage isolated developer organization domains, project connections, and RBAC team memberships.
        </p>
      </div>

      {/* Toast Alert */}
      {message && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold animate-fade-in ${
          message.isError 
            ? "bg-red-950/40 border-red-900 text-red-300" 
            : "bg-emerald-950/40 border-emerald-900 text-emerald-300"
        }`}>
          {message.text}
        </div>
      )}

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full items-start">
        
        {/* 1. Organizations List & Create Column */}
        <div className="flex flex-col gap-6">
          <div className="bg-[#0c0c0c] border border-[#1f1f1f] p-6 rounded-3xl">
            <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Organizations</h2>
            <div className="flex flex-col gap-1.5 mb-6">
              {orgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => setSelectedOrgId(org.id)}
                  className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-semibold transition-all border ${
                    selectedOrgId === org.id
                      ? "bg-white text-black border-white"
                      : "bg-neutral-950 text-neutral-400 border-neutral-900 hover:text-white hover:border-neutral-700"
                  }`}
                >
                  <div className="truncate font-bold">{org.name}</div>
                  <div className={`text-[10px] mt-0.5 truncate ${selectedOrgId === org.id ? "text-neutral-700" : "text-neutral-500"}`}>
                    Owner: {org.owner.email}
                  </div>
                </button>
              ))}
              {orgs.length === 0 && (
                <div className="text-[10px] text-neutral-600 text-center py-4 font-semibold">
                  No organizations found.
                </div>
              )}
            </div>

            <form onSubmit={handleCreateOrg} className="border-t border-[#1f1f1f] pt-4 flex flex-col gap-3">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                Create Organization
              </span>
              <input
                type="text"
                placeholder="Organization Name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                className="w-full bg-[#060606] border border-[#1f1f1f] rounded-2xl px-4 py-2.5 text-xs text-white placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-2xl bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-all active:scale-95"
              >
                Create
              </button>
            </form>
          </div>
        </div>

        {/* 2. Projects Column */}
        <div className="flex flex-col gap-6">
          <div className="bg-[#0c0c0c] border border-[#1f1f1f] p-6 rounded-3xl">
            <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
              Projects {activeOrg ? `(${activeOrg.name})` : ""}
            </h2>
            
            <div className="flex flex-col gap-2 mb-6 max-h-60 overflow-y-auto pr-1">
              {activeOrg?.projects.map((proj) => (
                <div
                  key={proj.id}
                  className="bg-neutral-950 border border-neutral-900 rounded-2xl p-4 flex flex-col gap-1.5"
                >
                  <div className="text-xs font-bold text-white truncate">{proj.name}</div>
                  <div className="text-[10px] text-neutral-400 font-mono truncate">{proj.githubRepoUrl}</div>
                  <div className="text-[9px] text-neutral-500 font-semibold uppercase tracking-wider">
                    Branch: {proj.defaultBranch}
                  </div>
                </div>
              ))}
              {(!activeOrg || activeOrg.projects.length === 0) && (
                <div className="text-[10px] text-neutral-600 text-center py-4 font-semibold">
                  No projects linked.
                </div>
              )}
            </div>

            <form onSubmit={handleCreateProject} className="border-t border-[#1f1f1f] pt-4 flex flex-col gap-3">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                Link GitHub Project
              </span>
              <input
                type="text"
                placeholder="Project Name"
                value={newProjName}
                onChange={(e) => setNewProjName(e.target.value)}
                className="w-full bg-[#060606] border border-[#1f1f1f] rounded-2xl px-4 py-2.5 text-xs text-white placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors"
                disabled={!selectedOrgId}
              />
              <input
                type="text"
                placeholder="GitHub Repo URL"
                value={newProjRepo}
                onChange={(e) => setNewProjRepo(e.target.value)}
                className="w-full bg-[#060606] border border-[#1f1f1f] rounded-2xl px-4 py-2.5 text-xs text-white placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors"
                disabled={!selectedOrgId}
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-2xl bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-all disabled:opacity-50 active:scale-95"
                disabled={!selectedOrgId || !newProjName || !newProjRepo}
              >
                Link Project
              </button>
            </form>
          </div>
        </div>

        {/* 3. Team Management Column */}
        <div className="flex flex-col gap-6">
          <div className="bg-[#0c0c0c] border border-[#1f1f1f] p-6 rounded-3xl">
            <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
              Team Members {activeOrg ? `(${activeOrg.name})` : ""}
            </h2>
            
            <div className="flex flex-col gap-2 mb-6 max-h-60 overflow-y-auto pr-1">
              {activeOrg?.members.map((member) => (
                <div
                  key={member.id}
                  className="bg-neutral-950 border border-neutral-900 rounded-2xl p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate">
                      {member.user.name || "Developer"}
                    </div>
                    <div className="text-[10px] text-neutral-500 truncate">{member.user.email}</div>
                  </div>
                  <span className="text-[9px] font-bold text-neutral-400 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">
                    {member.role}
                  </span>
                </div>
              ))}
              {!activeOrg && (
                <div className="text-[10px] text-neutral-600 text-center py-4 font-semibold">
                  Select an organization.
                </div>
              )}
            </div>

            <form onSubmit={handleInviteMember} className="border-t border-[#1f1f1f] pt-4 flex flex-col gap-3">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                Add Team Member
              </span>
              <input
                type="email"
                placeholder="User Email Address"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                className="w-full bg-[#060606] border border-[#1f1f1f] rounded-2xl px-4 py-2.5 text-xs text-white placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors"
                disabled={!selectedOrgId}
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-2xl bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-all disabled:opacity-50 active:scale-95"
                disabled={!selectedOrgId || !newMemberEmail}
              >
                Add Member
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
