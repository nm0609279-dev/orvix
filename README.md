# Orvix — every model, one place

Orvix is a multi-agent AI platform. Bring your own API keys and chat, code,
generate images, and run multi-agent teams that split a goal across specialized
agents (lead orchestrator, builders, reviewers) and merge the result into one
deliverable.

## Quick start

```bash
npm install
npm run dev        # development
# or
npm run build && npm run start   # production
```

Open the app, click the key icon (**Settings → API keys**) and paste a key from
any supported provider. Free-tier providers (no credit card required) include
Google Gemini, Groq, Mistral, OpenRouter `:free` models, Cerebras and NVIDIA NIM.

## Modes

- **Chat** — concise assistant, replies in your language
- **Code** — senior-engineer mode with complete, idiomatic code
- **Image** — image generation (OpenAI, Google, Together, xAI, OpenRouter)
- **Agent** — multi-agent team: Alex (lead) plans, builders work in parallel,
  reviewers hunt for problems, builders revise, Alex assembles the final answer

## Environment

- `DATABASE_URL` — only used by `/api/health` (Postgres). The UI and all LLM
  features work without a database; the health check returns `{"ok":false}`
  until a Postgres instance is reachable.
- API keys are entered in the browser and are never stored server-side.

## Notes

- `/api/chat`, `/api/agent`, `/api/image`, `/api/models` call the provider
  directly from the Next.js server, so the host running Orvix must be able to
  reach the provider endpoints over the network.

## Scripts

- `npm run dev` — dev server
- `npm run build` / `npm run start` — production build / serve
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript, no emit
