// common.js
// This file should now primarily contain model *names* and other shared constants,
// but not API keys or external URLs which are now in config/api.js

module.exports = {
  // Server Configuration
  SERVER_PORT: process.env.SERVER_PORT || 3003, // Can be overridden by .env
  JSON_BODY_LIMIT: '100mb', // Max size for JSON request bodies

  // LLM Model Identifiers (these are strings, not API keys or URLs)
  GOOGLE_GEMINI_MODEL: process.env.GOOGLE_GEMINI_MODEL || "gemini-2.5-pro",
  DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || "deepseek-chat",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-5.1-2025-11-13",
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || "claude-3-haiku-20240307",
  OPEN_ROUTER_MODEL: process.env.OPEN_ROUTER_MODEL || "x-ai/grok-4-fast", // Example, adjust as needed

  // Max tokens for models (these can be API specific, or general defaults)
  DEEPSEEK_MAX_TOKENS: parseInt(process.env.DEEPSEEK_MAX_TOKENS || '1024'),
  OPENAI_MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS || '1024'),
  ANTHROPIC_MAX_TOKENS: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '1024'),

  // URLs (these should ideally be moved to config/api.js if they are external API URLs)
  // For now, keeping them here as they were in your original common.js,
  // but note that config/api.js might override/redefine if it imports from process.env
  DEEPSEEK_URL: process.env.DEEPSEEK_URL || "https://api.deepseek.com/chat/completions",
  OPENAI_URL: process.env.OPENAI_URL || "https://api.openai.com/v1/chat/completions",
  OPEN_ROUTER_URL: process.env.OPEN_ROUTER_URL || "https://openrouter.ai/api/v1/chat/completions",

  // Model identifiers and display names (can be used for UI)
  modelIdentifiers: ['gemini', 'deepseek', 'gpt', 'claude', 'grok'], // Renamed 'openai' to 'gpt' to match MODEL_CONFIGS
  modelsConfig: [
    { id: 'gemini', name: 'Google Gemini', defaultChecked: true, color: 'blue' },
    { id: 'deepseek', name: 'Deepseek', defaultChecked: false, color: 'green' },
    { id: 'gpt', name: 'OpenAI GPT', defaultChecked: false, color: 'purple' }, // Renamed here
    { id: 'claude', name: 'Anthropic Claude', defaultChecked: false, color: 'red' },
    { id: 'grok', name: 'Grok', defaultChecked: false, color: 'orange' },
  ],
};