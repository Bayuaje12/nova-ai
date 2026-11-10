import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (typeof token !== "string" || !token.trim()) return NextResponse.json({ error: "GitHub token wajib diisi." }, { status: 400 });
    const r = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, cache: "no-store" });
    if (!r.ok) return NextResponse.json({ error: `GitHub menolak token (${r.status}). Periksa token dan permission-nya.` }, { status: 401 });
    const user = await r.json();
    return NextResponse.json({ message: `Terhubung sebagai ${user.login}.`, login: user.login });
  } catch { return NextResponse.json({ error: "Tidak dapat menghubungi GitHub." }, { status: 502 }); }
}
