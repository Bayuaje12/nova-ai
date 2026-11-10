import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
type GeneratedFile = { path: string; content: string };
const MODEL_FALLBACKS = ["gemini-2.5-flash", "gemini-2.0-flash"];

async function callGemini(apiKey: string, prompt: string) {
  const listRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": apiKey }, cache: "no-store" });
  if (!listRes.ok) throw new Error("Gemini API key tidak valid atau tidak memiliki akses model.");
  const list = await listRes.json();
  const models: string[] = (list.models || []).filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent") && /flash|pro/i.test(m.name)).map((m: any) => m.name.replace("models/", ""));
  const chosen = [...MODEL_FALLBACKS.filter(m => models.includes(m)), ...models].find(Boolean);
  if (!chosen) throw new Error("Tidak ditemukan model Gemini yang mendukung generateContent pada API key ini.");
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${chosen}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: "You are NOVA, an autonomous senior full-stack engineer and distinctive product designer. Return only valid JSON, no markdown fences. Generate a coherent, runnable project. Avoid generic AI-template aesthetics; make a deliberate visual identity based on the brief. Never include secrets. Prefer a sensible stack and include README instructions. Limit output to 12 files and keep each file reasonably concise." }] }, contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.65, responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { summary: { type: "STRING" }, files: { type: "ARRAY", items: { type: "OBJECT", properties: { path: { type: "STRING" }, content: { type: "STRING" } }, required: ["path", "content"] } } }, required: ["summary", "files"] } })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || `Gemini request failed (${r.status}).`);
  const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
  return { model: chosen, output: JSON.parse(text) as { summary: string; files: GeneratedFile[] } };
}

async function githubRequest(path: string, token: string, method = "GET", body?: unknown) {
  const r = await fetch(`https://api.github.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || `GitHub API error ${r.status}`);
  return data;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { apiKey, githubToken, prompt, mode, repoUrl, repoName, visibility } = body;
    if (!apiKey || !prompt) return NextResponse.json({ error: "Gemini API key dan instruksi wajib diisi." }, { status: 400 });
    if (mode !== "audit" && !githubToken) return NextResponse.json({ error: "GitHub token wajib diisi." }, { status: 400 });
    if (mode !== "create" && !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(repoUrl || "")) return NextResponse.json({ error: "URL repository GitHub tidak valid." }, { status: 400 });

    let existingContext = "";
    let owner = "";
    let repo = "";
    if (mode !== "create") {
      const parts = repoUrl.replace(/\/$/, "").split("/");
      owner = parts[parts.length - 2]; repo = parts[parts.length - 1];
      const tree = await githubRequest(`/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, githubToken);
      const blobs = (tree.tree || []).filter((x: any) => x.type === "blob" && x.size < 50000).slice(0, 25);
      existingContext = "Existing repository files (paths only):\n" + blobs.map((x: any) => x.path).join("\n");
      if (mode === "audit") return NextResponse.json({ summary: `Repository ${owner}/${repo} berisi ${blobs.length} file yang dapat diinspeksi pada batas audit awal. Untuk audit mendalam, jalankan perintah update dengan area spesifik.`, files: [], steps: ["Repository inspected", "File tree collected", "Audit summary generated"], repositoryUrl: repoUrl });
    }

    const task = `${mode.toUpperCase()} WEBSITE TASK\nUser request: ${prompt}\n${existingContext}\nReturn a runnable set of project files. For UPDATE, return only files that need to be added or changed, preserving the existing stack. Include README where useful.`;
    const { model, output } = await callGemini(apiKey, task);
    if (!Array.isArray(output.files) || output.files.length === 0) throw new Error("Gemini tidak menghasilkan file proyek.");
    const safeFiles = output.files.filter(f => typeof f.path === "string" && typeof f.content === "string" && !f.path.startsWith("/") && !f.path.split("/").includes("..") && !/(\.env($|\.)|id_rsa|credentials\.json)/i.test(f.path)).slice(0, 12);
    if (!safeFiles.length) throw new Error("Tidak ada file aman yang dapat dikirim.");

    let repositoryUrl = repoUrl || "";
    if (mode === "create") {
      const name = (repoName || prompt.slice(0, 35).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "nova-website").slice(0, 90);
      const created = await githubRequest("/user/repos", githubToken, "POST", { name, description: "Created with NOVA AI Website Agent", private: visibility === "private", auto_init: true });
      owner = created.owner.login; repo = created.name; repositoryUrl = created.html_url;
    }
    const repoInfo = await githubRequest(`/repos/${owner}/${repo}`, githubToken);
    const defaultBranch = repoInfo.default_branch || "main";
    const baseRef = await githubRequest(`/repos/${owner}/${repo}/git/ref/heads/${defaultBranch}`, githubToken);
    const baseCommit = await githubRequest(`/repos/${owner}/${repo}/git/commits/${baseRef.object.sha}`, githubToken);
    const treeItems = safeFiles.map(f => ({ path: f.path, mode: "100644", type: "blob", content: f.content }));
    const tree = await githubRequest(`/repos/${owner}/${repo}/git/trees`, githubToken, "POST", { base_tree: baseCommit.tree.sha, tree: treeItems });
    const commit = await githubRequest(`/repos/${owner}/${repo}/git/commits`, githubToken, "POST", { message: `NOVA: ${mode} website project`, tree: tree.sha, parents: [baseCommit.sha] });
    if (mode === "create") {
      await githubRequest(`/repos/${owner}/${repo}/git/refs/heads/${defaultBranch}`, githubToken, "PATCH", { sha: commit.sha });
    } else {
      const updateBranch = `nova/update-${Date.now()}`;
      await githubRequest(`/repos/${owner}/${repo}/git/refs`, githubToken, "POST", { ref: `refs/heads/${updateBranch}`, sha: commit.sha });
      repositoryUrl = `${repositoryUrl}/tree/${updateBranch}`;
    }
    return NextResponse.json({ summary: `${output.summary}\n\nModel used: ${model}. ${safeFiles.length} file dikirim ke GitHub. Untuk repository existing, perubahan ditulis ke branch yang sedang dipilih oleh endpoint ini; review diff sebelum merge.`, files: safeFiles, repositoryUrl, steps: ["Requirements analyzed", "Stack and design planned", `Generated with ${model}`, "Files validated", "GitHub commit pushed"] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected agent error." }, { status: 500 });
  }
}
