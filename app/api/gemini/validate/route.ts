import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (typeof token !== "string" || !token.trim()) return NextResponse.json({ error: "API key wajib diisi." }, { status: 400 });
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", { headers: { "x-goog-api-key": token }, cache: "no-store" });
    if (!r.ok) return NextResponse.json({ error: `Gemini menolak API key (${r.status}). Periksa key dan akses API.` }, { status: 401 });
    return NextResponse.json({ message: "Gemini API key valid." });
  } catch { return NextResponse.json({ error: "Tidak dapat menghubungi Gemini." }, { status: 502 }); }
}
