import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY not configured" },
      { status: 500 }
    );
  }

  const formData = await req.formData();
  const audio = formData.get("file");
  if (!audio) {
    return NextResponse.json({ error: "No audio file" }, { status: 400 });
  }

  const groqForm = new FormData();
  groqForm.append("file", audio);
  groqForm.append("model", "whisper-large-v3-turbo");
  groqForm.append("response_format", "json");

  const res = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      body: groqForm,
      headers: { Authorization: `Bearer ${groqKey}` },
      method: "POST",
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json(
      { error: `Groq API error: ${err}` },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json({ text: data.text });
}
