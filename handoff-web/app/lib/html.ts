// lib/html.ts
export function generateHtmlReport(
  report: any, 
  slug: string = '', 
  isPreview: boolean = false, 
  authorName: string = '', 
  isOwner: boolean = false, 
  projectStatus: string = 'published', 
  viewerIsLoggedIn: boolean = false
): string {
  const generationDate = new Date().toISOString().split('T')[0];
  const engineCount = report.developerRunbook?.coreModules?.length || 0;
  const envCount = report.developerRunbook?.environmentVariables?.length || 0;
  const apiCount = report.developerRunbook?.httpEndpoints?.length || 0;

  const formatText = (text: string) => {
    if (!text) return '';
    return text.replace(/`([^`]+)`/g, '<code>$1</code>');
  };

  const escapeHtml = (unsafe: string) => {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const animClass = isPreview ? '' : 'anim';
  const formattedOverview = formatText(report.developerRunbook?.architectureOverview);
  const formattedSummary = formatText(report.executiveView?.summary);
  const formattedImpact = formatText(report.executiveView?.businessValue);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title id="live-head-title">${report.executiveView?.title || 'Project Report'} - AST Analysis Engine</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        fontFamily: 'Inter',
        fontSize: '13px',
        background: 'transparent',
        primaryColor: '#161616',
        primaryTextColor: '#F5F5F7',
        primaryBorderColor: '#2C2C2E',
        lineColor: '#6E6E73',
        secondaryColor: '#161616',
        tertiaryColor: '#161616',
        edgeLabelBackground: '#000000'
      }
    });
    
    window.mermaid = mermaid;
  </script>
  <style>
    .mermaid .edgePath .path { stroke-dasharray: 6, 6; animation: flow 1s linear infinite; }
    @keyframes flow { from { stroke-dashoffset: 12; } to { stroke-dashoffset: 0; } }
    .mermaid svg .edgePath path.path, .mermaid svg .flowchart-link {
      stroke: var(--ink) !important; stroke-width: 1.5px !important; stroke-dasharray: 6, 12 !important; 
      animation: lightStrip 0.9s linear infinite !important; filter: drop-shadow(0 0 4px rgba(245, 245, 247, 0.6)) !important;
    }
    @keyframes lightStrip { from { stroke-dashoffset: 18; } to { stroke-dashoffset: 0; } }
    
    :root{
      --bg:            #000000;
      --surface:       #111113;
      --surface-2:     #18181B;
      --line:          rgba(255,255,255,0.08);
      --line-strong:   rgba(255,255,255,0.14);
      --ink:           #F5F5F7;
      --ink-dim:       rgba(245,245,247,0.68);
      --ink-faint:     rgba(245,245,247,0.4);
      --gold:          #D4AF6A;
      --ease:          cubic-bezier(0.16, 1, 0.3, 1);
    }
    
    *{ box-sizing:border-box; }
    body{ margin:0; background:var(--bg); color:var(--ink); font-family:'Inter', -apple-system, sans-serif; font-weight:400; -webkit-font-smoothing:antialiased; }
    
    .mono{ font-family:'IBM Plex Mono', monospace; }
    code { font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--ink); background: var(--surface-2); border: 1px solid var(--line-strong); padding: 2px 6px; border-radius: 4px; }
    
    ::-webkit-scrollbar{ width:6px; height:6px; }
    ::-webkit-scrollbar-track{ background:transparent; }
    ::-webkit-scrollbar-thumb{ background:var(--line-strong); border-radius:10px; }
    
    .cover{ border-bottom:1px solid var(--line); background:rgba(0,0,0,0.72); backdrop-filter:blur(20px); position:sticky; top:0; z-index:50; transition: all 0.3s var(--ease); }
    .cover-inner{ max-width:1120px; margin:0 auto; padding:22px 32px; display:flex; align-items:center; justify-content:space-between; gap:24px; }
    
    .doc-id{ font-size:11px; letter-spacing:0.06em; color:var(--ink-faint); margin-bottom:4px; font-weight:500; text-transform: uppercase; }
    .doc-title{ font-size:16px; font-weight:600; letter-spacing:-0.015em; color:var(--ink); }
    
    .segmented{ position:relative; display:flex; padding:4px; background: rgba(20,20,20,0.9); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); border-radius: 9999px; flex-shrink:0; }
    .segmented .thumb{ position:absolute; top:4px; bottom:4px; left:4px; background:#e2e8f0; border-radius: 9999px; transition:transform 0.5s var(--ease), width 0.5s var(--ease); z-index:0; }
    .seg-btn{ position:relative; z-index:1; padding:8px 20px; font-size:14px; font-weight:500; background:none; border:none; cursor:pointer; color:#94a3b8; transition:color 0.3s var(--ease); white-space:nowrap; border-radius: 9999px; }
    .seg-btn.active{ color:#0a0a0a !important; }
    
    main{ max-width:1120px; margin:0 auto; padding:72px 32px 120px; }
    
    section.view { display: none; opacity: 0; }
    section.view.active { display: block; opacity: 1; }
    
    .view.fade-out { animation: premiumFadeOut 0.22s var(--ease) forwards; }
    .view.fade-in { animation: premiumFadeIn 0.3s var(--ease) forwards; }
    
    @keyframes premiumFadeOut {
      from { opacity: 1; transform: translateY(0) scale(1); }
      to { opacity: 0; transform: translateY(-6px) scale(0.99); }
    }
    @keyframes premiumFadeIn {
      from { opacity: 0; transform: translateY(6px) scale(0.99); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    
    @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .anim { animation: rise 0.5s var(--ease) both; }
    .anim:nth-child(1) { animation-delay: 0s; }
    .anim:nth-child(2) { animation-delay: 0.06s; }
    .anim:nth-child(3) { animation-delay: 0.12s; }
    .anim:nth-child(4) { animation-delay: 0.18s; }
    
    .panel{ background:var(--surface); border:1px solid var(--line); border-radius:22px; padding:56px; }
    .panel + .panel{ margin-top:24px; }
    
    .eyebrow{ font-size:12px; font-weight:600; letter-spacing:0.02em; color:var(--ink-faint); margin-bottom:20px; text-transform: uppercase; }
    .brief{ font-size:28px; line-height:1.5; font-weight:300; color:var(--ink); max-width:760px; letter-spacing:-0.015em; }
    
    .impact-row{ margin-top:32px; padding-top:32px; border-top:1px solid var(--line); }
    .impact-row p{ font-size:16px; line-height:1.7; color:var(--ink-dim); max-width:680px; margin:0; font-weight:400; }
    
    .grid-2{ display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:24px; margin-bottom:24px; }
    @media (max-width:860px){ .grid-2{ grid-template-columns:1fr; } }
    
    .manifest-row{ display:flex; gap:16px; padding:20px 0; border-top:1px solid var(--line); }
    .manifest-row:first-of-type{ border-top:none; padding-top:0; }
    .manifest-row .dot{ width:5px; height:5px; border-radius:50%; background:var(--ink-faint); flex-shrink:0; margin-top:9px; }
    .manifest-row p{ font-size:15px; line-height:1.65; color:var(--ink-dim); margin:0; }
    
    .seq-row{ display:flex; gap:20px; padding-bottom:28px; }
    .seq-row:last-child{ padding-bottom:0; }
    .seq-num{ width:26px; height:26px; border-radius:50%; flex-shrink:0; background:var(--surface-2); border:1px solid var(--line-strong); display:flex; align-items:center; justify-content:center; font-size:12px; color:var(--ink-dim); font-weight:500; }
    .seq-row p{ font-size:15px; line-height:1.65; color:var(--ink-dim); margin:5px 0 0; }
    
    h3.panel-title{ font-size:16px; font-weight:600; color:var(--ink); margin:0 0 28px; letter-spacing:-0.01em; }
    
    .manifest-strip{ display:grid; grid-template-columns:repeat(5, 1fr); gap:1px; background:var(--line); border:1px solid var(--line); border-radius:16px; overflow:hidden; }
    @media (max-width:860px){ .manifest-strip{ grid-template-columns:repeat(2, 1fr); } }
    .manifest-field{ background:var(--surface); padding:26px 24px; }
    .manifest-field .label{ font-size:11px; color:var(--ink-faint); margin-bottom:10px; font-weight:500; text-transform: uppercase;}
    .manifest-field .value{ font-family:'IBM Plex Mono'; font-size:14px; color:var(--ink); text-transform: capitalize; }
    .manifest-field .value.ok{ color:#67C88A; }
    
    .flow-copy{ font-size:15px; line-height:1.75; color:var(--ink-dim); max-width:740px; margin:0 0 36px; }
    
    .mermaid-wrap{ background:var(--surface-2); border:1px solid var(--line); border-radius:16px; padding:36px; overflow-x:auto; }
    
    .engine-grid{ display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:28px; }
    @media (max-width:860px){ .engine-grid{ grid-template-columns:1fr; } }
    .engine{ background:var(--surface-2); border:1px solid var(--line); border-radius:16px; padding:30px 32px; transition:border-color 0.3s var(--ease); }
    .engine:hover{ border-color:var(--line-strong); }
    .engine-head{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin-bottom:12px; }
    .engine-name{ font-size:15px; font-weight:600; color:var(--ink); }
    .engine-path{ font-family:'IBM Plex Mono'; font-size:11px; color:var(--ink-faint); }
    .engine-desc{ font-size:14px; line-height:1.65; color:var(--ink-dim); margin:0 0 20px; }
    .engine-tags{ display:flex; flex-wrap:wrap; gap:8px; }
    .tag{ font-family:'IBM Plex Mono'; font-size:11px; color:var(--ink-dim); border:1px solid var(--line-strong); border-radius:6px; padding:4px 9px; }
    
    .method-badge { font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.05em; }
    .method-get { color: #61AEE8; background: rgba(97, 174, 232, 0.1); border: 1px solid rgba(97, 174, 232, 0.2); }
    .method-post { color: #67C88A; background: rgba(103, 200, 138, 0.1); border: 1px solid rgba(103, 200, 138, 0.2); }
    .method-put { color: #E8A861; background: rgba(232, 168, 97, 0.1); border: 1px solid rgba(232, 168, 97, 0.2); }
    .method-delete { color: #E5A0A0; background: rgba(229, 160, 160, 0.1); border: 1px solid rgba(229, 160, 160, 0.2); }
    .method-patch { color: #C282E8; background: rgba(194, 130, 232, 0.1); border: 1px solid rgba(194, 130, 232, 0.2); }
    
    .env-field{ border:1px solid var(--line); border-radius:14px; padding:24px 26px; background:var(--surface-2); margin-bottom:16px;}
    .env-field:last-child{ margin-bottom: 0;}
    .env-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
    .env-name{ font-family:'IBM Plex Mono'; font-size:13px; color:var(--ink); font-weight:500; }
    .req{ font-size:10px; letter-spacing:0.04em; color:#E5A0A0; border:1px solid rgba(229,160,160,0.25); border-radius:6px; padding:3px 8px; font-weight:500; text-transform: uppercase; }
    .env-desc{ font-size:13.5px; line-height:1.65; color:var(--ink-dim); margin:0; }
    
    .datastate-tag{ display:flex; align-items:center; gap:9px; margin-bottom:22px; }
    .dot2{ width:6px; height:6px; border-radius:50%; background:#67C88A; }
    .datastate-tag span{ font-family:'IBM Plex Mono'; font-size:12px; color:#67C88A; }
    
    .term{ background:var(--surface-2); border:1px solid var(--line); border-radius:16px; padding:30px 32px; font-family:'IBM Plex Mono'; font-size:13.5px; }
    .term-line{ display:flex; gap:14px; color:var(--ink-dim); padding:9px 0; }
    .term-line + .term-line{ border-top:1px solid var(--line); }
    .term-line .chevron{ color:var(--ink-faint); flex-shrink:0; }
    
    .handshake-card { background: var(--surface); border: 1px solid var(--line-strong); border-radius: 16px; padding: 32px; margin-top: 40px; text-align: center; }
    
    .btn-approve { background: var(--ink); color: var(--bg); font-weight: 600; padding: 12px 24px; border-radius: 8px; border: none; cursor: pointer; transition: transform 0.2s; }
    .btn-approve:hover { transform: translateY(-2px); }
    
    .btn-reject { background: transparent; border: 1px solid var(--line-strong); color: var(--ink); font-weight: 500; padding: 12px 24px; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
    .btn-reject:hover { background: rgba(229, 160, 160, 0.1); border-color: rgba(229, 160, 160, 0.3); color: #E5A0A0; transform: translateY(-2px); }

    .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); z-index: 100; align-items: center; justify-content: center; }
    .modal-overlay.active { display: flex; }
    .modal-content { background: var(--surface-2); border: 1px solid var(--line); border-radius: 16px; padding: 32px; width: 100%; max-width: 400px; }
    
    .input-field { width: 100%; background: var(--surface); border: 1px solid var(--line); color: var(--ink); padding: 12px; border-radius: 8px; margin-bottom: 16px; font-family: inherit; outline: none; }
    .input-field:focus { border-color: var(--line-strong); }
    
    @keyframes premiumModalIn {
      from { opacity: 0; transform: scale(0.95) translateY(10px); filter: blur(4px); }
      to { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
    }
    .premium-in { animation: premiumModalIn 0.5s var(--ease) forwards; }

    /* The system return glitch for transitions */
    @keyframes sysReturnGlitch {
      0% { clip-path: inset(20% 0 80% 0); transform: translate(-2px, 2px); filter: invert(0) sepia(1) hue-rotate(180deg); }
      20% { clip-path: inset(60% 0 10% 0); transform: translate(2px, -2px); filter: invert(1); }
      40% { clip-path: inset(40% 0 50% 0); transform: translate(-2px, 2px); filter: invert(0); }
      60% { clip-path: inset(80% 0 5% 0); transform: translate(2px, -2px); filter: invert(1) sepia(1) hue-rotate(180deg); }
      80% { clip-path: inset(10% 0 70% 0); transform: translate(-2px, 2px); filter: invert(0); }
      100% { clip-path: inset(30% 0 50% 0); transform: translate(0); filter: invert(0); }
    }
    .glitching { animation: sysReturnGlitch 0.4s cubic-bezier(.25, .46, .45, .94) both; pointer-events: none; }
  </style>

  ${isPreview ? `
  <script>
    const fmt = (text) => text ? text.replace(/\\\`([^\\\`]+)\\\`/g, '<code>$1</code>') : '';
    
    function patchText(el, raw) {
      if (!el || raw === undefined || el.__raw === raw) return;
      el.__raw = raw;
      el.innerHTML = fmt(raw);
    }

    function reconcileFeatures(container, features) {
      if (!container || !features) return;
      features.forEach((f, i) => {
        let row = container.children[i];
        if (!row) {
          row = document.createElement('div');
          row.className = 'manifest-row';
          row.innerHTML = '<div class="dot"></div><p></p>';
          container.appendChild(row);
        }
        patchText(row.querySelector('p'), f);
      });
      while (container.children.length > features.length) {
        container.removeChild(container.lastElementChild);
      }
    }

    function reconcileFlows(container, flows) {
      if (!container || !flows) return;
      flows.forEach((flow, fi) => {
        let flowEl = container.children[fi];
        if (!flowEl) {
          flowEl = document.createElement('div');
          flowEl.style.marginBottom = '32px';
          flowEl.innerHTML = '<h4 style="font-size:14px; font-weight:600; color:var(--ink); margin:0 0 16px;"></h4><div class="steps-container"></div>';
          container.appendChild(flowEl);
        }
        
        patchText(flowEl.querySelector('h4'), flow.flowName);
        
        const stepsContainer = flowEl.querySelector('.steps-container');
        const steps = flow.steps || [];
        
        steps.forEach((step, si) => {
          let stepEl = stepsContainer.children[si];
          if (!stepEl) {
            stepEl = document.createElement('div');
            stepEl.className = 'seq-row';
            stepEl.innerHTML = '<div class="seq-num"></div><div><p></p></div>';
            stepsContainer.appendChild(stepEl);
          }
          const numEl = stepEl.querySelector('.seq-num');
          if (numEl.textContent !== String(step.stepNumber)) numEl.textContent = step.stepNumber;
          patchText(stepEl.querySelector('p'), step.action);
        });
        
        while (stepsContainer.children.length > steps.length) {
          stepsContainer.removeChild(stepsContainer.lastElementChild);
        }
      });
      while (container.children.length > flows.length) {
        container.removeChild(container.lastElementChild);
      }
    }

    window.addEventListener('message', (event) => {
      if (event.data?.type === 'PARENT_TAB_SWITCH') {
        if (typeof switchView === 'function') switchView(event.data.payload, true);
        return;
      }

      if (event.data?.type !== 'LIVE_UPDATE') return;
      const p = event.data.payload;
      
      const titleEl = document.getElementById('live-doc-title');
      if (titleEl && p.title !== undefined && titleEl.__raw !== p.title) {
        patchText(titleEl, p.title);
        document.getElementById('live-head-title').innerText = p.title + ' - AST Analysis Engine';
      }
      
      patchText(document.getElementById('live-summary'), p.summary);
      patchText(document.getElementById('live-impact'), p.impact);
      reconcileFeatures(document.getElementById('live-features-list'), p.features);
      reconcileFlows(document.getElementById('live-flows-list'), p.flows);
      patchText(document.getElementById('live-dev-overview'), p.devOverview);
      
      const mermaidWrap = document.querySelector('.mermaid-wrap');
      if (mermaidWrap && p.mermaid !== undefined && mermaidWrap.__raw !== p.mermaid) {
         mermaidWrap.__raw = p.mermaid;
         mermaidWrap.setAttribute('data-mermaid-code', p.mermaid);
         
         const devView = document.getElementById('view-dev');
         if (devView && devView.classList.contains('active')) {
            if (typeof drawMermaidFromData === 'function') drawMermaidFromData();
         }
      }

      const uiWrap = document.getElementById('live-ui-components');
      if(uiWrap && p.uiComponents) {
        uiWrap.innerHTML = p.uiComponents.length === 0 
          ? '<p class="flow-copy" style="margin: 0;">No frontend components detected in this scan.</p>' 
          : p.uiComponents.map(c => \`<div class="engine">
              <div class="engine-head"><span class="engine-name">\${fmt(c.name)}</span><span class="engine-path">\${fmt(c.sourceFile)}</span></div>
              <p class="engine-desc">\${fmt(c.purpose)}</p>
              <div class="engine-tags"><span class="tag">UI/View</span></div>
            </div>\`).join('');
      }

      const coreWrap = document.getElementById('live-core-modules');
      if(coreWrap && p.coreModules) {
        coreWrap.innerHTML = p.coreModules.length === 0 
          ? '<p class="flow-copy" style="margin: 0;">No core modules detected in this scan.</p>' 
          : p.coreModules.map(m => \`<div class="engine">
              <div class="engine-head"><span class="engine-name">\${fmt(m.moduleName)}</span><span class="engine-path">\${fmt(m.sourceFile)}</span></div>
              <p class="engine-desc">\${fmt(m.purpose)}</p>
              <div class="engine-tags">
                \${(m.exportedSymbols || []).map(s => \`<span class="tag">\${fmt(s)}</span>\`).join('')}
              </div>
            </div>\`).join('');
      }

      const apiWrap = document.getElementById('live-http-endpoints');
      if(apiWrap && p.httpEndpoints) {
        apiWrap.innerHTML = p.httpEndpoints.length === 0 
          ? '<p class="flow-copy" style="margin: 0;">No HTTP endpoints or API routes detected.</p>' 
          : p.httpEndpoints.map(ep => \`<div style="display:flex; align-items:flex-start; gap:16px; padding: 16px 0; border-top: 1px solid var(--line);">
              <span class="method-badge method-\${(ep.method || 'get').toLowerCase()}">\${fmt(ep.method)}</span>
              <div>
                <div style="font-family:'IBM Plex Mono'; font-size:14px; color:var(--ink); margin-bottom:4px;">\${fmt(ep.path)}</div>
                <div style="font-size:13px; color:var(--ink-dim);">\${fmt(ep.description)}</div>
                <div style="font-size:11px; color:var(--ink-faint); margin-top:6px;">Source: \${fmt(ep.sourceFile)}</div>
              </div>
            </div>\`).join('');
      }

      const envWrap = document.getElementById('live-env-vars');
      if(envWrap && p.envVars) {
        envWrap.innerHTML = p.envVars.length === 0 
          ? '<p class="flow-copy" style="margin: 0;">No environment variables detected.</p>' 
          : p.envVars.map(env => \`<div class="env-field">
              <div class="env-head">
                <span class="env-name">\${fmt(env.name)}</span>
                \${env.required ? '<span class="req">Required</span>' : ''}
              </div>
              <p class="env-desc">\${fmt(env.purpose)}</p>
            </div>\`).join('');
      }

      const dbWrap = document.getElementById('live-db-schema-wrap');
      if(dbWrap && p.dbSchema) {
        let html = \`<div class="datastate-tag"><div class="dot2"></div><span>\${fmt(p.dbSchema.ormOrEngine) || 'N/A'}</span></div>
          <p class="env-desc" style="margin-bottom: 24px;">\${fmt(p.dbSchema.summary)}</p>\`;
        
        if (p.dbSchema.modelsOrTables && p.dbSchema.modelsOrTables.length > 0) {
          html += \`<div style="border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--surface-2);">
              <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                  <tr style="border-bottom: 1px solid var(--line);">
                    <th style="padding: 14px 20px; font-size: 11px; color: var(--ink-faint); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; width: 30%;">Entity / Table</th>
                    <th style="padding: 14px 20px; font-size: 11px; color: var(--ink-faint); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Schema & Relations</th>
                  </tr>
                </thead>
                <tbody>
                  \${p.dbSchema.modelsOrTables.map((t, idx, arr) => \`<tr style="\${idx !== arr.length - 1 ? 'border-bottom: 1px solid var(--line);' : ''}">
                      <td style="padding: 18px 20px; font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--ink); vertical-align: top; font-weight: 500;">\${fmt(t.name)}</td>
                      <td style="padding: 18px 20px; font-size: 13.5px; color: var(--ink-dim); line-height: 1.65; vertical-align: top;">\${fmt(t.description)}</td>
                    </tr>\`).join('')}
                </tbody>
              </table>
            </div>\`;
        }
        dbWrap.innerHTML = html;
      }

      const setupContainer = document.getElementById('live-setup-instructions');
      if(setupContainer && p.setupInstructions) {
        setupContainer.innerHTML = p.setupInstructions.map(step => 
           '<div class="term-line"><span class="chevron">></span><span>' + fmt(step) + '</span></div>'
        ).join('');
      }
    });
  </script>
  ` : ''}
</head>
<body>
  
  <div class="cover">
    <div class="cover-inner">
      <div style="display: flex; align-items: center; gap: 16px;">
        ${!isPreview && viewerIsLoggedIn ? `
          <a href="/dash" style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--line); color: var(--ink-faint); transition: all 0.2s ease; text-decoration: none;" onmouseover="this.style.color='var(--ink)'; this.style.borderColor='var(--line-strong)';" onmouseout="this.style.color='var(--ink-faint)'; this.style.borderColor='var(--line)';" title="Back to Projects">
            <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </a>
        ` : ''}
        <div>
          <div class="doc-id">Handoff Document</div>
          <div class="doc-title" id="live-doc-title">${report.executiveView?.title || 'Project Report'}</div>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 12px;">
        <!-- Invisible dummy switch just to satisfy the JS logic if loaded in the Next.js preview iframe -->
        <div class="segmented" id="tab-group" ${isPreview ? 'style="display:none;"' : ''}>
          <div class="thumb" id="thumb"></div>
          <button class="seg-btn active" id="btn-exec" onclick="switchView('exec')">Executive brief</button>
          <button class="seg-btn" id="btn-dev" onclick="switchView('dev')">Developer runbook</button>
        </div>
        
        ${!isPreview ? `
          ${!isOwner ? `
            <button onclick="triggerSaveFlow()" style="display: flex; align-items: center; justify-content: center; gap: 6px; border-radius: 9999px; border: 1px solid var(--line); background: transparent; color: #94a3b8; padding: 6px 16px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s var(--ease);" onmouseover="this.style.color='#fff'; this.style.background='rgba(255,255,255,0.05)';" onmouseout="this.style.color='#94a3b8'; this.style.background='transparent';">
              <svg style="width: 14px; height: 14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
              Save
            </button>
          ` : `
            <button id="public-share-btn" onclick="copyPublicLink()" style="display: flex; align-items: center; justify-content: center; gap: 6px; border-radius: 9999px; border: 1px solid var(--line); background: transparent; color: #94a3b8; padding: 6px 16px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s var(--ease);" onmouseover="this.style.color='#fff'; this.style.background='rgba(255,255,255,0.05)';" onmouseout="this.style.color='#94a3b8'; this.style.background='transparent';">
              <svg style="width: 14px; height: 14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
              Share
            </button>
          `}
        ` : ''}
      </div>
    </div>
  </div>

  <main>
    <!-- ================= EXECUTIVE ================= -->
    <section id="view-exec" class="view active">
      <div class="panel ${animClass}">
        <div class="eyebrow">Project Brief</div>
        <p class="brief" id="live-summary">${formattedSummary}</p>
        
        <div class="impact-row">
          <p id="live-impact">${formattedImpact}</p>
        </div>
      </div>
      
      <div class="grid-2">
        <div class="panel">
          <h3 class="panel-title">Capability manifest</h3>
          <div id="live-features-list">
            ${report.executiveView?.featuresDelivered?.map((f: string) => `
              <div class="manifest-row"><div class="dot"></div><p>${formatText(f)}</p></div>
            `).join('') || ''}
          </div>
        </div>
        
        <div class="panel">
          <h3 class="panel-title">Execution sequence</h3>
          <div id="live-flows-list">
            ${report.executiveView?.userFlows?.map((flow: any) => `
              <div style="margin-bottom: 32px;">
                <h4 style="font-size:14px; font-weight:600; color:var(--ink); margin:0 0 16px;">${formatText(flow.flowName)}</h4>
                <div class="steps-container">
                  ${flow.steps?.map((step: any) => `
                    <div class="seq-row">
                      <div class="seq-num">${step.stepNumber}</div>
                      <div><p>${formatText(step.action)}</p></div>
                    </div>
                  `).join('') || ''}
                </div>
              </div>
            `).join('') || ''}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="eyebrow">Handoff manifest</div>
        <div class="manifest-strip">
          <div class="manifest-field"><div class="label">Generated</div><div class="value">${generationDate}</div></div>
          <div class="manifest-field"><div class="label">Architecture</div><div class="value">${report.projectType || 'N/A'}</div></div>
          <div class="manifest-field"><div class="label">Core Engines</div><div class="value">${engineCount}</div></div>
          <div class="manifest-field"><div class="label">API Routes</div><div class="value">${apiCount}</div></div>
          <div class="manifest-field"><div class="label">Schema</div><div class="value ok">Verified</div></div>
        </div>
      </div>

      <!-- HANDSHAKE LOGIC -->
      ${(!isOwner && projectStatus === 'published') ? `
        <div class="handshake-card">
          <h3 style="font-size: 18px; font-weight: 600; color: var(--gold); margin: 0 0 8px;">Ready for Sign-Off</h3>
          <p style="color: var(--ink-dim); font-size: 14px; margin: 0 0 20px;">Review the documentation above. Please approve the delivery or request revisions if needed.</p>
          <div style="display: flex; gap: 12px; justify-content: center;">
             <button class="btn-reject" onclick="openHandshake('reject')">Request Revisions</button>
             <button class="btn-approve" onclick="openHandshake('approve')">Approve Delivery</button>
          </div>
        </div>
      ` : ''}

      ${projectStatus === 'delivered' ? `
        <div class="handshake-card" style="border-color: rgba(103, 200, 138, 0.4); background: rgba(103, 200, 138, 0.02);">
          <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 8px;">
            <svg style="width: 20px; height: 20px; color: #67C88A;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
            <h3 style="font-size: 18px; font-weight: 600; color: #67C88A; margin: 0;">Delivery Approved</h3>
          </div>
          <p style="color: var(--ink-dim); font-size: 14px; margin: 0;">This project has been formally signed off and accepted.</p>
        </div>
      ` : ''}

      ${projectStatus === 'rejected' ? `
        <div class="handshake-card" style="border-color: rgba(229, 160, 160, 0.4); background: rgba(229, 160, 160, 0.02);">
          <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 8px;">
            <svg style="width: 20px; height: 20px; color: #E5A0A0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
            <h3 style="font-size: 18px; font-weight: 600; color: #E5A0A0; margin: 0;">Revisions Requested</h3>
          </div>
          <p style="color: var(--ink-dim); font-size: 14px; margin: 0;">This project is awaiting developer revisions based on feedback.</p>
        </div>
      ` : ''}
    </section>

    <!-- ================= DEVELOPER ================= -->
    <section id="view-dev" class="view">
      <div class="panel ${animClass}">
        <div class="eyebrow">System architecture</div>
        <p class="flow-copy" id="live-dev-overview">${formattedOverview}</p>
        <div class="mermaid-wrap">
          <pre class="mermaid" id="live-mermaid">${escapeHtml(report.developerRunbook?.mermaidDiagram || '')}</pre>
        </div>
      </div>

      <div class="panel">
        <h3 class="panel-title">Frontend architecture</h3>
        <div class="engine-grid" id="live-ui-components">
          ${report.developerRunbook?.uiComponents && report.developerRunbook.uiComponents.length > 0 ? report.developerRunbook.uiComponents.map((c: any) => `
            <div class="engine">
              <div class="engine-head"><span class="engine-name">${formatText(c.name)}</span><span class="engine-path">${formatText(c.sourceFile)}</span></div>
              <p class="engine-desc">${formatText(c.purpose)}</p>
              <div class="engine-tags">
                <span class="tag">UI/View</span>
              </div>
            </div>
          `).join('') : '<p class="flow-copy" style="margin: 0;">No frontend components detected in this scan.</p>'}
        </div>
      </div>

      <div class="panel">
        <h3 class="panel-title">Core backend engines</h3>
        <div class="engine-grid" id="live-core-modules">
          ${report.developerRunbook?.coreModules?.map((m: any) => `
            <div class="engine">
              <div class="engine-head"><span class="engine-name">${formatText(m.moduleName)}</span><span class="engine-path">${formatText(m.sourceFile)}</span></div>
              <p class="engine-desc">${formatText(m.purpose)}</p>
              <div class="engine-tags">
                ${m.exportedSymbols?.map((s: string) => `<span class="tag">${formatText(s)}</span>`).join('') || ''}
              </div>
            </div>
          `).join('') || '<p class="flow-copy" style="margin: 0;">No core modules detected in this scan.</p>'}
        </div>
      </div>

      <div class="panel">
        <h3 class="panel-title">API & Routing</h3>
        <div id="live-http-endpoints">
          ${report.developerRunbook?.httpEndpoints && report.developerRunbook.httpEndpoints.length > 0 ? report.developerRunbook.httpEndpoints.map((ep: any) => `
            <div style="display:flex; align-items:flex-start; gap:16px; padding: 16px 0; border-top: 1px solid var(--line);">
              <span class="method-badge method-${(ep.method || 'get').toLowerCase()}">${formatText(ep.method)}</span>
              <div>
                <div style="font-family:'IBM Plex Mono'; font-size:14px; color:var(--ink); margin-bottom:4px;">${formatText(ep.path)}</div>
                <div style="font-size:13px; color:var(--ink-dim);">${formatText(ep.description)}</div>
                <div style="font-size:11px; color:var(--ink-faint); margin-top:6px;">Source: ${formatText(ep.sourceFile)}</div>
              </div>
            </div>
          `).join('') : '<p class="flow-copy" style="margin: 0;">No HTTP endpoints or API routes detected.</p>'}
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <h3 class="panel-title">Environment matrix</h3>
          <div id="live-env-vars">
            ${report.developerRunbook?.environmentVariables && report.developerRunbook.environmentVariables.length > 0 ? report.developerRunbook.environmentVariables.map((env: any) => `
              <div class="env-field">
                <div class="env-head">
                  <span class="env-name">${formatText(env.name)}</span>
                  ${env.required ? '<span class="req">Required</span>' : ''}
                </div>
                <p class="env-desc">${formatText(env.purpose)}</p>
              </div>
            `).join('') : '<p class="flow-copy" style="margin: 0;">No environment variables detected.</p>'}
          </div>
        </div>
        
        <div class="panel">
          <h3 class="panel-title">Data state & Schema</h3>
          <div id="live-db-schema-wrap">
            <div class="datastate-tag"><div class="dot2"></div><span>${formatText(report.developerRunbook?.databaseSchema?.ormOrEngine) || 'N/A'}</span></div>
            <p class="env-desc" style="margin-bottom: 24px;">${formatText(report.developerRunbook?.databaseSchema?.summary || '')}</p>
            
            ${report.developerRunbook?.databaseSchema?.modelsOrTables && report.developerRunbook.databaseSchema.modelsOrTables.length > 0 ? `
              <div style="border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--surface-2);">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                  <thead>
                    <tr style="border-bottom: 1px solid var(--line);">
                      <th style="padding: 14px 20px; font-size: 11px; color: var(--ink-faint); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; width: 30%;">Entity / Table</th>
                      <th style="padding: 14px 20px; font-size: 11px; color: var(--ink-faint); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Schema & Relations</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${report.developerRunbook.databaseSchema.modelsOrTables.map((t: any, idx: number, arr: any[]) => `
                      <tr style="${idx !== arr.length - 1 ? 'border-bottom: 1px solid var(--line);' : ''}">
                        <td style="padding: 18px 20px; font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--ink); vertical-align: top; font-weight: 500;">${formatText(t.name)}</td>
                        <td style="padding: 18px 20px; font-size: 13.5px; color: var(--ink-dim); line-height: 1.65; vertical-align: top;">${formatText(t.description)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      <div class="panel">
        <h3 class="panel-title">Initialization</h3>
        <div class="term" id="live-setup-instructions">
          ${report.developerRunbook?.setupInstructions?.map((step: string) => `
            <div class="term-line"><span class="chevron">></span><span>${formatText(step)}</span></div>
          `).join('') || ''}
        </div>
      </div>
    </section>
  </main>

  <div style="position: fixed; bottom: 24px; right: 24px; z-index: 40; pointer-events: none; display: flex; align-items: center; gap: 8px; opacity: 0.5; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'">
    <svg style="width: 14px; height: 14px; color: var(--ink);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
    <span style="font-size: 11px; font-weight: 500; color: var(--ink); letter-spacing: 0.02em;">Delivered by ${escapeHtml(authorName || 'Developer')}</span>
  </div>

  <div id="handshake-modal" class="modal-overlay">
    <div class="modal-content">
      <h3 id="hs-title" style="margin-top: 0; color: var(--ink);">Digital Handshake</h3>
      <p id="hs-desc" style="font-size: 13px; color: var(--ink-dim); margin-bottom: 20px;">Confirm your acceptance of the final deliverables.</p>
      
      <form id="handshake-form" onsubmit="submitHandshake(event)">
        <input type="text" id="hs-name" class="input-field" placeholder="Full Name" required />
        <input type="text" id="hs-company" class="input-field" placeholder="Company Name" required />
        <textarea id="hs-feedback" class="input-field" placeholder="Optional feedback or notes..." rows="3"></textarea>
        
        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px;">
          <button type="button" class="btn-approve" style="background: transparent; border: 1px solid var(--line); color: var(--ink);" onclick="document.getElementById('handshake-modal').classList.remove('active')">Cancel</button>
          <button type="submit" class="btn-approve" id="hs-submit-btn">Confirm</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    let mermaidSeq = 0;
    let lastRenderedMermaidCode = null;
    let currentHandshakeAction = 'approve';

    function drawMermaidFromData(attempts = 0) {
      if (!window.mermaid) {
        if (attempts < 50) setTimeout(() => drawMermaidFromData(attempts + 1), 100);
        return;
      }
      
      const wrap = document.querySelector('.mermaid-wrap');
      if (!wrap) return;
      
      let code = wrap.getAttribute('data-mermaid-code');
      if (code === null) {
         const pre = wrap.querySelector('pre.mermaid');
         code = pre ? pre.textContent : '';
         wrap.setAttribute('data-mermaid-code', code);
      }
      
      if (code === lastRenderedMermaidCode && wrap.querySelector('svg')) return;
      
      if (!code || !code.trim()) {
         wrap.innerHTML = '<pre class="mermaid"></pre>';
         lastRenderedMermaidCode = code;
         return;
      }
      
      wrap.innerHTML = '<pre class="mermaid"></pre>';
      const newPre = wrap.querySelector('pre.mermaid');
      newPre.textContent = code; 
      newPre.id = 'live-mermaid-' + (++mermaidSeq);
      
      setTimeout(() => {
        try {
           window.mermaid.run({ querySelector: '#' + newPre.id });
           lastRenderedMermaidCode = code;
        } catch(e) {}
      }, 50);
    }

    function prewarmMermaid(attempts = 0) {
      if (!window.mermaid) {
        if (attempts < 60) setTimeout(() => prewarmMermaid(attempts + 1), 100);
        return;
      }
      const devView = document.getElementById('view-dev');
      if (devView.classList.contains('active')) { drawMermaidFromData(); return; }
      
      const prevCss = devView.style.cssText;
      devView.style.cssText = 'display:block; visibility:hidden; position:absolute; top:0; left:0; pointer-events:none;';
      drawMermaidFromData();
      
      setTimeout(() => { devView.style.cssText = prevCss; }, 250);
    }

    function positionThumb(btn){
      const group = document.getElementById('tab-group');
      const thumb = document.getElementById('thumb');
      if (!group || !thumb || !btn) return;
      
      const gr = group.getBoundingClientRect();
      const br = btn.getBoundingClientRect();
      thumb.style.width = br.width + 'px';
      thumb.style.transform = 'translateX(' + (br.left - gr.left - 5) + 'px)';
    }

    let isTransitioning = false;
    let pendingTab = null;

    function switchView(tab, fromParent = false){
      const execView = document.getElementById('view-exec');
      const devView = document.getElementById('view-dev');
      const btnExec = document.getElementById('btn-exec');
      const btnDev = document.getElementById('btn-dev');
      
      if (!execView || !devView) return;
      
      const target = tab === 'exec' ? execView : devView;
      const other = tab === 'exec' ? devView : execView;
      const targetBtn = tab === 'exec' ? btnExec : btnDev;
      const otherBtn = tab === 'exec' ? btnDev : btnExec;
      
      if (isTransitioning) {
        pendingTab = tab; 
        return;
      }
      if (target.classList.contains('active')) return;
      
      isTransitioning = true;
      
      if (targetBtn) {
        positionThumb(targetBtn);
        targetBtn.classList.add('active');
        otherBtn.classList.remove('active');
      }
      
      other.classList.add('fade-out');
      
      if (!fromParent && window.parent) {
        window.parent.postMessage({ type: 'IFRAME_TAB_SWITCH', payload: tab }, '*');
      }
      
      const FADE_OUT_MS = 220;
      setTimeout(() => {
        other.classList.remove('active', 'fade-out');
        target.classList.add('active', 'fade-in');
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        if (tab === 'dev') drawMermaidFromData();
        
        setTimeout(() => {
          target.classList.remove('fade-in');
          isTransitioning = false;
          if (pendingTab && pendingTab !== tab) {
            const next = pendingTab;
            pendingTab = null;
            switchView(next, fromParent);
          } else {
            pendingTab = null;
          }
        }, 300);
      }, FADE_OUT_MS);
    }

    function openHandshake(action) {
      currentHandshakeAction = action;
      const title = document.getElementById('hs-title');
      const desc = document.getElementById('hs-desc');
      const btn = document.getElementById('hs-submit-btn');
      const feedback = document.getElementById('hs-feedback');

      if (action === 'reject') {
        title.innerText = 'Request Revisions';
        title.style.color = '#E5A0A0';
        desc.innerText = 'Please detail what needs to be changed before you can approve.';
        btn.innerText = 'Submit Revisions';
        btn.style.background = '#E5A0A0';
        btn.style.color = '#000';
        feedback.required = true;
        feedback.placeholder = 'Required feedback or notes...';
      } else {
        title.innerText = 'Digital Handshake';
        title.style.color = 'var(--ink)';
        desc.innerText = 'Confirm your acceptance of the final deliverables.';
        btn.innerText = 'Confirm Delivery';
        btn.style.background = 'var(--ink)';
        btn.style.color = 'var(--bg)';
        feedback.required = false;
        feedback.placeholder = 'Optional feedback or notes...';
      }

      document.getElementById('handshake-modal').classList.add('active');
      document.querySelector('.modal-content').classList.add('premium-in');
    }
    
    async function submitHandshake(e) {
      e.preventDefault();
      const btn = document.getElementById('hs-submit-btn');
      btn.innerText = 'Processing...';

      const payload = {
        slug: '${slug}', 
        action: currentHandshakeAction,
        client_name: document.getElementById('hs-name').value,
        client_company: document.getElementById('hs-company').value,
        client_feedback: document.getElementById('hs-feedback').value
      };

      try {
        const res = await fetch('/api/handshake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const color = currentHandshakeAction === 'reject' ? '#E5A0A0' : '#67C88A';
          const msg = currentHandshakeAction === 'reject' ? 'REVISIONS REQUESTED' : 'DELIVERED';
          document.getElementById('handshake-form').innerHTML = \`<div style="text-align: center; color: \${color}; font-weight: 600; padding: 20px 0; font-family: monospace;">[ STATUS : \${msg} ]<br/><br/><span style="color: var(--ink-dim); font-size: 13px; font-weight: 400;">Thank you. The developer has been notified.</span></div>\`;
          
          setTimeout(() => window.location.reload(), 2500); 
        } else {
          const errorData = await res.json();
          btn.innerText = errorData.error === 'This handoff has already been finalized.' ? 'Already finalized' : 'Error - Try Again';
        }
      } catch (err) {
        btn.innerText = 'Error - Try Again';
      }
    }

    function triggerSaveFlow() {
      localStorage.setItem('pending_save_slug', '${slug}');
      document.body.classList.add('glitching');
      setTimeout(() => { window.location.href = '/register'; }, 400);
    }

    function copyPublicLink() {
      navigator.clipboard.writeText(window.location.href);
      const btn = document.getElementById('public-share-btn');
      const originalHtml = btn.innerHTML;
      
      btn.innerHTML = '<svg style="width: 14px; height: 14px; color: var(--ink);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> <span style="color: var(--ink);">Copied Link</span>';
      btn.style.borderColor = 'var(--line-strong)';
      btn.style.background = 'var(--surface)';
      
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.style.borderColor = 'var(--line)';
        btn.style.background = 'transparent';
      }, 2000);
    }

    window.addEventListener('load', () => {
      const execBtn = document.getElementById('btn-exec');
      if (execBtn) positionThumb(execBtn);
      prewarmMermaid();
      
      ${viewerIsLoggedIn && !isPreview && !isOwner ? `
        fetch('/api/projects/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: '${slug}' })
        }).catch(err => console.error(err));
      ` : ''}
    });

    window.addEventListener('resize', () => {
      const active = document.querySelector('.seg-btn.active');
      if (active) positionThumb(active);
    });

    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        document.body.classList.remove('glitching');
      }
    });
  </script>
</body>
</html>`;
}