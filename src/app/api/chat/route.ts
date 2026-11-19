import { chatStream, LlmError, type LlmMessage } from "@/lib/llm";
import { PROVIDER_MAP } from "@/lib/providers";
import type { ProviderId } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const SYSTEMS = {
  chat: "You are Orvix, a brilliant, warm and precise AI assistant. Answer clearly in Markdown. Be concise unless depth is requested. Reply in the user's language.",
  code: "You are Orvix Code, an expert senior software engineer. Write correct, complete, idiomatic code in fenced Markdown code blocks with the language tag. Briefly explain key decisions, point out edge cases, and prefer modern best practices.",
} as const;

export async function POST(req: Request) {
  let body: {
    provider: ProviderId;
    key: string;
    model: string;
    mode?: "chat" | "code";
    messages: LlmMessage[];
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const { provider, key, model, messages } = body;
  if (!provider || !PROVIDER_MAP[provider] || !key || !model || !Array.isArray(messages)) {
    return Response.json({ error: "Missing provider, key, model or messages" }, { status: 400 });
  }
  const system = SYSTEMS[body.mode === "code" ? "code" : "chat"];
  const full: LlmMessage[] = [{ role: "system", content: system }, ...messages.slice(-40)];

  const gen = chatStream({ provider, key: key.trim(), model, messages: full, signal: req.signal });
  let first: IteratorResult<string>;
  try {
    first = await gen.next();
  } catch (e) {
    const status = e instanceof LlmError ? e.status : 502;
    const message = e instanceof Error ? e.message : "Model request failed";
    return Response.json({ error: message }, { status: status >= 400 && status < 600 ? status : 502 });
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done) controller.enqueue(enc.encode(first.value));
        while (!first.done) {
          const n = await gen.next();
          if (n.done) break;
          controller.enqueue(enc.encode(n.value));
        }
        controller.close();
      } catch (e) {
        try {
          controller.error(e);
        } catch {
          /* closed */
        }
      }
    },
    cancel() {
      void gen.return(undefined);
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
