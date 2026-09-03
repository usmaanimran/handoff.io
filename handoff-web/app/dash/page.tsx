// app/dash/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Core State
  const [activeTab, setActiveTab] = useState<"projects" | "settings">("projects");
  const [copied, setCopied] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false); // New state for the modal command copy

  // Projects State
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [syncSuccess, setSyncSuccess] = useState(false); 

  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Modal State
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // API Key States
  const [partialKey, setPartialKey] = useState<string | null>(null);
  const [rawKeyDisplay, setRawKeyDisplay] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Share State
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Handle clicking outside the notification dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchProjectsAndNotifications = useCallback(async (silent = false) => {
    if (!silent) setIsLoadingProjects(true);
    try {
      // Fetch Projects
      const projRes = await fetch("/api/projects");
      if (projRes.ok) {
        const data = await projRes.json();
        setProjects(data.projects);
      }
      // Fetch Notifications
      const notifRes = await fetch("/api/notifications");
      if (notifRes.ok) {
        const nData = await notifRes.json();
        setNotifications(nData.notifications);
        setUnreadCount(nData.notifications.filter((n: any) => !n.is_read).length);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data");
    } finally {
      if (!silent) setIsLoadingProjects(false);
    }
  }, []);

  // Fetch on mount and focus
  useEffect(() => {
    if (status !== "authenticated" || activeTab !== "projects") return;
    fetchProjectsAndNotifications();
    
    const handleFocus = () => fetchProjectsAndNotifications(true);
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [status, activeTab, fetchProjectsAndNotifications]);

  // Settings tab key fetch
  useEffect(() => {
    if (status === "authenticated" && activeTab === "settings" && !partialKey && !rawKeyDisplay) {
      const fetchKeyStatus = async () => {
        try {
          const res = await fetch("/api/keys");
          if (res.ok) {
            const data = await res.json();
            if (data.partialKey) setPartialKey(data.partialKey);
          }
        } catch (error) {}
      };
      fetchKeyStatus();
    }
  }, [status, activeTab, partialKey, rawKeyDisplay]);

  // Post-Auth Auto-Save Interceptor
  useEffect(() => {
    if (status === "authenticated") {
      const pendingSlug = localStorage.getItem("pending_save_slug");
      if (pendingSlug) {
        fetch("/api/projects/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: pendingSlug })
        }).then(res => {
          if (res.ok) {
            localStorage.removeItem("pending_save_slug");
            setSyncSuccess(true);
            fetchProjectsAndNotifications(true);
            setTimeout(() => setSyncSuccess(false), 2500);
          }
        });
      }
    }
  }, [status, fetchProjectsAndNotifications]);

  const toggleNotifications = async () => {
    setIsNotifOpen(!isNotifOpen);
    if (!isNotifOpen && unreadCount > 0) {
      // Mark as read in DB quietly
      setUnreadCount(0);
      await fetch("/api/notifications", { method: "PATCH" });
    }
  };

  const handleGenerateOrReplaceKey = async (isReplacement: boolean = false) => {
    if (isReplacement) {
      const confirmed = confirm("Are you sure? This will permanently revoke your current key.");
      if (!confirmed) return;
    }
    setIsActionLoading(true);
    try {
      const res = await fetch("/api/keys", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setRawKeyDisplay(data.rawApiKey);
        setPartialKey(data.partialKey);
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = (e: React.MouseEvent, slug: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/p/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleProjectClick = async (project: any) => {
    if (project.status === "processing") return;
    
    // Only the true owner can access the rename modal
    if (project.is_new && project.is_owner) {
      setSelectedProject(project);
      setNewProjectName(project.name);
      setRenameModalOpen(true);
      return;
    }
    
    // Only the true owner can access the client feedback modal
    if ((project.status === "delivered" || project.status === "rejected") && project.is_owner) {
      try {
        const res = await fetch(`/api/projects/${project.id}`);
        if (res.ok) {
          const data = await res.json();
          setSelectedProject(data.project);
          setFeedbackModalOpen(true);
        }
      } catch (e) {
         router.push(`/editor/${project.slug}`);
      }
      return;
    }

    // FIX: Route non-owners directly to the public client portal, NOT the editor!
    if (project.is_owner) {
      router.push(`/editor/${project.slug}`); 
    } else {
      router.push(`/p/${project.slug}`);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRenaming(true);
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedProject.id, name: newProjectName })
      });
      if (res.ok) {
         router.push(`/editor/${selectedProject.slug}`); 
      }
    } finally {
      setIsRenaming(false);
      setRenameModalOpen(false);
    }
  };

  if (status === "loading" || status === "unauthenticated") return <div className="min-h-screen bg-[#0a0a0a]" />;

  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-slate-200 font-sans">
      
      {/* Premium Apple-Style HUD Overlay */}
      {syncSuccess && (
        <div className="pointer-events-none fixed left-1/2 top-16 z-[100] flex h-40 w-40 flex-col items-center justify-center gap-3 rounded-[2.5rem] border border-white/10 bg-[#121212]/80 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl animate-hud-sequence">
          <svg className="h-12 w-12 text-white" viewBox="0 0 52 52" strokeWidth="3" fill="none">
            <circle cx="26" cy="26" r="24" className="animate-draw-circle" stroke="currentColor" strokeLinecap="round" style={{ strokeDasharray: 151, strokeDashoffset: 151 }} />
            <path d="M14.1 27.2l7.1 7.2 16.7-16.8" className="animate-draw-check" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 36, strokeDashoffset: 36 }} />
          </svg>
          <span className="text-[14px] font-medium tracking-wide text-white/90">Project Synced</span>
        </div>
      )}

      {/* RENAME MODAL */}
      {renameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121212] p-6 shadow-2xl animate-fade-up">
            <h3 className="text-lg font-semibold text-white">Name your project</h3>
            <p className="mt-2 text-sm text-slate-400">
              The AI extracted <span className="text-white">"{selectedProject?.name}"</span> from the codebase. You can rename it for the client portal.
            </p>
            <form onSubmit={handleRenameSubmit} className="mt-6">
              <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} className="w-full rounded-lg border border-[#262626] bg-[#1a1a1a] px-4 py-3 text-sm text-white outline-none focus:border-slate-400 transition-colors" autoFocus />
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setRenameModalOpen(false)} className="rounded-lg px-5 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={isRenaming || !newProjectName.trim()} className="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-slate-200 transition-colors disabled:opacity-50">{isRenaming ? "Saving..." : "Save & Open Portal"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FEEDBACK VIEWER MODAL */}
      {feedbackModalOpen && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121212] p-6 shadow-2xl animate-fade-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Client Decision</h3>
              <div className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                selectedProject.status === 'delivered' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {selectedProject.status === 'delivered' ? 'Approved' : 'Revisions Requested'}
              </div>
            </div>
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-white/5 bg-[#1a1a1a]">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Reviewed By</p>
                <p className="text-sm font-medium text-white">{selectedProject.client_name}</p>
                <p className="text-[13px] text-slate-400">{selectedProject.client_company}</p>
              </div>
              <div className="p-4 rounded-xl border border-white/5 bg-[#1a1a1a]">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Feedback Notes</p>
                <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {selectedProject.client_feedback || <span className="text-slate-500 italic">No additional feedback provided.</span>}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-6">
              
              {/* THE NEW REDO COMMAND BUTTON */}
              {selectedProject.status === 'rejected' && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`handoff push --update ${selectedProject.id}`);
                    setCopiedCommand(true);
                    setTimeout(() => setCopiedCommand(false), 2000);
                  }}
                  className="rounded-lg border border-white/10 bg-transparent px-5 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  {copiedCommand ? "Copied!" : "Copy Redo Command"}
                </button>
              )}

              <button type="button" onClick={() => setFeedbackModalOpen(false)} className="rounded-lg px-5 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors">Close</button>
              <button type="button" onClick={() => router.push(`/editor/${selectedProject.slug}`)} className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-slate-200 transition-colors shadow-sm">View Handoff Portal</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-up { animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes hudSequence { 0% { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.8); filter: blur(10px); } 15% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); filter: blur(0); } 85% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); filter: blur(0); } 100% { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.9); filter: blur(5px); } }
        @keyframes drawCircle { 100% { stroke-dashoffset: 0; } }
        @keyframes drawCheck { 100% { stroke-dashoffset: 0; } }
        .animate-hud-sequence { animation: hudSequence 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-draw-circle { animation: drawCircle 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards; }
        .animate-draw-check { animation: drawCheck 0.4s cubic-bezier(0.65, 0, 0.45, 1) 0.4s forwards; }
      `}} />

      <header className="sticky top-0 z-40 w-full border-b border-white/[0.04] bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-black">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              </div>
              <span className="font-semibold tracking-tight text-white">Handoff.io</span>
            </div>
            <nav className="hidden md:flex gap-1 text-sm font-medium">
              <button onClick={() => setActiveTab("projects")} className={`px-3 py-1.5 rounded-md transition-colors ${activeTab === "projects" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}>Projects</button>
              <button onClick={() => setActiveTab("settings")} className={`px-3 py-1.5 rounded-md transition-colors ${activeTab === "settings" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}>Developer API</button>
            </nav>
          </div>
          
          <div className="flex items-center gap-3">
            {/* NOTIFICATION HUB */}
            <div className="relative" ref={notifRef}>
              <button onClick={toggleNotifications} className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#141414] text-slate-400 hover:text-white transition-colors">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-2 border-[#141414]"></span>
                  </span>
                )}
              </button>
              {isNotifOpen && (
                <div className="absolute right-0 mt-3 w-80 rounded-2xl border border-white/10 bg-[#121212]/95 backdrop-blur-xl shadow-2xl p-2 animate-fade-up origin-top-right">
                  <div className="px-3 py-2 border-b border-white/5 mb-2">
                    <h4 className="text-sm font-semibold text-white">Notifications</h4>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-500 px-3 py-4 text-center">No notifications yet.</p>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} onClick={() => router.push(`/editor/${n.project_slug}`)} className="cursor-pointer flex items-start gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors">
                          <div className={`mt-0.5 shrink-0 h-2 w-2 rounded-full ${n.type === 'rejected' ? 'bg-red-400' : 'bg-green-400'}`} />
                          <div>
                            <p className="text-[13px] font-medium text-white mb-0.5 leading-tight">{n.title}</p>
                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{n.message}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
            <button onClick={() => signOut()} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#141414] text-slate-400 hover:text-white active:scale-95 transition-all"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 animate-fade-up">
        
        {/* VIEW 1: PROJECTS */}
        {activeTab === "projects" && (
          <div className="space-y-8">
            <div className="border-b border-white/5 pb-6">
              <h1 className="text-2xl font-semibold tracking-tight text-white">Your Deliverables</h1>
              <p className="mt-1 text-sm text-slate-400">Manage your generated client handoff portals.</p>
            </div>

            {isLoadingProjects ? (
              <div className="flex justify-center py-20"><svg className="h-6 w-6 animate-spin text-slate-500" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg></div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#141414]/50 py-24 text-center px-4">
                <h3 className="text-lg font-medium text-white">No projects found</h3>
                <p className="mt-2 text-sm text-slate-400 max-w-md">Install the CLI and push your first project to see it here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project) => (
                  <div 
                    key={project.id} 
                    onClick={() => handleProjectClick(project)}
                    className={`group relative flex flex-col justify-between rounded-xl border p-5 transition-all duration-300 ${
                      project.status === "processing" 
                        ? "cursor-wait border-white/10 bg-[#0a0a0a]" 
                        : project.status === "rejected"
                        ? "cursor-pointer border-red-500/20 bg-[#121212] hover:border-red-500/40 hover:bg-[#181818]"
                        : project.status === "delivered"
                        ? "cursor-pointer border-green-500/20 bg-[#121212] hover:border-green-500/40 hover:bg-[#181818]"
                        : "cursor-pointer border-white/10 bg-[#121212] hover:border-white/20 hover:bg-[#181818]"
                    }`}
                  >
                    <div className="flex items-start justify-between w-full">
                      <div className="flex items-start gap-4">
                        <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                          project.status === "processing" ? "border-slate-700 bg-[#1a1a1a]" : "border-white/10 bg-[#1a1a1a] text-white"
                        }`}>
                          {project.status === "processing" ? (
                            <svg className="h-4 w-4 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
                          ) : (
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                          )}
                        </div>
                        <div>
                          <h3 className={`font-semibold tracking-tight ${project.status === "processing" ? "text-slate-400" : "text-white"}`}>
                            {project.name}
                          </h3>
                          {project.status === "processing" ? (
                            <p className="mt-1 text-[13px] text-amber-400/80 animate-pulse">Reasoning & synthesizing...</p>
                          ) : (
                            <p className={`mt-1 text-[13px] font-medium ${
                              project.status === "delivered" ? "text-green-400" : 
                              project.status === "rejected" ? "text-red-400" : 
                              "text-slate-500"
                            }`}>
                              {project.is_new ? "Pending Review" : (
                                project.status === "delivered" ? "Signed Off" : 
                                project.status === "rejected" ? "Revisions Req." :
                                project.status === "published" ? "Published" : 
                                "Draft"
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {(project.status === "published" || project.status === "delivered" || project.status === "rejected") && (
                        <button
                          onClick={(e) => handleShare(e, project.slug)}
                          title="Copy Client Link"
                          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#1a1a1a] text-slate-400 hover:text-white hover:border-white/20 hover:bg-white/10 transition-all active:scale-95"
                        >
                          {copiedSlug === project.slug ? (
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: SETTINGS */}
        {activeTab === "settings" && (
          <div className="space-y-8 animate-fade-up">
            <div className="border-b border-white/5 pb-6">
              <h1 className="text-2xl font-semibold tracking-tight text-white">Developer Settings</h1>
              <p className="mt-1 text-sm text-slate-400">Manage your CLI authentication and account preferences.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#121212] p-6 max-w-2xl">
              <h3 className="text-base font-semibold text-white">CLI Authentication</h3>
              <p className="mt-1 text-sm text-slate-400 mb-6">
                Use this API key to authenticate the local CLI tool. Keep it secure.
              </p>
              {!partialKey && !rawKeyDisplay ? (
                <button
                  onClick={() => handleGenerateOrReplaceKey(false)}
                  disabled={isActionLoading}
                  className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  {isActionLoading ? "Generating..." : "Generate API Key"}
                </button>
              ) : (
                <div className="space-y-4">
                  {rawKeyDisplay && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 mb-4">
                      <p className="text-sm text-amber-200 font-medium">
                        Please copy your new API key now. It will not be shown again!
                      </p>
                    </div>
                  )}
                  
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <code className="flex-1 min-w-0 break-all rounded-lg border border-[#262626] bg-[#1a1a1a] px-4 py-3 text-sm text-white font-mono">
                      {rawKeyDisplay ? rawKeyDisplay : partialKey}
                    </code>
                    <button
                      onClick={() => handleCopy(rawKeyDisplay || partialKey || "")}
                      className="flex shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#1a1a1a] px-6 py-3 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-all sm:w-28"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div className="pt-6 mt-2 border-t border-white/5">
                    <button
                      onClick={() => handleGenerateOrReplaceKey(true)}
                      disabled={isActionLoading}
                      className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                    >
                      {isActionLoading ? "Processing..." : "Revoke & Replace API Key"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}