import { fetchModels, LlmError, openrouterFreeTier } from "@/lib/llm";
import { PROVIDER_MAP } from "@/lib/providers";
import type { ProviderId } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { provider, key } = (await req.json()) as { provider: ProviderId; key: string };
    if (!provider || !PROVIDER_MAP[provider]) return Response.json({ error: "Unknown provider" }, { status: 400 });
    if (!key || key.length < 8) return Response.json({ error: "API key missing" }, { status: 400 });
    const [models, freeTier] = await Promise.all([
      fetchModels(provider, key.trim()),
      provider === "openrouter" ? openrouterFreeTier(key.trim()) : Promise.resolve(undefined),
    ]);
    return Response.json({ models, freeTier });
  } catch (e) {
    const status = e instanceof LlmError ? e.status : 500;
    const message = e instanceof Error ? e.message : "Failed to load models";
    return Response.json({ error: message }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}
