export type Mode = "chat" | "code" | "image" | "agent";
export type ModelKind = "chat" | "code" | "image";

export type ProviderId =
  | "openrouter"
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "deepseek"
  | "moonshot"
  | "mistral"
  | "xai"
  | "together"
  | "cerebras"
  | "nvidia";

export interface ModelInfo {
  /** unique: provider::id */
  key: string;
  id: string;
  name: string;
  provider: ProviderId;
  brand: string;
  kind: ModelKind;
  free: boolean;
  score: number;
  context?: number;
}

export interface KeyEntry {
  id: string;
  provider: ProviderId;
  key: string;
  addedAt: number;
  status: "ok" | "error" | "loading";
  error?: string;
  /** OpenRouter key without purchased credits: only :free models work */
  freeTier?: boolean;
  models: ModelInfo[];
}

export type AgentStatus = "idle" | "working" | "done" | "failed";
export type AgentRole = "lead" | "builder" | "reviewer";

export interface AgentInfo {
  name: string;
  role: string;
  kind: AgentRole;
  model: string;
  modelName: string;
  brand: string;
  provider: ProviderId;
  status: AgentStatus;
  note?: string;
}

export type AgentEvent =
  | { type: "team"; agents: AgentInfo[] }
  | { type: "phase"; label: string }
  | { type: "status"; name: string; status: AgentStatus; note?: string; model?: string; modelName?: string }
  | { type: "message"; from: string; to: string; text: string }
  | { type: "output"; name: string; text: string; revision?: boolean }
  | { type: "final"; delta: string }
  | { type: "error"; text: string }
  | { type: "ping" }
  | { type: "done" };

export interface FeedItem {
  id: number;
  kind: "phase" | "message" | "note";
  from?: string;
  to?: string;
  text: string;
}

export interface AgentRun {
  agents: AgentInfo[];
  feed: FeedItem[];
  outputs: Record<string, string>;
  phase: string;
  done: boolean;
}

export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** what to show in the bubble when content contains attached file bodies */
  shown?: string;
  files?: string[];
  images?: string[];
  model?: string;
  mode?: Mode;
  error?: boolean;
  agent?: AgentRun;
}

export interface Conversation {
  id: string;
  title: string;
  mode: Mode;
  createdAt: number;
  updatedAt: number;
  messages: ChatMsg[];
}

export interface ModelLite {
  provider: ProviderId;
  id: string;
  name: string;
  brand: string;
  score: number;
  free: boolean;
  kind: ModelKind;
}
