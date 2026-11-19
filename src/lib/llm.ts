import type { ModelInfo, ProviderId } from "./types";
import { PROVIDER_MAP } from "./providers";
import { brandOf, classify, prettyName, scoreModel } from "./modelutil";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmOpts {
  provider: ProviderId;
  key: string;
  model: string;
  messages: LlmMessage[];
  signal?: AbortSignal;
  maxTokens?: number;
  timeoutMs?: number;
}

export class LlmError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const t = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, t]) : t;
}

function extractError(text: string, status: number): string {
  try {
    const j = JSON.parse(text);
    const msg =
      j?.error?.message ||
      j?.error?.metadata?.raw ||
      (typeof j?.error === "string" ? j.error : undefined) ||
      j?.message ||
      j?.detail;
    if (msg) return String(typeof msg === "string" ? msg : JSON.stringify(msg)).slice(0, 400);
  } catch {
    /* not json */
  }
  return (text || `HTTP ${status}`).slice(0, 300);
}

function headersFor(provider: ProviderId, key: string): Record<string, string> {
  if (provider === "anthropic") {
    return { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" };
  }
  const h: Record<string, string> = { Authorization: `Bearer ${key}`, "content-type": "application/json" };
  if (provider === "openrouter") {
    h["HTTP-Referer"] = "https://orvix.app";
    h["X-Title"] = "Orvix";
  }
  return h;
}

async function* readSSE(res: Response): AsyncGenerator<string> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).replace(/\r$/, "");
        buf = buf.slice(idx + 1);
        if (line.startsWith("data:")) yield line.slice(5).trim();
      }
    }
    const rest = buf.trim();
    if (rest.startsWith("data:")) yield rest.slice(5).trim();
  } finally {
    reader.releaseLock();
  }
}

export async function* chatStream(opts: LlmOpts): AsyncGenerator<string> {
  const { provider, key, model, messages } = opts;
  const signal = withTimeout(opts.signal, opts.timeoutMs ?? 300_000);
  const base = PROVIDER_MAP[provider].base;
  let produced = false;

  if (provider === "anthropic") {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const msgs = messages.filter((m) => m.role !== "system");
    const res = await fetch(`${base}/messages`, {
      method: "POST",
      headers: headersFor(provider, key),
      signal,
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 8192,
        system: system || undefined,
        messages: msgs,
        stream: true,
      }),
    });
    if (!res.ok) throw new LlmError(res.status, extractError(await res.text(), res.status));
    for await (const data of readSSE(res)) {
      if (!data || data === "[DONE]") continue;
      let j;
      try {
        j = JSON.parse(data);
      } catch {
        continue;
      }
      if (j.type === "content_block_delta" && j.delta?.type === "text_delta" && j.delta.text) {
        produced = true;
        yield j.delta.text as string;
      } else if (j.type === "error") {
        throw new LlmError(502, j.error?.message || "Anthropic stream error");
      }
    }
    if (!produced) throw new LlmError(502, "Empty response from model");
    return;
  }

  const body: Record<string, unknown> = { model, messages, stream: true };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: headersFor(provider, key),
    signal,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new LlmError(res.status, extractError(await res.text(), res.status));
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const j = await res.json();
    if (j?.error) throw new LlmError(j.error.code || 502, extractError(JSON.stringify(j), 502));
    const text = j?.choices?.[0]?.message?.content;
    if (typeof text === "string" && text) {
      yield text;
      return;
    }
    throw new LlmError(502, "Empty response from model");
  }
  for await (const data of readSSE(res)) {
    if (!data || data === "[DONE]") continue;
    let j;
    try {
      j = JSON.parse(data);
    } catch {
      continue;
    }
    if (j.error) throw new LlmError(Number(j.error.code) || 502, extractError(JSON.stringify(j), 502));
    const delta = j.choices?.[0]?.delta?.content;
    if (typeof delta === "string" && delta) {
      produced = true;
      yield delta;
    }
  }
  if (!produced) throw new LlmError(502, "Empty response from model");
}

export async function chatComplete(opts: LlmOpts): Promise<string> {
  let out = "";
  for await (const chunk of chatStream({ ...opts, timeoutMs: opts.timeoutMs ?? 150_000 })) out += chunk;
  return out;
}

/* ------------------------------ models ------------------------------ */

interface RawModel {
  id: string;
  name?: string;
  display_name?: string;
  context_length?: number;
  architecture?: { output_modalities?: string[] };
  pricing?: { prompt?: string; completion?: string };
  type?: string;
}

export async function fetchModels(provider: ProviderId, key: string): Promise<ModelInfo[]> {
  const base = PROVIDER_MAP[provider].base;
  const signal = AbortSignal.timeout(25_000);
  let url = `${base}/models`;
  if (provider === "openrouter") url += "?output_modalities=all";
  if (provider === "anthropic") url += "?limit=100";
  let res = await fetch(url, { headers: headersFor(provider, key), signal });
  if (!res.ok && provider === "openrouter") {
    res = await fetch(`${base}/models`, { headers: headersFor(provider, key), signal });
  }
  if (!res.ok) throw new LlmError(res.status, extractError(await res.text(), res.status));
  const j = await res.json();
  const raw: RawModel[] = Array.isArray(j) ? j : j.data || j.models || [];
  const out: ModelInfo[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    let id = String(r.id || "");
    if (!id) continue;
    if (provider === "google") id = id.replace(/^models\//, "");
    if (seen.has(id)) continue;
    seen.add(id);
    let kind = classify(id, r.architecture?.output_modalities);
    if (provider === "together" && r.type) {
      if (r.type === "image") kind = "image";
      else if (r.type === "code") kind = "code";
      else if (r.type !== "chat" && r.type !== "language") kind = null;
    }
    if (!kind) continue;
    const free =
      id.endsWith(":free") ||
      (provider === "openrouter" && r.pricing?.prompt === "0" && r.pricing?.completion === "0");
    out.push({
      key: `${provider}::${id}`,
      id,
      name: r.name?.replace(/^[^:]+:\s*/, "") || r.display_name || prettyName(id),
      provider,
      brand: brandOf(id, provider),
      kind,
      free,
      score: scoreModel(id),
      context: r.context_length,
    });
  }
  return out;
}

export async function openrouterFreeTier(key: string): Promise<boolean | undefined> {
  try {
    const res = await fetch(`${PROVIDER_MAP.openrouter.base}/key`, {
      headers: headersFor("openrouter", key),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return undefined;
    const j = await res.json();
    return typeof j?.data?.is_free_tier === "boolean" ? j.data.is_free_tier : undefined;
  } catch {
    return undefined;
  }
}

/* ------------------------------ images ------------------------------ */

export async function generateImage(opts: {
  provider: ProviderId;
  key: string;
  model: string;
  prompt: string;
  signal?: AbortSignal;
}): Promise<string[]> {
  const { provider, key, model, prompt } = opts;
  const signal = withTimeout(opts.signal, 180_000);
  const base = PROVIDER_MAP[provider].base;

  if (provider === "openrouter") {
    const attempt = async (modalities: string[]) => {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: headersFor(provider, key),
        signal,
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], modalities }),
      });
      if (!res.ok) throw new LlmError(res.status, extractError(await res.text(), res.status));
      const j = await res.json();
      if (j?.error) throw new LlmError(502, extractError(JSON.stringify(j), 502));
      const imgs: string[] = (j?.choices?.[0]?.message?.images || [])
        .map((i: { image_url?: { url?: string } }) => i?.image_url?.url)
        .filter(Boolean);
      return imgs;
    };
    let imgs: string[] = [];
    try {
      imgs = await attempt(["image", "text"]);
    } catch (e) {
      if (e instanceof LlmError && (e.status === 400 || e.status === 404)) imgs = await attempt(["image"]);
      else throw e;
    }
    if (!imgs.length) throw new LlmError(502, "The model returned no image");
    return imgs;
  }

  if (["openai", "google", "together", "xai"].includes(provider)) {
    const body: Record<string, unknown> = { model, prompt, n: 1 };
    if (provider !== "openai") body.response_format = "b64_json";
    const res = await fetch(`${base}/images/generations`, {
      method: "POST",
      headers: headersFor(provider, key),
      signal,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new LlmError(res.status, extractError(await res.text(), res.status));
    const j = await res.json();
    const imgs: string[] = (j?.data || [])
      .map((d: { url?: string; b64_json?: string }) =>
        d.b64_json ? `data:image/png;base64,${d.b64_json}` : d.url,
      )
      .filter(Boolean);
    if (!imgs.length) throw new LlmError(502, "The model returned no image");
    return imgs;
  }

  throw new LlmError(400, `Image generation is not supported for ${PROVIDER_MAP[provider].label} keys`);
}
