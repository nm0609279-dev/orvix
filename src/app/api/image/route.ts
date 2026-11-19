import { generateImage, LlmError } from "@/lib/llm";
import { PROVIDER_MAP } from "@/lib/providers";
import type { ProviderId } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { provider, key, model, prompt } = (await req.json()) as {
      provider: ProviderId;
      key: string;
      model: string;
      prompt: string;
    };
    if (!provider || !PROVIDER_MAP[provider] || !key || !model || !prompt) {
      return Response.json({ error: "Missing fields" }, { status: 400 });
    }
    const images = await generateImage({ provider, key: key.trim(), model, prompt, signal: req.signal });
    return Response.json({ images });
  } catch (e) {
    const status = e instanceof LlmError ? e.status : 500;
    const message = e instanceof Error ? e.message : "Image generation failed";
    return Response.json({ error: message }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}
