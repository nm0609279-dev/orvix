import type { ProviderId } from "./types";

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  base: string;
  hint: string;
  freeTier?: boolean;
  docs: string;
}

export const PROVIDERS: ProviderConfig[] = [
  { id: "openrouter", label: "OpenRouter", base: "https://openrouter.ai/api/v1", hint: "sk-or-v1-…", freeTier: true, docs: "https://openrouter.ai/keys" },
  { id: "openai", label: "OpenAI", base: "https://api.openai.com/v1", hint: "sk-proj-…", docs: "https://platform.openai.com/api-keys" },
  { id: "anthropic", label: "Anthropic", base: "https://api.anthropic.com/v1", hint: "sk-ant-…", docs: "https://console.anthropic.com/settings/keys" },
  { id: "google", label: "Google Gemini", base: "https://generativelanguage.googleapis.com/v1beta/openai", hint: "AIza…", freeTier: true, docs: "https://aistudio.google.com/apikey" },
  { id: "groq", label: "Groq", base: "https://api.groq.com/openai/v1", hint: "gsk_…", freeTier: true, docs: "https://console.groq.com/keys" },
  { id: "deepseek", label: "DeepSeek", base: "https://api.deepseek.com/v1", hint: "sk-…", docs: "https://platform.deepseek.com/api_keys" },
  { id: "moonshot", label: "Moonshot (Kimi)", base: "https://api.moonshot.ai/v1", hint: "sk-…", docs: "https://platform.moonshot.ai/console/api-keys" },
  { id: "mistral", label: "Mistral", base: "https://api.mistral.ai/v1", hint: "API key", freeTier: true, docs: "https://console.mistral.ai/api-keys" },
  { id: "xai", label: "xAI (Grok)", base: "https://api.x.ai/v1", hint: "xai-…", docs: "https://console.x.ai" },
  { id: "together", label: "Together AI", base: "https://api.together.xyz/v1", hint: "API key", docs: "https://api.together.ai/settings/api-keys" },
  { id: "cerebras", label: "Cerebras", base: "https://api.cerebras.ai/v1", hint: "csk-…", freeTier: true, docs: "https://cloud.cerebras.ai" },
  { id: "nvidia", label: "NVIDIA NIM", base: "https://integrate.api.nvidia.com/v1", hint: "nvapi-…", freeTier: true, docs: "https://build.nvidia.com" },
];

export const PROVIDER_MAP: Record<ProviderId, ProviderConfig> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p]),
) as Record<ProviderId, ProviderConfig>;

export function detectProvider(key: string): ProviderId | null {
  const k = key.trim();
  if (k.startsWith("sk-or-")) return "openrouter";
  if (k.startsWith("sk-ant-")) return "anthropic";
  if (k.startsWith("AIza")) return "google";
  if (k.startsWith("gsk_")) return "groq";
  if (k.startsWith("nvapi-")) return "nvidia";
  if (k.startsWith("xai-")) return "xai";
  if (k.startsWith("csk-")) return "cerebras";
  if (k.startsWith("sk-proj-")) return "openai";
  if (k.startsWith("sk-")) return "openai";
  return null;
}
