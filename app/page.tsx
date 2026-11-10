 "use client";

import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, Bot, Check, ChevronDown, CircleHelp, Code2, ExternalLink, FolderGit2, Github, Globe2, KeyRound, LayoutDashboard, Loader2, LockKeyhole, Menu, MessageSquareText, Plus, Radio, Send, Settings2, ShieldCheck, Sparkles, Terminal, WandSparkles, X } from "lucide-react";

type Log = { label: string; detail?: string; state: "done" | "active" | "idle" | "error" };
type FileItem = { path: string; content: string };
const initialLogs: Log[] = [
  { label: "Ready for instructions", detail: "Connect Gemini and GitHub to start building.", state: "idle" }
];

export default function Home() {
  const [gemini, setGemini] = useState("");
  const [github, setGithub] = useState("");
  const [showGemini, setShowGemini] = useState(false);
  const [showGithub, setShowGithub] = useState(false);
  const [connected, setConnected] = useState({ gemini: false, github: false });
  const [remember, setRemember] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [prompt, setPrompt] = useState("");
  const [repoName, setRepoName] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [mode, setMode] = useState<"create" | "update" | "audit">("create");
  const [repoUrl, setRepoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<Log[]>(initialLogs);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [activeFile, setActiveFile] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [section, setSection] = useState("Workspace");

  useEffect(() => {
    const saved = localStorage.getItem("nova-preferences");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        setRepoName(p.repoName || "");
        setVisibility(p.visibility || "public");
      } catch {}
    }
  }, []);

  const addLog = (label: string, state: Log["state"], detail?: string) =>
    setLogs(old => [...old, { label, state, detail }]);

  async function validate(kind: "gemini" | "github") {
    const value = kind === "gemini" ? gemini.trim() : github.trim();
    if (!value) return setError(`Masukkan ${kind === "gemini" ? "Gemini API key" : "GitHub token"} terlebih dahulu.`);
    setError("");
    try {
      const r = await fetch(`/api/${kind}/validate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: value }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Validasi gagal.");
      setConnected(old => ({ ...old, [kind]: true }));
      setError("");
      addLog(`${kind === "gemini" ? "Gemini API" : "GitHub"} connected`, "done", data.message);
      if (remember) await saveCredential(kind, value);
    } catch (e) {
      setConnected(old => ({ ...old, [kind]: false }));
      setError(e instanceof Error ? e.message : "Tidak dapat memvalidasi credential.");
    }
  }

  async function saveCredential(kind: "gemini" | "github", value: string) {
    if (!passphrase || passphrase.length < 10) throw new Error("Passphrase minimal 10 karakter untuk menyimpan credential terenkripsi.");
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const material = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(value));
    const item = { salt: Array.from(salt), iv: Array.from(iv), cipher: Array.from(new Uint8Array(cipher)) };
    localStorage.setItem(`nova-${kind}-encrypted`, JSON.stringify(item));
  }

  async function runAgent() {
    if (!gemini.trim()) return setError("Masukkan dan validasi Gemini API key terlebih dahulu.");
    if (mode !== "audit" && !github.trim()) return setError("Masukkan dan validasi GitHub token terlebih dahulu.");
    if (!prompt.trim()) return setError("Tulis instruksi untuk NOVA terlebih dahulu.");
    if (mode === "update" && !repoUrl.trim()) return setError("Masukkan URL repository yang ingin diperbarui.");
    setBusy(true); setError(""); setResult(""); setFiles([]);
    setLogs([{ label: "Instruction received", state: "done", detail: mode.toUpperCase() }, { label: "Analyzing requirements", state: "active" }]);
    try {
      const r = await fetch("/api/agent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: gemini, githubToken: github, prompt, mode, repoUrl, repoName, visibility })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Agent gagal menyelesaikan tugas.");
      setFiles(data.files || []);
      setActiveFile(data.files?.[0]?.path || "");
      setResult(data.summary || "Pekerjaan selesai.");
      if (data.repositoryUrl) setRepoUrl(data.repositoryUrl);
      setLogs((data.steps || ["Analysis", "Planning", "Code generation", "GitHub upload"]).map((s: string) => ({ label: s, state: "done" as const })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan.");
      addLog("Task stopped", "error", e instanceof Error ? e.message : "Unknown error");
    } finally { setBusy(false); }
  }

  const current = files.find(f => f.path === activeFile);
  const nav = ["Workspace", "Projects", "Connections", "Settings"];
  return (
    <main className="shell">
      <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
        <div className="brand"><div className="brand-mark">N</div><div><b>NOVA<span>AI</span></b><small>WEBSITE AGENT</small></div><button className="mobile-close" onClick={() => setMobileMenu(false)}><X size={18}/></button></div>
        <div className="workspace-label">WORKSPACE <span>01</span></div>
        <nav>{nav.map((n, i) => <button key={n} className={`nav-item ${section === n ? "selected" : ""}`} onClick={() => { setSection(n); setMobileMenu(false); document.getElementById(n.toLowerCase())?.scrollIntoView({ behavior: "smooth" }); }}>{[<LayoutDashboard/>, <FolderGit2/>, <Radio/>, <Settings2/>][i]}{n}{n === "Connections" && <i className={connected.gemini && connected.github ? "online" : ""}/>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="agent-card"><div className="pulse"/><div><b>Agent status</b><small>{busy ? "Working autonomously" : "Standing by"}</small></div></div><small className="version">NOVA BUILD 1.0 · PRIVATE WORKSPACE</small></div>
      </aside>
      <section className="main">
        <header className="topbar"><button className="menu-btn" onClick={() => setMobileMenu(true)}><Menu/></button><div className="crumb">NOVA <span>/</span> {section}</div><div className="top-right"><span className="secure"><ShieldCheck size={14}/> Local-first credentials</span><div className="avatar">N</div></div></header>
        <div className="content">
          <section className="hero"><div className="eyebrow"><span/> AUTONOMOUS SOFTWARE ENGINEERING</div><h1>Ideas into<br/><em>working websites.</em></h1><p>Build from scratch. Repair existing repositories. Upgrade without starting over.</p><div className="hero-meta"><span><WandSparkles size={14}/> Full-stack capable</span><span><LockKeyhole size={14}/> Your own API keys</span><span><Github size={14}/> GitHub delivery</span></div></section>

          <section className="section-block" id="connections"><div className="section-heading"><div><div className="eyebrow">01 / INTEGRATIONS</div><h2>Connect your tools</h2></div><span className="subtle">Credentials stay under your control</span></div>
            <div className="connect-grid">
              <div className="panel connection"><div className="connection-head"><div className="provider-icon gem"><Sparkles/></div><div><b>Google Gemini</b><small>AI reasoning & code generation</small></div><span className={`status ${connected.gemini ? "good" : ""}`}>{connected.gemini ? "CONNECTED" : "NOT CONNECTED"}</span></div><div className="input-wrap"><KeyRound size={15}/><input type={showGemini ? "text" : "password"} placeholder="Paste Gemini API key" value={gemini} onChange={e => {setGemini(e.target.value);setConnected(v=>({...v,gemini:false}));}}/><button onClick={()=>setShowGemini(!showGemini)}>{showGemini ? "Hide" : "Show"}</button></div><button className="outline-btn" onClick={()=>validate("gemini")}>Test connection <ArrowUpRight size={14}/></button></div>
              <div className="panel connection"><div className="connection-head"><div className="provider-icon git"><Github/></div><div><b>GitHub</b><small>Repository, commits & pushes</small></div><span className={`status ${connected.github ? "good" : ""}`}>{connected.github ? "CONNECTED" : "NOT CONNECTED"}</span></div><div className="input-wrap"><KeyRound size={15}/><input type={showGithub ? "text" : "password"} placeholder="Paste GitHub token" value={github} onChange={e => {setGithub(e.target.value);setConnected(v=>({...v,github:false}));}}/><button onClick={()=>setShowGithub(!showGithub)}>{showGithub ? "Hide" : "Show"}</button></div><button className="outline-btn" onClick={()=>validate("github")}>Test connection <ArrowUpRight size={14}/></button></div>
            </div>
            <div className="remember panel"><label><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> Remember on this device</label><input className="passphrase" type="password" placeholder="Encryption passphrase (min. 10 characters)" value={passphrase} onChange={e=>setPassphrase(e.target.value)}/><small>Optional. Credentials are encrypted in this browser. Keep your passphrase safe; it cannot be recovered.</small></div>
          </section>

          <section className="section-block" id="workspace"><div className="section-heading"><div><div className="eyebrow">02 / COMMAND CENTER</div><h2>What should NOVA do?</h2></div><span className="subtle">Autonomous mode <span className="green-dot"/></span></div>
            <div className="panel command-panel"><div className="mode-tabs">{(["create","update","audit"] as const).map(m=><button key={m} className={mode===m?"active":""} onClick={()=>setMode(m)}>{m==="create"?"Create website":m==="update"?"Update repository":"Audit repository"}</button>)}</div>
              {mode !== "create" && <div className="field"><label>GITHUB REPOSITORY URL</label><input value={repoUrl} onChange={e=>setRepoUrl(e.target.value)} placeholder="https://github.com/owner/repository"/></div>}
              <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={mode==="create"?"Describe the website you want. Example: Build a premium editorial portfolio with a CMS, contact form, and responsive layouts...":mode==="update"?"Describe what to fix or improve. Example: Audit the project, fix mobile navigation, and add a dark mode...":"What should NOVA inspect? Example: Find bugs, security risks, performance issues, and outdated dependencies..."}/>
              {mode==="create" && <div className="field-row"><div className="field"><label>REPOSITORY NAME (OPTIONAL)</label><input value={repoName} onChange={e=>setRepoName(e.target.value)} placeholder="nova-created-project"/></div><div className="field"><label>VISIBILITY</label><select value={visibility} onChange={e=>setVisibility(e.target.value as "public"|"private")}><option value="public">Public</option><option value="private">Private</option></select></div></div>}
              <div className="command-footer"><span><span className="green-dot"/> Gemini model auto-selected by availability</span><button className="primary-btn" disabled={busy} onClick={runAgent}>{busy?<><Loader2 className="spin" size={16}/> Working</>:<>Run NOVA <Send size={15}/></>}</button></div>
            </div>
            {error && <div className="error-box"><CircleHelp size={16}/>{error}</div>}
          </section>

          <section className="section-block" id="projects"><div className="section-heading"><div><div className="eyebrow">03 / EXECUTION</div><h2>Agent activity</h2></div><span className="subtle">{busy?"RUNNING":"IDLE"}</span></div>
            <div className="panel activity-panel">{logs.map((l,i)=><div className="log-row" key={i}><div className={`log-icon ${l.state}`}>{l.state==="active"?<Loader2 className="spin"/>:l.state==="error"?<X/>:<Check/>}</div><div><b>{l.label}</b>{l.detail&&<small>{l.detail}</small>}</div><span>{l.state.toUpperCase()}</span></div>)}</div>
          </section>

          {(files.length>0 || result) && <section className="section-block"><div className="section-heading"><div><div className="eyebrow">04 / OUTPUT</div><h2>Project artifacts</h2></div></div>{result&&<div className="panel result-panel"><b>Agent report</b><p>{result}</p>{repoUrl&&<a href={repoUrl} target="_blank" rel="noreferrer">Open GitHub repository <ExternalLink size={14}/></a>}</div>}{files.length>0&&<div className="panel code-panel"><div className="file-list">{files.map(f=><button className={activeFile===f.path?"active":""} key={f.path} onClick={()=>setActiveFile(f.path)}><Code2 size={14}/>{f.path}</button>)}</div><pre>{current?.content || "Select a file"}</pre></div>}</section>}
          <footer><span>NOVA AI © 2026</span><span>BUILT FOR THE WORK, NOT THE HYPE.</span></footer>
        </div>
      </section>
    </main>
  );
}
