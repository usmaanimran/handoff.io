// app/editor/[slug]/page.tsx
"use client";

import React, { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { generateHtmlReport } from "../../lib/html";

const generateId = () => Math.random().toString(36).substring(2, 9);

const smoothTransition = {
   duration: 0.6,
   ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
};

export default function EditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const resolvedParams = use(params);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // --- View & Mode State ---
  const [isEditing, setIsEditing] = useState(false);
  const [mode, setMode] = useState<"exec" | "dev">("exec");
  const [initialHtml, setInitialHtml] = useState("");
  const [project, setProject] = useState<any>(null);
  const [originalReportData, setOriginalReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  // Modal States
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  // Share State
  const [copiedLink, setCopiedLink] = useState(false);

  const handleShare = () => {
    const url = `${window.location.origin}/p/${project.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const switchMode = (target: "exec" | "dev") => {
    setMode(target);
    iframeRef.current?.contentWindow?.postMessage({ type: "PARENT_TAB_SWITCH", payload: target }, "*");
  };

  // --- Executive State ---
  const [projectName, setProjectName] = useState("");
  const [execTitle, setExecTitle] = useState("");
  const [execSummary, setExecSummary] = useState("");
  const [execImpact, setExecImpact] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [userFlows, setUserFlows] = useState<any[]>([]);

  // --- Developer State ---
  const [devOverview, setDevOverview] = useState("");
  const [mermaidDiagram, setMermaidDiagram] = useState("");
  const [setupInstructions, setSetupInstructions] = useState<string[]>([]);
  const [uiComponents, setUiComponents] = useState<any[]>([]);
  const [coreModules, setCoreModules] = useState<any[]>([]);
  const [httpEndpoints, setHttpEndpoints] = useState<any[]>([]);
  const [envVars, setEnvVars] = useState<any[]>([]);
  const [dbSchema, setDbSchema] = useState<any>({ ormOrEngine: "", summary: "", modelsOrTables: [] });

  const [dragState, setDragState] = useState<any>(null);
  const [isReordering, setIsReordering] = useState(false);
  
  const [setupDragState, setSetupDragState] = useState<any>(null);
  const [isSetupReordering, setIsSetupReordering] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated") fetchProject();
  }, [status]);

  const populateEditorState = (reportData: any) => {
    const execData = reportData?.executiveView || {};
    setExecTitle(execData.title || "");
    setExecSummary(execData.summary || "");
    setExecImpact(execData.businessValue || "");
    setFeatures(execData.featuresDelivered || []);
    
    const parsedFlows = (execData.userFlows || []).map((flow: any) => ({
      ...flow,
      steps: (flow.steps || []).map((step: any) => ({ ...step, _id: step._id || generateId() }))
    }));
    setUserFlows(parsedFlows);
    
    const devData = reportData?.developerRunbook || {};
    setDevOverview(devData.architectureOverview || "");
    setMermaidDiagram(devData.mermaidDiagram || "");
    setSetupInstructions(devData.setupInstructions || []);
    setUiComponents(devData.uiComponents || []);
    setCoreModules(devData.coreModules || []);
    setHttpEndpoints(devData.httpEndpoints || []);
    setEnvVars(devData.environmentVariables || []);
    setDbSchema(devData.databaseSchema || { ormOrEngine: "", summary: "", modelsOrTables: [] });
  };

  const fetchProject = async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      const currentProj = data.projects.find((p: any) => p.slug === resolvedParams.slug);
      
      if (currentProj) {
        // FIX: If a non-owner somehow lands on the editor URL, instantly redirect them to the client portal
        if (!currentProj.is_owner) {
          router.push(`/p/${currentProj.slug}`);
          return;
        }

        const detailRes = await fetch(`/api/projects/${currentProj.id}`);
        const detailData = await detailRes.json();
        const fullProject = detailData.project;
        
        setProject(fullProject);
        setProjectName(fullProject.name || "");
        setOriginalReportData(fullProject.report_data);
        populateEditorState(fullProject.report_data);
        
        const authorName = fullProject.users?.name || "Developer";
        setInitialHtml(generateHtmlReport(fullProject.report_data, fullProject.slug, true, authorName, true, fullProject.status, true));
      }
    } catch (error) {
      console.error("Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!iframeRef.current || !initialHtml) return;
    const timer = setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage({
        type: 'LIVE_UPDATE',
        payload: {
          title: execTitle, summary: execSummary, impact: execImpact, features: features,
          flows: userFlows, devOverview: devOverview, mermaid: mermaidDiagram,
          setupInstructions: setupInstructions, uiComponents: uiComponents,
          coreModules: coreModules, httpEndpoints: httpEndpoints,
          envVars: envVars, dbSchema: dbSchema
        }
      }, '*');
    }, 60);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execTitle, execSummary, execImpact, features, userFlows, devOverview, mermaidDiagram, setupInstructions, uiComponents, coreModules, httpEndpoints, envVars, dbSchema, initialHtml]);

  useEffect(() => {
    const handleIframeMessage = (e: MessageEvent) => {
      if (e.data?.type === 'IFRAME_TAB_SWITCH') switchMode(e.data.payload === 'dev' ? 'dev' : 'exec');
    };
    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, [mode]);

  // --- Base Array Mutations ---
  const addFlow = () => setUserFlows([...userFlows, { flowName: "New Interaction Flow", steps: [{ stepNumber: 1, action: "", _id: generateId() }] }]);
  const removeFlow = (index: number) => setUserFlows(userFlows.filter((_, i) => i !== index));
  const updateFlowName = (index: number, val: string) => { const newFlows = [...userFlows]; newFlows[index] = { ...newFlows[index], flowName: val }; setUserFlows(newFlows); };

  const addStep = (flowIdx: number) => { const newFlows = [...userFlows]; newFlows[flowIdx] = { ...newFlows[flowIdx] }; newFlows[flowIdx].steps = [...newFlows[flowIdx].steps, { stepNumber: newFlows[flowIdx].steps.length + 1, action: "", _id: generateId() }]; setUserFlows(newFlows); };
  const removeStep = (flowIdx: number, stepIdx: number) => { const newFlows = [...userFlows]; const filteredSteps = newFlows[flowIdx].steps.filter((_: any, i: number) => i !== stepIdx); newFlows[flowIdx] = { ...newFlows[flowIdx], steps: filteredSteps.map((s: any, idx: number) => ({ ...s, stepNumber: idx + 1 })) }; setUserFlows(newFlows); };
  const updateStepAction = (flowIdx: number, stepIdx: number, val: string) => { const newFlows = [...userFlows]; const newSteps = [...newFlows[flowIdx].steps]; newSteps[stepIdx] = { ...newSteps[stepIdx], action: val }; newFlows[flowIdx] = { ...newFlows[flowIdx], steps: newSteps }; setUserFlows(newFlows); };

  // --- Exec Flow Drag Logic ---
  const handlePointerDown = (e: React.PointerEvent, fIdx: number, sIdx: number) => {
    if (e.button !== 0) return; e.preventDefault();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const gripEl = e.currentTarget as HTMLElement;
    const stepEl = gripEl.closest('.step-row') as HTMLElement;
    const containerEl = stepEl.closest('.steps-container') as HTMLElement;
    const stepNodes = Array.from(containerEl.querySelectorAll('.step-row')) as HTMLElement[];
    const itemRects = stepNodes.map(node => ({ top: node.offsetTop, height: node.offsetHeight }));
    setDragState({ flowIdx: fIdx, originIdx: sIdx, currentIdx: sIdx, startY: e.pageY, initialTop: itemRects[sIdx].top, containerHeight: containerEl.offsetHeight, itemRects, offset: 0 });
  };

  useEffect(() => {
    if (!dragState) return;
    document.body.style.userSelect = 'none'; document.body.style.cursor = 'grabbing';
    
    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      const rawOffset = e.pageY - dragState.startY;
      const maxOffset = dragState.containerHeight - dragState.initialTop - dragState.itemRects[dragState.originIdx].height;
      const boundedOffset = Math.max(-dragState.initialTop, Math.min(maxOffset, rawOffset));
      
      const draggedTop = dragState.initialTop + boundedOffset;
      const draggedBottom = draggedTop + dragState.itemRects[dragState.originIdx].height;
      
      let newIdx = dragState.originIdx;
      for (let i = 0; i < dragState.itemRects.length; i++) {
        if (i === dragState.originIdx) continue;
        const rect = dragState.itemRects[i];
        const itemMiddle = rect.top + (rect.height / 2);
        
        if (dragState.originIdx < i && draggedBottom > itemMiddle) newIdx = i;
        else if (dragState.originIdx > i && draggedTop < itemMiddle) { newIdx = i; break; }
      }
      
      setDragState((prev: any) => prev ? { ...prev, offset: boundedOffset, currentIdx: Math.max(0, Math.min(newIdx, dragState.itemRects.length - 1)) } : null);
    };

    const handlePointerUp = () => {
      document.body.style.userSelect = ''; document.body.style.cursor = '';
      if (dragState && dragState.originIdx !== dragState.currentIdx) {
        setIsReordering(true);
        setUserFlows(currentFlows => {
          const newFlows = [...currentFlows]; const steps = [...newFlows[dragState.flowIdx].steps];
          const [moved] = steps.splice(dragState.originIdx, 1); steps.splice(dragState.currentIdx, 0, moved);
          newFlows[dragState.flowIdx] = { ...newFlows[dragState.flowIdx], steps: steps.map((s, idx) => ({ ...s, stepNumber: idx + 1 })) }; return newFlows;
        });
        setTimeout(() => setIsReordering(false), 30);
      }
      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp); window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp); window.removeEventListener('pointercancel', handlePointerUp);
      document.body.style.userSelect = ''; document.body.style.cursor = '';
    };
  }, [dragState]);

  // --- Setup Instructions Drag Logic ---
  const handleSetupPointerDown = (e: React.PointerEvent, idx: number) => {
    if (e.button !== 0) return; e.preventDefault();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const gripEl = e.currentTarget as HTMLElement;
    const stepEl = gripEl.closest('.setup-step-row') as HTMLElement;
    const containerEl = stepEl.closest('.setup-steps-container') as HTMLElement;
    const stepNodes = Array.from(containerEl.querySelectorAll('.setup-step-row')) as HTMLElement[];
    const itemRects = stepNodes.map(node => ({ top: node.offsetTop, height: node.offsetHeight }));
    setSetupDragState({ originIdx: idx, currentIdx: idx, startY: e.pageY, initialTop: itemRects[idx].top, containerHeight: containerEl.offsetHeight, itemRects, offset: 0 });
  };

  useEffect(() => {
    if (!setupDragState) return;
    document.body.style.userSelect = 'none'; document.body.style.cursor = 'grabbing';
    
    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      const rawOffset = e.pageY - setupDragState.startY;
      const maxOffset = setupDragState.containerHeight - setupDragState.initialTop - setupDragState.itemRects[setupDragState.originIdx].height;
      const boundedOffset = Math.max(-setupDragState.initialTop, Math.min(maxOffset, rawOffset));
      
      const draggedTop = setupDragState.initialTop + boundedOffset;
      const draggedBottom = draggedTop + setupDragState.itemRects[setupDragState.originIdx].height;
      
      let newIdx = setupDragState.originIdx;
      for (let i = 0; i < setupDragState.itemRects.length; i++) {
        if (i === setupDragState.originIdx) continue;
        const rect = setupDragState.itemRects[i];
        const itemMiddle = rect.top + (rect.height / 2);
        
        if (setupDragState.originIdx < i && draggedBottom > itemMiddle) newIdx = i;
        else if (setupDragState.originIdx > i && draggedTop < itemMiddle) { newIdx = i; break; }
      }
      
      setSetupDragState((prev: any) => prev ? { ...prev, offset: boundedOffset, currentIdx: Math.max(0, Math.min(newIdx, setupDragState.itemRects.length - 1)) } : null);
    };

    const handlePointerUp = () => {
      document.body.style.userSelect = ''; document.body.style.cursor = '';
      if (setupDragState && setupDragState.originIdx !== setupDragState.currentIdx) {
        setIsSetupReordering(true);
        setSetupInstructions(current => {
          const arr = [...current]; const [moved] = arr.splice(setupDragState.originIdx, 1); arr.splice(setupDragState.currentIdx, 0, moved); return arr;
        });
        setTimeout(() => setIsSetupReordering(false), 30);
      }
      setSetupDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp); window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp); window.removeEventListener('pointercancel', handlePointerUp);
      document.body.style.userSelect = ''; document.body.style.cursor = '';
    };
  }, [setupDragState]);

  const handleCancelEdit = () => {
    populateEditorState(originalReportData); 
    setIsEditing(false); 
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("");

    const updatedReport = { ...project.report_data };
    updatedReport.executiveView = {
      ...updatedReport.executiveView,
      title: execTitle, summary: execSummary, businessValue: execImpact,
      featuresDelivered: features.filter(f => f.trim() !== ""), userFlows: userFlows
    };
    updatedReport.developerRunbook = {
      ...updatedReport.developerRunbook,
      architectureOverview: devOverview, mermaidDiagram: mermaidDiagram,
      setupInstructions: setupInstructions.filter(s => s.trim() !== ""),
      uiComponents: uiComponents, coreModules: coreModules,
      httpEndpoints: httpEndpoints, environmentVariables: envVars, databaseSchema: dbSchema
    };
    
    try {
      const res = await fetch("/api/projects/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, projectName: projectName, updatedReportData: updatedReport })
      });

      if (res.ok) {
        setSaveStatus("Saved successfully");
        setOriginalReportData(updatedReport); 
        setTimeout(() => { setSaveStatus(""); setIsEditing(false); }, 800);
      } else {
        setSaveStatus("Error saving draft");
      }
    } catch (err) {
      setSaveStatus("Network error");
    } finally {
      setSaving(false);
    }
  };

  // --- Publish Action ---
  const confirmPublish = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/projects/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          projectId: project.id, 
          projectName: projectName, 
          updatedReportData: originalReportData, 
          is_new: false,
          status: 'published'
        })
      });
      if (res.ok) {
        setProject({ ...project, is_new: false, status: 'published' });
        setPublishModalOpen(false);
      } else {
        alert("Error publishing report.");
      }
    } catch (err) {
      alert("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const renderModeSwitch = (isEditContext: boolean) => (
    <motion.div 
      layoutId="mode-switch-master"
      transition={smoothTransition}
      style={{ borderRadius: 9999 }}
      className={`relative flex gap-1 p-1 rounded-full shrink-0 whitespace-nowrap overflow-hidden bg-[#141414] ${
        isEditContext 
          ? 'border border-[#262626]' 
          : 'border border-white/10 shadow-2xl backdrop-blur-md bg-[#141414]/90'
      }`}
    >
      <button
        onClick={() => switchMode("exec")}
        className="relative z-10 px-5 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap"
        style={{ color: mode === "exec" ? "#0a0a0a" : "#94a3b8" }}
      >
        {mode === "exec" && (
          <motion.div layoutId="tab-highlight" className="absolute inset-0 -z-10 rounded-full bg-slate-200" transition={smoothTransition} />
        )}
        <span className="relative">Executive Briefing</span>
      </button>
      <button
        onClick={() => switchMode("dev")}
        className="relative z-10 px-5 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap"
        style={{ color: mode === "dev" ? "#0a0a0a" : "#94a3b8" }}
      >
        {mode === "dev" && (
          <motion.div layoutId="tab-highlight" className="absolute inset-0 -z-10 rounded-full bg-slate-200" transition={smoothTransition} />
        )}
        <span className="relative">Developer Runbook</span>
      </button>
    </motion.div>
  );

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">Loading Portal...</div>;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0a0a0a] text-slate-200 font-sans">
       
      <AnimatePresence>
        {publishModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000000]/60 backdrop-blur-xl p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.95, y: 10, filter: "blur(4px)" }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-[420px] overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#0A0A0A] shadow-[0_0_80px_rgba(0,0,0,0.8)] relative"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
              
              <div className="p-8">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                </div>
                
                <h3 className="text-xl font-semibold tracking-tight text-white">Publish Handoff</h3>
                <p className="mt-3 text-[14px] leading-relaxed text-slate-400">
                  This will finalize the documentation and generate the permanent client portal. Once published, the architecture and execution sequence <span className="text-white font-medium">cannot be modified</span>.
                </p>
              </div>
              
              <div className="bg-[#121212] border-t border-white/[0.04] px-8 py-5 flex items-center justify-end gap-3">
                <button
                  onClick={() => setPublishModalOpen(false)}
                  disabled={saving}
                  className="rounded-full px-5 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmPublish}
                  disabled={saving}
                  className="relative overflow-hidden rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] transition-all active:scale-95 disabled:opacity-50"
                >
                  <span className="relative z-10">{saving ? "Publishing..." : "Confirm & Publish"}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={false}
        animate={{ width: isEditing ? "50%" : "0%" }}
        transition={smoothTransition}
        className="shrink-0 h-full border-r border-white/10 bg-[#0a0a0a] z-20 shadow-[4px_0_24px_rgba(0,0,0,0.5)] overflow-hidden"
      >
        <div className="w-[50vw] h-full flex flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-[#0a0a0a] px-6 z-20">
            <div className="flex items-center gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-white/10 text-white">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
              </div>
              <span className="text-sm font-semibold text-white truncate max-w-[200px]">Editing Mode</span>
            </div>
            <div className="flex items-center gap-3">
              {saveStatus && <span className={`text-xs ${saveStatus.includes("Error") ? "text-red-400" : "text-green-400"}`}>{saveStatus}</span>}
              <button 
                onClick={handleCancelEdit} 
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave} 
                disabled={saving}
                className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-black hover:bg-slate-200 transition-colors disabled:opacity-50 shadow-[0_0_12px_rgba(255,255,255,0.2)]"
              >
                {saving ? "Saving..." : "Save Report"}
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-8 py-10 scroll-smooth">
            <div className="flex justify-center mb-8 min-h-[44px]">
              {isEditing && renderModeSwitch(true)}
            </div>

            <AnimatePresence mode="wait">
            <motion.div key={mode} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18, ease: "easeOut" }} className="space-y-8 pb-32">
              
              {/* ================= EXECUTIVE SECTION ================= */}
              {mode === "exec" && (
              <>
              <div id="exec-section" className="scroll-mt-10">
                <h1 className="text-2xl font-semibold tracking-tight text-white mb-2">Executive Briefing</h1>
              </div>
              
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Project Name (Dashboard Reference)</label>
                <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} className="w-full rounded-lg border border-[#262626] bg-[#141414] px-4 py-3 text-sm text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a] transition-colors" />
              </div>
              
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Document Title</label>
                <input type="text" value={execTitle} onChange={(e) => setExecTitle(e.target.value)} className="w-full rounded-lg border border-[#262626] bg-[#141414] px-4 py-3 text-sm text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a] transition-colors" />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Project Summary</label>
                <textarea value={execSummary} onChange={(e) => setExecSummary(e.target.value)} rows={4} className="w-full rounded-lg border border-[#262626] bg-[#141414] px-4 py-3 text-sm text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a] transition-colors resize-none" />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Business Impact</label>
                <textarea value={execImpact} onChange={(e) => setExecImpact(e.target.value)} rows={3} className="w-full rounded-lg border border-[#262626] bg-[#141414] px-4 py-3 text-sm text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a] transition-colors resize-none" />
              </div>

              <div className="space-y-4 pt-6 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Capability Manifest</label>
                  <button onClick={() => setFeatures([...features, ""])} className="text-xs font-medium text-slate-400 hover:text-white transition-colors">+ Add Feature</button>
                </div>
                
                <div className="space-y-3">
                  {features.map((feature, index) => (
                    <div key={index} className="flex gap-2">
                      <input type="text" value={feature} onChange={(e) => { const f = [...features]; f[index] = e.target.value; setFeatures(f); }} className="flex-1 rounded-lg border border-[#262626] bg-[#141414] px-4 py-2.5 text-sm text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a] transition-colors" />
                      <button onClick={() => setFeatures(features.filter((_, i) => i !== index))} className="flex shrink-0 w-10 items-center justify-center rounded-lg border border-[#262626] bg-[#141414] text-slate-500 hover:text-red-400 hover:border-red-900/50 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Execution Sequence</label>
                  <button onClick={addFlow} className="text-xs font-medium text-slate-400 hover:text-white transition-colors">+ Add Flow</button>
                </div>

                <div className="space-y-6">
                  {userFlows.map((flow, fIdx) => (
                    <div key={fIdx} className="rounded-xl border border-white/10 bg-[#121212] p-5 relative">
                      {fIdx > 0 && (
                        <button onClick={() => removeFlow(fIdx)} title="Delete Sequence" className="absolute top-4 right-4 text-red-500/60 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-md transition-all active:scale-95">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                      
                      <div className="mb-6 pr-10">
                        <label className="text-[10px] font-medium uppercase text-slate-500 block mb-1">Flow Name</label>
                        <input type="text" value={flow.flowName} onChange={(e) => updateFlowName(fIdx, e.target.value)} className="w-full border-b border-[#262626] bg-transparent pb-1 text-sm font-medium text-white outline-none focus:border-slate-400 transition-colors" />
                      </div>

                      <div className="flex flex-col gap-2 steps-container relative">
                        {flow.steps?.map((step: any, sIdx: number) => {
                          const isDragging = dragState?.flowIdx === fIdx && dragState?.originIdx === sIdx;
                          let translateY = 0, zIndex = 1, scale = 1, boxShadow = 'none', bgColor = 'transparent';
                          
                          if (dragState && dragState.flowIdx === fIdx) {
                            if (isDragging) { translateY = dragState.offset; zIndex = 50; scale = 1.02; boxShadow = '0 16px 32px -12px rgba(0,0,0,0.6)'; bgColor = '#1a1a1a'; } 
                            else { const origin = dragState.originIdx; const curr = dragState.currentIdx; const shiftAmount = dragState.itemRects[origin].height + 8; if (origin < sIdx && sIdx <= curr) translateY = -shiftAmount; else if (curr <= sIdx && sIdx < origin) translateY = shiftAmount; }
                          }

                          const shouldTransition = !isDragging && !isReordering;

                          return (
                            <div key={step._id || sIdx} className="step-row group relative flex items-start gap-3 p-2 -mx-2 rounded-lg" style={{ transform: `translateY(${translateY}px) scale(${scale})`, zIndex, boxShadow, backgroundColor: bgColor, transition: shouldTransition ? 'transform 0.25s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s, background-color 0.2s' : 'none' }}>
                              <div className="mt-2 text-slate-600 hover:text-slate-400 transition-colors cursor-grab active:cursor-grabbing touch-none p-1" onPointerDown={(e) => handlePointerDown(e, fIdx, sIdx)}>
                                <svg className="w-4 h-4 pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" /></svg>
                              </div>
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] border border-[#262626] text-xs font-semibold text-slate-400 mt-0.5">{step.stepNumber}</div>
                              <textarea value={step.action} onChange={(e) => updateStepAction(fIdx, sIdx, e.target.value)} rows={2} className="flex-1 rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-slate-400 transition-colors resize-none" />
                              <button onClick={() => removeStep(fIdx, sIdx)} className="mt-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1" title="Delete Step"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                            </div>
                          );
                        })}
                        <button onClick={() => addStep(fIdx)} className="text-[11px] font-medium text-slate-500 hover:text-white transition-colors ml-10 mt-2 block w-fit">+ Add Step</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              </>
              )}

              {/* ================= DEVELOPER SECTION ================= */}
              {mode === "dev" && (
              <>
              <div id="dev-section" className="scroll-mt-10 pt-8">
                <hr className="border-white/10 !mb-16" />
                <h1 className="text-2xl font-semibold tracking-tight text-white mb-2">Developer Runbook</h1>
              </div>
              
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Architecture Overview</label>
                <textarea value={devOverview} onChange={(e) => setDevOverview(e.target.value)} rows={6} className="w-full rounded-lg border border-[#262626] bg-[#141414] px-4 py-3 text-sm text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a] transition-colors resize-none" />
              </div>

              <div className="space-y-2 pt-4">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">System Topology (Mermaid.js)</label>
                <textarea value={mermaidDiagram} onChange={(e) => setMermaidDiagram(e.target.value)} rows={8} className="w-full font-mono rounded-lg border border-[#262626] bg-[#141414] px-4 py-3 text-sm text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a] transition-colors resize-none" />
              </div>

              <div className="space-y-4 pt-6 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Frontend Components</label>
                  <button onClick={() => setUiComponents([...uiComponents, { name: "", purpose: "", sourceFile: "" }])} className="text-xs font-medium text-slate-400 hover:text-white transition-colors">+ Add UI</button>
                </div>
                <div className="space-y-3">
                  {uiComponents.map((ui, idx) => (
                    <div key={idx} className="flex flex-col gap-2 p-4 rounded-xl border border-[#262626] bg-[#121212]">
                      <div className="flex gap-2">
                        <input type="text" placeholder="Component Name" value={ui.name} onChange={(e) => { const arr = [...uiComponents]; arr[idx].name = e.target.value; setUiComponents(arr); }} className="w-1/2 font-semibold rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a]" />
                        <input type="text" placeholder="Source File" value={ui.sourceFile} onChange={(e) => { const arr = [...uiComponents]; arr[idx].sourceFile = e.target.value; setUiComponents(arr); }} className="flex-1 text-xs font-mono rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a]" />
                        <button onClick={() => setUiComponents(uiComponents.filter((_, i) => i !== idx))} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-[#262626] bg-[#141414] text-slate-500 hover:text-red-400 hover:border-red-900/50"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                      </div>
                      <input type="text" placeholder="Purpose" value={ui.purpose} onChange={(e) => { const arr = [...uiComponents]; arr[idx].purpose = e.target.value; setUiComponents(arr); }} className="w-full rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a]" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Core Engines & Modules</label>
                  <button onClick={() => setCoreModules([...coreModules, { moduleName: "", purpose: "", sourceFile: "", exportedSymbols: [] }])} className="text-xs font-medium text-slate-400 hover:text-white transition-colors">+ Add Module</button>
                </div>
                <div className="space-y-3">
                  {coreModules.map((mod, idx) => (
                    <div key={idx} className="flex flex-col gap-2 p-4 rounded-xl border border-[#262626] bg-[#121212]">
                      <div className="flex gap-2">
                        <input type="text" placeholder="Module Name" value={mod.moduleName} onChange={(e) => { const arr = [...coreModules]; arr[idx].moduleName = e.target.value; setCoreModules(arr); }} className="w-1/2 font-semibold rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a]" />
                        <input type="text" placeholder="Source File" value={mod.sourceFile} onChange={(e) => { const arr = [...coreModules]; arr[idx].sourceFile = e.target.value; setCoreModules(arr); }} className="flex-1 text-xs font-mono rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a]" />
                        <button onClick={() => setCoreModules(coreModules.filter((_, i) => i !== idx))} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-[#262626] bg-[#141414] text-slate-500 hover:text-red-400 hover:border-red-900/50"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                      </div>
                      <textarea placeholder="Purpose" value={mod.purpose} rows={2} onChange={(e) => { const arr = [...coreModules]; arr[idx].purpose = e.target.value; setCoreModules(arr); }} className="w-full rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a] resize-none" />
                      <input type="text" placeholder="Exported Symbols (comma separated)" value={(mod.exportedSymbols || []).join(", ")} onChange={(e) => { const arr = [...coreModules]; arr[idx].exportedSymbols = e.target.value.split(",").map(s => s.trim()); setCoreModules(arr); }} className="w-full text-xs font-mono rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a]" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">API & Routing</label>
                  <button onClick={() => setHttpEndpoints([...httpEndpoints, { method: "GET", path: "", description: "", sourceFile: "" }])} className="text-xs font-medium text-slate-400 hover:text-white transition-colors">+ Add Route</button>
                </div>
                <div className="space-y-3">
                  {httpEndpoints.map((ep, idx) => (
                    <div key={idx} className="flex flex-col gap-2 p-4 rounded-xl border border-[#262626] bg-[#121212]">
                      <div className="flex items-center gap-2">
                        <select value={ep.method} onChange={(e) => { const arr = [...httpEndpoints]; arr[idx].method = e.target.value; setHttpEndpoints(arr); }} className="rounded-lg border border-[#262626] bg-[#1a1a1a] px-3 py-2 text-xs font-bold text-white outline-none focus:border-slate-400">
                          {["GET", "POST", "PUT", "DELETE", "PATCH"].map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <input type="text" placeholder="/api/route" value={ep.path} onChange={(e) => { const arr = [...httpEndpoints]; arr[idx].path = e.target.value; setHttpEndpoints(arr); }} className="flex-1 font-mono rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a]" />
                        <button onClick={() => setHttpEndpoints(httpEndpoints.filter((_, i) => i !== idx))} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-[#262626] bg-[#141414] text-slate-500 hover:text-red-400 hover:border-red-900/50"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                      </div>
                      <div className="flex gap-2">
                        <input type="text" placeholder="Route description" value={ep.description} onChange={(e) => { const arr = [...httpEndpoints]; arr[idx].description = e.target.value; setHttpEndpoints(arr); }} className="flex-1 rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a]" />
                        <input type="text" placeholder="Source File" value={ep.sourceFile} onChange={(e) => { const arr = [...httpEndpoints]; arr[idx].sourceFile = e.target.value; setHttpEndpoints(arr); }} className="w-1/3 text-xs font-mono rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Environment Variables</label>
                  <button onClick={() => setEnvVars([...envVars, { name: "", purpose: "", required: true }])} className="text-xs font-medium text-slate-400 hover:text-white transition-colors">+ Add Variable</button>
                </div>
                <div className="space-y-3">
                  {envVars.map((env, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input type="text" placeholder="KEY_NAME" value={env.name} onChange={(e) => { const arr = [...envVars]; arr[idx].name = e.target.value; setEnvVars(arr); }} className="w-1/3 font-mono rounded-lg border border-[#262626] bg-[#141414] px-4 py-2.5 text-sm text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a]" />
                      <input type="text" placeholder="Purpose" value={env.purpose} onChange={(e) => { const arr = [...envVars]; arr[idx].purpose = e.target.value; setEnvVars(arr); }} className="flex-1 rounded-lg border border-[#262626] bg-[#141414] px-4 py-2.5 text-sm text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a]" />
                      <button onClick={() => { const arr = [...envVars]; arr[idx].required = !arr[idx].required; setEnvVars(arr); }} className={`shrink-0 w-[80px] text-[11px] font-semibold uppercase rounded-lg border ${env.required ? 'border-red-500/30 text-red-400 bg-[#1a1a1a]' : 'border-[#262626] text-slate-500 bg-[#141414]'}`}>{env.required ? "Required" : "Optional"}</button>
                      <button onClick={() => setEnvVars(envVars.filter((_, i) => i !== idx))} className="flex shrink-0 w-10 items-center justify-center rounded-lg border border-[#262626] bg-[#141414] text-slate-500 hover:text-red-400 hover:border-red-900/50"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-white/10">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-2">Database Schema</label>
                <div className="p-5 rounded-xl border border-[#262626] bg-[#121212] space-y-4">
                  <div className="flex gap-2">
                    <input type="text" placeholder="ORM or Engine (e.g. Prisma)" value={dbSchema.ormOrEngine} onChange={(e) => setDbSchema({ ...dbSchema, ormOrEngine: e.target.value })} className="w-1/3 font-semibold rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a]" />
                    <input type="text" placeholder="Architectural Summary" value={dbSchema.summary} onChange={(e) => setDbSchema({ ...dbSchema, summary: e.target.value })} className="flex-1 rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a]" />
                  </div>
                  
                  <div className="pt-2 border-t border-[#262626]">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[11px] uppercase tracking-wide text-slate-500">Models / Tables</span>
                      <button onClick={() => setDbSchema({ ...dbSchema, modelsOrTables: [...(dbSchema.modelsOrTables || []), { name: "", description: "" }] })} className="text-xs font-medium text-slate-400 hover:text-white">+ Add Table</button>
                    </div>
                    <div className="space-y-2">
                      {(dbSchema.modelsOrTables || []).map((t: any, idx: number) => (
                        <div key={idx} className="flex gap-2 items-start">
                          <input type="text" placeholder="TableName" value={t.name} onChange={(e) => { const m = [...dbSchema.modelsOrTables]; m[idx].name = e.target.value; setDbSchema({...dbSchema, modelsOrTables: m}); }} className="w-1/3 font-mono rounded-lg border border-[#262626] bg-[#1a1a1a] px-3 py-2 text-sm text-white outline-none focus:border-slate-400" />
                          <textarea placeholder="Fields and relations mapped" rows={2} value={t.description} onChange={(e) => { const m = [...dbSchema.modelsOrTables]; m[idx].description = e.target.value; setDbSchema({...dbSchema, modelsOrTables: m}); }} className="flex-1 rounded-lg border border-[#262626] bg-[#1a1a1a] px-3 py-2 text-sm text-white outline-none focus:border-slate-400 resize-none" />
                          <button onClick={() => { const m = [...dbSchema.modelsOrTables]; m.splice(idx, 1); setDbSchema({...dbSchema, modelsOrTables: m}); }} className="shrink-0 w-8 h-8 mt-1 flex items-center justify-center rounded-lg border border-[#262626] bg-[#141414] text-slate-500 hover:text-red-400 hover:border-red-900/50"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Initialization Commands</label>
                  <button onClick={() => setSetupInstructions([...setupInstructions, ""])} className="text-xs font-medium text-slate-400 hover:text-white transition-colors">+ Add Step</button>
                </div>
                
                <div className="flex flex-col gap-2 setup-steps-container relative">
                  {setupInstructions.map((step, index) => {
                    const isDragging = setupDragState?.originIdx === index;
                    let translateY = 0, zIndex = 1, scale = 1, boxShadow = 'none', bgColor = 'transparent';
                    
                    if (setupDragState) {
                      if (isDragging) { translateY = setupDragState.offset; zIndex = 50; scale = 1.02; boxShadow = '0 16px 32px -12px rgba(0,0,0,0.6)'; bgColor = '#1a1a1a'; } 
                      else { const origin = setupDragState.originIdx; const curr = setupDragState.currentIdx; const shiftAmount = setupDragState.itemRects[origin].height + 8; if (origin < index && index <= curr) translateY = -shiftAmount; else if (curr <= index && index < origin) translateY = shiftAmount; }
                    }

                    return (
                      <div key={index} className="setup-step-row group relative flex items-start gap-2 p-2 -mx-2 rounded-lg" style={{ transform: `translateY(${translateY}px) scale(${scale})`, zIndex, boxShadow, backgroundColor: bgColor, transition: (!isDragging && !isSetupReordering) ? 'transform 0.25s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s, background-color 0.2s' : 'none' }}>
                        <div className="mt-2.5 text-slate-600 hover:text-slate-400 transition-colors cursor-grab active:cursor-grabbing touch-none p-1" onPointerDown={(e) => handleSetupPointerDown(e, index)}>
                          <svg className="w-4 h-4 pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" /></svg>
                        </div>
                        <div className="mt-2.5 text-[11px] font-medium text-slate-600 w-4 text-center">{(index + 1).toString().padStart(2, '0')}</div>
                        <input type="text" value={step} onChange={(e) => { const s = [...setupInstructions]; s[index] = e.target.value; setSetupInstructions(s); }} className="flex-1 font-mono rounded-lg border border-[#262626] bg-[#141414] px-4 py-2.5 text-sm text-white outline-none focus:border-slate-400 focus:bg-[#1a1a1a] transition-colors" />
                        <button onClick={() => setSetupInstructions(setupInstructions.filter((_, i) => i !== index))} className="flex shrink-0 w-10 items-center justify-center rounded-lg border border-[#262626] bg-[#141414] text-slate-500 hover:text-red-400 hover:border-red-900/50 transition-colors h-[42px]"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                      </div>
                    );
                  })}
                </div>
              </div>

              </>
              )}

            </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={false}
        animate={{ width: isEditing ? "50%" : "100%" }}
        transition={smoothTransition}
        className="h-full bg-[#000000] relative"
      >
        <div className="absolute top-0 left-0 right-0 z-50 flex h-20 items-center justify-between px-8 pointer-events-none">
           <div className={`absolute inset-0 bg-gradient-to-b from-black/80 to-transparent -z-10 transition-opacity duration-500 ease-out ${isEditing ? 'opacity-0' : 'opacity-100'}`} />
           
           <div className={`pointer-events-auto transition-all duration-500 ease-out ${isEditing ? '-translate-y-10 opacity-0' : 'translate-y-0 opacity-100'}`}>
             <button onClick={() => router.push("/dash")} className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
               Back to Projects
             </button>
           </div>

           <div className="flex items-center gap-4 pointer-events-auto">
              {!isEditing && renderModeSwitch(false)}
              
              <div className={`transition-all duration-500 ease-out flex items-center gap-3 ${isEditing ? '-translate-y-10 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
                {!['published', 'delivered', 'rejected'].includes(project?.status) ? (
                  <>
                    <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 rounded-full border border-white/10 bg-[#121212] px-5 py-2.5 text-sm font-medium text-white hover:bg-white/5 transition-all active:scale-95">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                      Edit Report
                    </button>
                    <button onClick={() => setPublishModalOpen(true)} disabled={saving} className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-[0_4px_14px_rgba(255,255,255,0.25)] hover:shadow-[0_6px_20px_rgba(255,255,255,0.4)] hover:scale-105 transition-all active:scale-95 disabled:opacity-50">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                      {saving ? "Publishing..." : "Publish"}
                    </button>
                  </>
                ) : (
                  <button 
  onClick={handleShare}
  className="group flex items-center justify-center w-[180px] gap-2 rounded-full border border-white/10 bg-[#141414] py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-95 shadow-sm"
>
  {copiedLink ? (
    <>
      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
      <span className="text-white font-semibold">Link Copied!</span>
    </>
  ) : (
    <>
      <svg className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
      Share Client Portal
    </>
  )}
</button>
                )}
              </div>
           </div>
        </div>

        <iframe 
          ref={iframeRef}
          srcDoc={initialHtml} 
          className="w-full h-full border-0" 
          sandbox="allow-same-origin allow-scripts" 
          title="Handoff Portal Preview"
        />
      </motion.div>
    </div>
  );
}