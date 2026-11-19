import { chatComplete, chatStream, type LlmMessage } from "@/lib/llm";
import type { AgentEvent, AgentInfo, AgentStatus, ModelLite, ProviderId } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 800;

interface Body {
  prompt: string;
  history?: { role: "user" | "assistant"; content: string }[];
  teamSize?: number;
  keys: Partial<Record<ProviderId, string>>;
  models: ModelLite[];
}

interface Agent extends AgentInfo {
  modelId: string;
  inbox: { from: string; text: string }[];
}

const NAMES = [
  "Alex", "Nova", "Mira", "Kai", "Zane", "Luna", "Orion", "Sage", "Echo", "Iris",
  "Atlas", "Juno", "Pixel", "Vega", "Rhea", "Milo", "Ada", "Leo", "Tess", "Finn",
];
const BUILDER_ROLES = [
  "Architect", "Core Logic Engineer", "UI & Visual Designer", "Interaction Engineer", "State & Data Engineer",
  "Animation Specialist", "Content Writer", "Integration Engineer", "API Designer", "Performance Engineer",
  "Accessibility Specialist", "Test Author", "Docs Writer",
];
const REVIEWER_ROLES = [
  "Bug Hunter", "Integration Checker", "Security & Quality Auditor", "UX & Polish Reviewer",
  "Performance Reviewer", "Completeness Checker",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pool<T>(items: T[], limit: number, fn: (t: T, i: number) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

function pickTeam(cands: ModelLite[], n: number): ModelLite[] {
  const sorted = [...cands].sort((a, b) => b.score - a.score);
  const byBrand = new Map<string, ModelLite[]>();
  for (const m of sorted) {
    const l = byBrand.get(m.brand) || [];
    l.push(m);
    byBrand.set(m.brand, l);
  }
  const brands = [...byBrand.values()].sort((a, b) => b[0].score - a[0].score);
  const picked: ModelLite[] = [];
  for (let round = 0; picked.length < n && picked.length < sorted.length; round++) {
    for (const list of brands) {
      if (list[round] && picked.length < n) picked.push(list[round]);
    }
  }
  picked.sort((a, b) => b.score - a.score);
  // Alex should be a general chat model when possible
  const chatIdx = picked.findIndex((m) => m.kind === "chat");
  if (chatIdx > 0) picked.unshift(...picked.splice(chatIdx, 1));
  const out = [...picked];
  for (let i = 0; out.length < n && picked.length; i++) out.push(picked[i % picked.length]);
  return out;
}

function parseAgentLines(text: string, names: string[], self: string) {
  const canon = new Map(names.map((n) => [n.toLowerCase(), n]));
  const msgs: { to: string; text: string }[] = [];
  let report: string | undefined;
  const kept: string[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*[*_>\-\s]*@([A-Za-z]+)\s*[:\u2014-]\s*(.+)$/);
    if (m && canon.has(m[1].toLowerCase()) && canon.get(m[1].toLowerCase()) !== self) {
      msgs.push({ to: canon.get(m[1].toLowerCase())!, text: m[2].trim().slice(0, 600) });
      continue;
    }
    const r = line.match(/^\s*[*_]*REPORT[*_]*\s*:\s*(.+)$/i);
    if (r) {
      report = r[1].replace(/[*_]+$/, "").trim().slice(0, 400);
      continue;
    }
    kept.push(line);
  }
  return { clean: kept.join("\n").trim(), msgs, report };
}

function extractJson(text: string): { summary?: string; tasks?: { title?: string; role?: string; instructions?: string }[] } | null {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(text.slice(a, b + 1));
  } catch {
    return null;
  }
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "\n…[truncated]" : s);

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const prompt = (body.prompt || "").trim();
  const cands = (body.models || []).filter((m) => body.keys?.[m.provider] && (m.kind === "chat" || m.kind === "code"));
  if (!prompt) return Response.json({ error: "Empty prompt" }, { status: 400 });
  if (!cands.length) {
    return Response.json({ error: "No chat models available. Add an API key in Settings first." }, { status: 400 });
  }
  const n = Math.max(3, Math.min(20, Math.round(body.teamSize || 12)));
  const signal = req.signal;
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (ev: AgentEvent) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
        } catch {
          closed = true;
        }
      };
      const ping = setInterval(() => send({ type: "ping" }), 10_000);

      try {
        /* ---------- assemble the team ---------- */
        const picked = pickTeam(cands, n);
        const reviewersN = Math.max(1, Math.round((n - 1) / 3));
        const buildersN = n - 1 - reviewersN;
        const sortedCands = [...cands].sort((a, b) => b.score - a.score);

        const agents: Agent[] = picked.map((m, i) => {
          const kind = i === 0 ? "lead" : i <= buildersN ? "builder" : "reviewer";
          return {
            name: NAMES[i],
            role: i === 0 ? "Lead Orchestrator" : kind === "builder" ? BUILDER_ROLES[(i - 1) % BUILDER_ROLES.length] : REVIEWER_ROLES[(i - 1 - buildersN) % REVIEWER_ROLES.length],
            kind,
            model: `${m.provider}::${m.id}`,
            modelId: m.id,
            modelName: m.name,
            brand: m.brand,
            provider: m.provider,
            status: "idle" as AgentStatus,
            inbox: [],
          };
        });
        const alex = agents[0];
        const builders = agents.filter((a) => a.kind === "builder");
        const reviewers = agents.filter((a) => a.kind === "reviewer");
        const names = agents.map((a) => a.name);
        const publicAgent = (a: Agent): AgentInfo => ({
          name: a.name, role: a.role, kind: a.kind, model: a.model, modelName: a.modelName,
          brand: a.brand, provider: a.provider, status: a.status, note: a.note,
        });
        send({ type: "team", agents: agents.map(publicAgent) });

        const setStatus = (a: Agent, status: AgentStatus, note?: string) => {
          a.status = status;
          a.note = note;
          send({ type: "status", name: a.name, status, note, model: a.model, modelName: a.modelName });
        };

        /** Call an agent's model with retries + automatic fallback to other strong models */
        const callAgent = async (a: Agent, messages: LlmMessage[], maxTokens: number): Promise<string> => {
          const order: ModelLite[] = [
            sortedCands.find((m) => m.provider === a.provider && m.id === a.modelId) || sortedCands[0],
            ...sortedCands.filter((m) => !(m.provider === a.provider && m.id === a.modelId)).slice(0, 5),
          ];
          let lastErr: unknown = new Error("No model available");
          for (let mi = 0; mi < Math.min(order.length, 4); mi++) {
            const m = order[mi];
            const key = body.keys[m.provider]!;
            for (let attempt = 0; attempt < 2; attempt++) {
              if (signal.aborted) throw new Error("aborted");
              try {
                const text = await chatComplete({ provider: m.provider, key, model: m.id, messages, signal, maxTokens });
                if (!(m.provider === a.provider && m.id === a.modelId)) {
                  a.provider = m.provider;
                  a.modelId = m.id;
                  a.model = `${m.provider}::${m.id}`;
                  a.modelName = m.name;
                  a.brand = m.brand;
                  send({ type: "status", name: a.name, status: a.status, note: `switched to ${m.name}`, model: a.model, modelName: a.modelName });
                }
                return text;
              } catch (e) {
                lastErr = e;
                if (signal.aborted) throw e;
                const st = (e as { status?: number }).status ?? 0;
                if (st === 401 || st === 403 || st === 404 || st === 400) break;
                await sleep(st === 429 ? 3000 * (attempt + 1) : 800);
              }
            }
          }
          throw lastErr;
        };

        const roster = agents.map((a) => `- ${a.name} (${a.role})`).join("\n");
        const ctx = (body.history || [])
          .slice(-6)
          .map((h) => `${h.role.toUpperCase()}: ${clip(h.content, 1200)}`)
          .join("\n\n");
        const goal = (ctx ? `Conversation so far:\n${ctx}\n\n` : "") + `USER REQUEST:\n${prompt}`;

        /* ---------- phase 1: Alex plans ---------- */
        send({ type: "phase", label: "Alex is planning the work" });
        setStatus(alex, "working", "Breaking the request into chunks");
        let summary = "";
        let tasks: { title: string; role: string; instructions: string }[] = [];
        try {
          const planText = await callAgent(
            alex,
            [
              {
                role: "system",
                content: `You are Alex, the lead orchestrator of an AI team. Team:\n${roster}\n\nSplit the user's request into exactly ${buildersN} independent, concrete chunks of work, one per builder (${builders.map((b) => b.name).join(", ")}), in that order. Each chunk must be a specific deliverable that fits together with the others. Respond with ONLY valid JSON, no prose:\n{"summary":"one-paragraph plan and how parts fit together (include shared conventions, e.g. names, file structure, interfaces)","tasks":[{"title":"short title","role":"specialty","instructions":"precise instructions"}]}`,
              },
              { role: "user", content: goal },
            ],
            2000,
          );
          const j = extractJson(planText);
          summary = j?.summary || "";
          tasks = (j?.tasks || []).map((t, i) => ({
            title: t.title || `Part ${i + 1}`,
            role: t.role || builders[i]?.role || "Engineer",
            instructions: t.instructions || t.title || "Contribute your part.",
          }));
        } catch {
          send({ type: "message", from: "Alex", to: "all", text: "Planning model hiccuped — using a default split." });
        }
        while (tasks.length < buildersN) {
          const i = tasks.length;
          tasks.push({
            title: `${builders[i].role} part`,
            role: builders[i].role,
            instructions: `Handle the "${builders[i].role}" aspect of the request. Cover everything a ${builders[i].role} would deliver.`,
          });
        }
        tasks = tasks.slice(0, buildersN);
        builders.forEach((b, i) => {
          b.role = tasks[i].role.slice(0, 40);
        });
        setStatus(alex, "done", "Plan ready");
        send({ type: "team", agents: agents.map(publicAgent) });
        send({ type: "message", from: "Alex", to: "all", text: summary ? clip(summary, 700) : `Plan ready — ${buildersN} builders and ${reviewersN} reviewers are on it.` });
        builders.forEach((b, i) => send({ type: "message", from: "Alex", to: b.name, text: `${tasks[i].title}: ${clip(tasks[i].instructions, 260)}` }));

        const outputs: Record<string, string> = {};
        const reports: Record<string, string> = {};
        const deliver = (from: string, msgs: { to: string; text: string }[]) => {
          for (const m of msgs) {
            send({ type: "message", from, to: m.to, text: m.text });
            const target = agents.find((a) => a.name === m.to);
            if (target) target.inbox.push({ from, text: m.text });
          }
        };

        /* ---------- phase 2: builders work in parallel ---------- */
        send({ type: "phase", label: `${buildersN} builders working in parallel` });
        await pool(builders, 3, async (b, i) => {
          if (signal.aborted) return;
          setStatus(b, "working", tasks[i].title);
          try {
            const text = await callAgent(
              b,
              [
                {
                  role: "system",
                  content: `You are ${b.name}, ${b.role} on an AI team led by Alex.\nTeam:\n${roster}\n\nTeam plan: ${summary || "Split the work and deliver your part."}\n\nYour task: ${tasks[i].title}\n${tasks[i].instructions}\n\nDeliver YOUR part completely and concretely (use fenced code blocks for code). No filler. Keep it focused; other teammates cover the rest.\nIf you need to tell a teammate something (interface, naming, dependency, question), add lines at the very end in the form "@Name: message" (max 3).\nFinish with one line: "REPORT: one-sentence status report for Alex".`,
                },
                { role: "user", content: goal },
              ],
              3500,
            );
            const p = parseAgentLines(text, names, b.name);
            outputs[b.name] = p.clean;
            send({ type: "output", name: b.name, text: p.clean });
            deliver(b.name, p.msgs);
            reports[b.name] = p.report || "Finished my part.";
            send({ type: "message", from: b.name, to: "Alex", text: reports[b.name] });
            setStatus(b, "done", "Draft delivered");
          } catch {
            setStatus(b, "failed", "Could not complete");
            send({ type: "message", from: b.name, to: "Alex", text: "I couldn't finish my part (model unavailable)." });
          }
        });

        /* ---------- phase 3: reviewers hunt for problems ---------- */
        const done = builders.filter((b) => outputs[b.name]);
        if (done.length && !signal.aborted) {
          send({ type: "phase", label: `${reviewers.length} reviewers checking for problems` });
          await pool(reviewers, 3, async (r, ri) => {
            if (signal.aborted) return;
            let assigned = done.filter((_, i) => i % reviewers.length === ri);
            if (!assigned.length) assigned = done;
            setStatus(r, "working", `Reviewing ${assigned.map((a) => a.name).join(", ")}`);
            try {
              const text = await callAgent(
                r,
                [
                  {
                    role: "system",
                    content: `You are ${r.name}, ${r.role} on an AI team led by Alex.\nTeam:\n${roster}\n\nReview your teammates' work against the user's goal. Find REAL, concrete problems: bugs, inconsistencies with other parts, missing pieces, weak quality. For each issue send it to the author as a line "@Name: the issue and the exact fix" (max 6 lines total, most important first). If everything is solid, say so briefly. Finish with one line: "REPORT: one-sentence verdict for Alex".`,
                  },
                  {
                    role: "user",
                    content: `${goal}\n\n=== TEAM PLAN ===\n${summary}\n\n${assigned
                      .map((a) => `=== WORK BY ${a.name} (${a.role}) ===\n${clip(outputs[a.name], 5500)}`)
                      .join("\n\n")}`,
                  },
                ],
                1600,
              );
              const p = parseAgentLines(text, names, r.name);
              deliver(r.name, p.msgs);
              send({ type: "message", from: r.name, to: "Alex", text: p.report || (p.msgs.length ? `Found ${p.msgs.length} issue(s).` : "No major issues found.") });
              if (!p.msgs.length && p.clean) send({ type: "output", name: r.name, text: p.clean });
              else send({ type: "output", name: r.name, text: p.msgs.map((m) => `@${m.to}: ${m.text}`).join("\n") || p.clean });
              setStatus(r, "done", `${p.msgs.length} issue(s) raised`);
            } catch {
              setStatus(r, "failed", "Review failed");
            }
          });
        }

        /* ---------- phase 4: builders improve ---------- */
        const toRevise = done.filter((b) => b.inbox.length);
        if (toRevise.length && !signal.aborted) {
          send({ type: "phase", label: `${toRevise.length} builders applying feedback` });
          await pool(toRevise, 3, async (b) => {
            if (signal.aborted) return;
            setStatus(b, "working", `Applying ${b.inbox.length} note(s)`);
            const inboxText = b.inbox.map((m) => `- from ${m.from}: ${m.text}`).join("\n");
            try {
              const text = await callAgent(
                b,
                [
                  {
                    role: "system",
                    content: `You are ${b.name}, ${b.role}. Teammates and reviewers sent you feedback. Produce the FULL improved version of your part, fixing every valid issue (ignore feedback that is wrong). Output only your improved deliverable (code in fenced blocks), then one line "REPORT: what you changed".`,
                  },
                  {
                    role: "user",
                    content: `${goal}\n\n=== YOUR PREVIOUS WORK ===\n${clip(outputs[b.name], 6500)}\n\n=== FEEDBACK ===\n${inboxText}`,
                  },
                ],
                4000,
              );
              const p = parseAgentLines(text, names, b.name);
              if (p.clean.length > 40) {
                outputs[b.name] = p.clean;
                send({ type: "output", name: b.name, text: p.clean, revision: true });
              }
              send({ type: "message", from: b.name, to: "Alex", text: p.report || "Applied the feedback." });
              setStatus(b, "done", "Improved");
            } catch {
              setStatus(b, "done", "Kept original draft");
            }
          });
        }

        /* ---------- phase 5: Alex assembles ---------- */
        send({ type: "phase", label: "Alex is assembling the final answer" });
        setStatus(alex, "working", "Merging everything");
        const parts = Object.entries(outputs);
        const finalMessages: LlmMessage[] = [
          {
            role: "system",
            content: `You are Alex, lead orchestrator of an AI team. Your team has finished its work. Merge all parts into ONE cohesive, complete, polished final deliverable that fully satisfies the user's request. Resolve conflicts between parts, remove duplication, and make sure code fits together and runs. If the request is for a website/app, deliver complete, runnable code (prefer a single self-contained file unless the user asked otherwise). Open with 1-2 sentences, then the deliverable, then a short note on how to use it. Do not mention internal teamwork details beyond a brief credit line.`,
          },
          {
            role: "user",
            content: parts.length
              ? `${goal}\n\n=== TEAM PLAN ===\n${summary}\n\n${parts.map(([name, text]) => `=== ${name} (${agents.find((a) => a.name === name)?.role}) ===\n${clip(text, 9000)}`).join("\n\n")}\n\n=== REVIEWER/BUILDER REPORTS ===\n${Object.entries(reports).map(([k, v]) => `${k}: ${v}`).join("\n")}`
              : goal,
          },
        ];
        const order: ModelLite[] = [
          sortedCands.find((m) => m.provider === alex.provider && m.id === alex.modelId) || sortedCands[0],
          ...sortedCands.filter((m) => !(m.provider === alex.provider && m.id === alex.modelId)).slice(0, 4),
        ];
        let produced = false;
        let lastErr = "";
        for (const m of order) {
          if (signal.aborted) break;
          try {
            for await (const delta of chatStream({ provider: m.provider, key: body.keys[m.provider]!, model: m.id, messages: finalMessages, signal, maxTokens: 9000 })) {
              produced = true;
              send({ type: "final", delta });
            }
            break;
          } catch (e) {
            lastErr = e instanceof Error ? e.message : "error";
            if (produced) {
              send({ type: "final", delta: `\n\n_(stream interrupted: ${lastErr})_` });
              break;
            }
            if (((e as { status?: number }).status ?? 0) === 429) await sleep(3000);
          }
        }
        if (!produced) send({ type: "error", text: `Alex could not assemble the answer: ${lastErr || "no model responded"}` });
        setStatus(alex, "done", "Delivered");
        send({ type: "done" });
      } catch (e) {
        if (!signal.aborted) send({ type: "error", text: e instanceof Error ? e.message : "Agent run failed" });
      } finally {
        clearInterval(ping);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
