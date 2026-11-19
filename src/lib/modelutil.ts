import type { ModelInfo, ModelKind, ModelLite, ProviderId } from "./types";
import { PROVIDER_MAP } from "./providers";

const PREFIX_BRANDS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  "meta-llama": "Meta",
  meta: "Meta",
  mistralai: "Mistral AI",
  mistral: "Mistral AI",
  deepseek: "DeepSeek",
  "deepseek-ai": "DeepSeek",
  qwen: "Alibaba Qwen",
  alibaba: "Alibaba Qwen",
  "x-ai": "xAI",
  xai: "xAI",
  moonshotai: "Moonshot AI",
  moonshot: "Moonshot AI",
  "z-ai": "Z.ai",
  thudm: "Z.ai",
  zhipu: "Z.ai",
  minimax: "MiniMax",
  minimaxai: "MiniMax",
  nvidia: "NVIDIA",
  microsoft: "Microsoft",
  cohere: "Cohere",
  amazon: "Amazon",
  perplexity: "Perplexity",
  nousresearch: "Nous Research",
  tencent: "Tencent",
  baidu: "Baidu",
  stepfun: "StepFun",
  "stepfun-ai": "StepFun",
  ai21: "AI21",
  inflection: "Inflection",
  liquid: "Liquid AI",
  ibm: "IBM",
  "ibm-granite": "IBM",
  bytedance: "ByteDance",
  "black-forest-labs": "Black Forest Labs",
  sourceful: "Sourceful",
  "stabilityai": "Stability AI",
  openrouter: "OpenRouter",
  arcee: "Arcee AI",
  "arcee-ai": "Arcee AI",
  cognitivecomputations: "Cognitive Comp.",
  tngtech: "TNG Tech",
  allenai: "Allen AI",
  shisa: "Shisa AI",
  inception: "Inception",
  rekaai: "Reka",
  upstage: "Upstage",
  "01-ai": "01.AI",
  google_: "Google",
};

const PATTERN_BRANDS: [RegExp, string][] = [
  [/gpt|^o[1-9]|dall-e|chatgpt|davinci/, "OpenAI"],
  [/claude/, "Anthropic"],
  [/gemini|gemma|imagen|palm/, "Google"],
  [/llama/, "Meta"],
  [/deepseek/, "DeepSeek"],
  [/kimi|moonshot/, "Moonshot AI"],
  [/qwen|qwq/, "Alibaba Qwen"],
  [/mistral|mixtral|codestral|devstral|pixtral|ministral|magistral/, "Mistral AI"],
  [/grok/, "xAI"],
  [/glm|chatglm/, "Z.ai"],
  [/minimax/, "MiniMax"],
  [/command|aya/, "Cohere"],
  [/flux/, "Black Forest Labs"],
  [/stable-diffusion|sdxl|sd3/, "Stability AI"],
  [/nemotron/, "NVIDIA"],
  [/phi-/, "Microsoft"],
  [/sonar/, "Perplexity"],
  [/granite/, "IBM"],
  [/compound/, "Groq"],
];

export function brandOf(id: string, provider: ProviderId): string {
  const lower = id.toLowerCase();
  if (lower.includes("/")) {
    const prefix = lower.split("/")[0];
    if (PREFIX_BRANDS[prefix]) return PREFIX_BRANDS[prefix];
  }
  const tail = lower.includes("/") ? lower.split("/").slice(1).join("/") : lower;
  for (const [re, b] of PATTERN_BRANDS) if (re.test(tail)) return b;
  if (lower.includes("/")) {
    const p = lower.split("/")[0];
    return p.charAt(0).toUpperCase() + p.slice(1);
  }
  return PROVIDER_MAP[provider].label;
}

const BRAND_COLORS: Record<string, string> = {
  OpenAI: "#10a37f",
  Anthropic: "#d97757",
  Google: "#4285f4",
  Meta: "#0866ff",
  "Mistral AI": "#fa520f",
  DeepSeek: "#4d6bfe",
  "Alibaba Qwen": "#7c3aed",
  xAI: "#9ca3af",
  "Moonshot AI": "#16a0ff",
  "Z.ai": "#2563eb",
  MiniMax: "#ec4899",
  NVIDIA: "#76b900",
  Microsoft: "#00a4ef",
  Cohere: "#39594d",
  Perplexity: "#20b8cd",
  "Black Forest Labs": "#f59e0b",
  "Stability AI": "#a855f7",
};

export function brandColor(brand: string): string {
  if (BRAND_COLORS[brand]) return BRAND_COLORS[brand];
  let h = 0;
  for (let i = 0; i < brand.length; i++) h = (h * 31 + brand.charCodeAt(i)) % 360;
  return `hsl(${h} 65% 55%)`;
}

const NON_CHAT =
  /embed|whisper|tts|speech|transcri|moderation|guard|rerank|realtime|audio|dall-e|gpt-image|imagen|flux|stable-diffusion|sdxl|sd3|image|video|veo|sora|ocr|vision-preview|safety|classif|prompt-guard|orpheus|playai|lyria|aqa|computer-use|search-preview|bge-|e5-|nv-embed|parse|reward|^babbage|^davinci|-instruct-0914|text-/;

const IMAGE_RE = /dall-e|gpt-image|imagen|flux|stable-diffusion|sdxl|sd3|seedream|image-preview|-image|recraft|ideogram|riverflow/;
const CODE_RE = /code|coder|codestral|devstral|starcoder|codex|codellama|swe-/;

export function classify(id: string, outputModalities?: string[]): ModelKind | null {
  const s = id.toLowerCase();
  if (outputModalities && outputModalities.includes("image")) return "image";
  if (IMAGE_RE.test(s) && !/vision|vl\b|-vl-/.test(s)) return "image";
  if (NON_CHAT.test(s)) return null;
  if (CODE_RE.test(s)) return "code";
  return "chat";
}

const RULES: [RegExp, number][] = [
  [/gpt-5/, 97],
  [/claude-(opus|sonnet)-4|claude-4|claude-opus|claude-sonnet|claude-3[.-]7/, 95],
  [/gemini-3/, 96],
  [/gemini-2\.5-pro/, 93],
  [/grok-4/, 92],
  [/kimi-k2/, 91],
  [/o3|o4-mini/, 90],
  [/qwen3-(max|coder-480|235b)|qwen3-coder/, 89],
  [/deepseek-(r1|v3\.[12]|chat|reasoner|v3)/, 88],
  [/glm-(4\.[5-9]|5)/, 87],
  [/minimax-m[12]/, 86],
  [/gpt-4\.1/, 86],
  [/claude-3[.-]5|claude-haiku-4/, 85],
  [/gemini-2\.5-flash/, 85],
  [/gpt-oss-120b/, 83],
  [/gpt-4o/, 82],
  [/llama-4|llama-3\.1-405b/, 80],
  [/qwen3/, 79],
  [/mistral-(large|medium)|magistral|devstral/, 78],
  [/gemini-2/, 77],
  [/llama-3\.3-70b|nemotron.*(70|253|340)/, 76],
  [/gpt-oss/, 74],
  [/claude/, 76],
  [/gpt-4/, 72],
  [/gemma-3|gemma-2-27/, 66],
  [/qwen|mistral|llama|deepseek|gemini|grok|glm|kimi|phi|command/, 62],
];

export function scoreModel(id: string): number {
  const s = id.toLowerCase();
  let score = 52;
  for (const [re, base] of RULES) {
    if (re.test(s)) {
      score = base;
      break;
    }
  }
  const size = s.match(/(\d+(?:\.\d+)?)b(?![a-z])/);
  if (size) {
    const b = parseFloat(size[1]);
    score += Math.max(-8, Math.min(6, Math.log2(b / 30) * 1.8));
  }
  if (/mini|nano|lite|small|tiny|instant|haiku/.test(s) && !/haiku-4/.test(s)) score -= 6;
  if (/preview|exp\b|experimental/.test(s)) score -= 1;
  if (CODE_RE.test(s)) score += 2;
  return Math.round(score * 10) / 10;
}

export function prettyName(id: string): string {
  const tail = id.includes("/") ? id.split("/").slice(1).join("/") : id;
  return tail.replace(/:free$/, "").replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

export function toLite(m: ModelInfo): ModelLite {
  return {
    provider: m.provider,
    id: m.id,
    name: m.name,
    brand: m.brand,
    score: m.score,
    free: m.free,
    kind: m.kind,
  };
}

export function rankModels<T extends { score: number; free: boolean }>(list: T[]): T[] {
  return [...list].sort((a, b) => b.score - a.score);
}

/** Models usable for a mode, best first. */
export function modelsForMode(all: ModelInfo[], mode: "chat" | "code" | "image"): ModelInfo[] {
  if (mode === "image") return rankModels(all.filter((m) => m.kind === "image"));
  if (mode === "code") {
    const code = rankModels(all.filter((m) => m.kind === "code")).map((m) => ({ ...m, score: m.score + 3 }));
    const general = all.filter((m) => m.kind === "chat");
    return rankModels([...code, ...general]);
  }
  return rankModels(all.filter((m) => m.kind === "chat" || m.kind === "code"));
}
