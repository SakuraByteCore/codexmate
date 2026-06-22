export const SESSION_TRASH_LIST_LIMIT = 500;
export const SESSION_TRASH_PAGE_SIZE = 200;
export const DEFAULT_MODEL_CONTEXT_WINDOW = 190000;
export const DEFAULT_MODEL_AUTO_COMPACT_TOKEN_LIMIT = 185000;
export const OPENCODE_MODEL_CATALOG = Object.freeze({
  anthropic: Object.freeze(['claude-4-sonnet', 'claude-4-opus', 'claude-3.7-sonnet', 'claude-3.5-sonnet']),
  openai: Object.freeze(['gpt-4.1', 'gpt-4o', 'o4-mini', 'o3-mini']),
  gemini: Object.freeze(['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro']),
  groq: Object.freeze(['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']),
  openrouter: Object.freeze(['anthropic/claude-3.7-sonnet', 'openai/gpt-4.1', 'google/gemini-2.5-pro']),
  copilot: Object.freeze(['gpt-4o', 'claude-3.7-sonnet']),
  azure: Object.freeze(['gpt-4.1', 'gpt-4o']),
  bedrock: Object.freeze(['anthropic.claude-3-7-sonnet-20250219-v1:0']),
  vertexai: Object.freeze(['gemini-2.5-pro', 'gemini-2.5-flash']),
  xai: Object.freeze(['grok-3', 'grok-3-mini']),
  local: Object.freeze(['local.model'])
});
export const DEFAULT_OPENCLAW_TEMPLATE = `{
  // OpenClaw config (JSON5)
  agent: {
    model: "gpt-4.1"
  },
  agents: {
    defaults: {
      workspace: "~/.openclaw/workspace"
    }
  }
}`;
