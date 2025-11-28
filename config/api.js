// config/api.js
const {
  GOOGLE_API_KEY,
  DEEPSEEK_API_KEY,
  OPENAI_API_KEY,
  ANTHROPIC_API_KEY,
  OPEN_ROUTER_API_KEY,
} = require('./secrets');
// --- FIX: Add .js extension ---
const {
  GOOGLE_GEMINI_MODEL,
  ANTHROPIC_MODEL,
  DEEPSEEK_MODEL,
  OPENAI_MODEL,
  OPEN_ROUTER_MODEL
} = require('../common.js'); // <-- ADDED .js
const {
  DEEPSEEK_URL,
  OPENAI_URL,
  OPEN_ROUTER_URL,
  ANTHROPIC_MAX_TOKENS,
  DEEPSEEK_MAX_TOKENS,
  OPENAI_MAX_TOKENS
} = require('../common.js'); // <-- ADDED .js

// Google API Specific URLs
const UPLOAD_BASE_URL = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const BATCH_GENERATE_CONTENT_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:batchGenerateContent";
const BASE_GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/";

/**
 * Model-specific configurations for LLM API calls.
 * This object defines how to interact with each LLM (URL, payload structure, response parsing, etc.).
 */
const MODEL_CONFIGS = {
  gemini: {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_GEMINI_MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
    maxTokens: Infinity, // Gemini doesn't have a single max_tokens param like others for basic chat
    initialHistory: [],
    formatUserMessage: (input) => ({ role: "user", parts: [{ text: input }] }),
    formatAssistantMessage: (content) => ({ role: "model", parts: [{ text: content }] }),
    formatPayload: (history, temperature) => ({ contents: history, generationConfig: { temperature: Number(temperature) } }),
    formatPayloadExtended: (history, temperature, systemPrompt) => ({
      contents: history,
      generationConfig: { temperature: Number(temperature) },
      systemInstruction: {
        parts: [
          { text: systemPrompt }
        ]
      }
    }),
    formatHeaders: () => ({ "Content-Type": "application/json" }),
    parseResponse: (data) => ({
      content: data.candidates?.[0]?.content?.parts?.[0]?.text,
      finishReason: data.candidates?.[0]?.finishReason,
      totalTokens: undefined,
    }),
  },
  deepseek: {
    url: DEEPSEEK_URL,
    maxTokens: DEEPSEEK_MAX_TOKENS,
    initialHistory: [],
    formatUserMessage: (input) => ({ role: "user", content: input }),
    formatAssistantMessage: (content) => ({ role: "assistant", content: content }),
    formatPayload: (history, temperature) => ({ model: DEEPSEEK_MODEL, messages: history, max_tokens: DEEPSEEK_MAX_TOKENS, temperature: Number(temperature) }),
    formatPayloadExtended: (history, temperature, systemPrompt) => ({ model: DEEPSEEK_MODEL, messages: history, max_tokens: DEEPSEEK_MAX_TOKENS, temperature: Number(temperature) }),
    formatHeaders: () => ({ Authorization: `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" }),
    parseResponse: (data) => ({
      content: data.choices?.[0]?.message?.content,
      finishReason: data.choices?.[0]?.finish_reason,
      totalTokens: data.usage?.total_tokens,
    }),
  },
  gpt: { // Renamed from 'openai' to 'gpt' to match MODEL_IDENTIFIERS
    url: OPENAI_URL,
    maxTokens: OPENAI_MAX_TOKENS,
    initialHistory: [],
    formatUserMessage: (input) => ({ role: "user", content: input }),
    formatAssistantMessage: (content) => ({ role: "assistant", content: content }),
    formatPayload: (history, temperature) => ({ model: OPENAI_MODEL, messages: history, temperature: Number(temperature) }),
    formatPayloadExtended: (history, temperature, systemPrompt) => ({ model: OPENAI_MODEL, messages: history, temperature: Number(temperature) }),
    formatHeaders: () => ({ Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" }),
    parseResponse: (data) => ({
      content: data.choices?.[0]?.message?.content,
      finishReason: data.choices?.[0]?.finish_reason,
      totalTokens: data.usage?.total_tokens,
    }),
  },
  claude: {
    url: 'https://api.anthropic.com/v1/messages', // Direct HTTP API endpoint for uniformity
    maxTokens: ANTHROPIC_MAX_TOKENS,
    initialHistory: [],
    formatUserMessage: (input) => ({ role: "user", content: input }),
    formatAssistantMessage: (content) => ({ role: "assistant", content: content }),
    formatPayload: (history, temperature) => ({ model: ANTHROPIC_MODEL, max_tokens: ANTHROPIC_MAX_TOKENS, messages: history, temperature: Number(temperature / 2) }),
    formatPayloadExtended: (history, temperature, systemPrompt) => ({ model: ANTHROPIC_MODEL, max_tokens: ANTHROPIC_MAX_TOKENS, messages: history, temperature: Number(temperature / 2) }),
    formatHeaders: () => ({ 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', "Content-Type": "application/json" }),
    parseResponse: (data) => ({
      content: data.content?.[0]?.text,
      finishReason: data.stop_reason,
      totalTokens: data.usage?.output_tokens,
    }),
  },
  grok: {
    url: OPEN_ROUTER_URL, // OpenRouter handles Grok
    maxTokens: undefined, // Or configure from common.js
    initialHistory: [],
    formatUserMessage: (input) => ({ role: "user", content: input }),
    formatAssistantMessage: (content) => ({ role: "assistant", content: content }),
    formatPayload: (history, temperature) => ({ model: OPEN_ROUTER_MODEL, messages: history, temperature: Number(temperature) }),
    formatPayloadExtended: (history, temperature, systemPrompt) => ({ model: OPEN_ROUTER_MODEL, messages: history, temperature: Number(temperature) }),
    formatHeaders: () => ({ 'Authorization': `Bearer ${OPEN_ROUTER_API_KEY}`, 'Content-Type': 'application/json' }),
    parseResponse: (data) => ({
      content: data.choices?.[0]?.message?.content,
      finishReason: data.choices?.[0]?.finish_reason,
      totalTokens: data.usage?.total_tokens,
    }),
  },
};

module.exports = {
  UPLOAD_BASE_URL,
  BATCH_GENERATE_CONTENT_URL,
  BASE_GEMINI_API_URL,
  DEEPSEEK_URL, // From common.js
  OPENAI_URL, // From common.js
  OPEN_ROUTER_URL, // From common.js
  DEEPSEEK_MODEL, // From common.js
  OPENAI_MODEL, // From common.js
  ANTHROPIC_MODEL, // From common.js
  GOOGLE_GEMINI_MODEL, // From common.js
  OPEN_ROUTER_MODEL, // From common.js
  ANTHROPIC_MAX_TOKENS, // From common.js
  DEEPSEEK_MAX_TOKENS, // From common.js
  OPENAI_MAX_TOKENS, // From common.js
  MODEL_CONFIGS,
  GOOGLE_API_KEY, // Exporting for convenience in other services
  DEEPSEEK_API_KEY,
  OPENAI_API_KEY,
  ANTHROPIC_API_KEY,
  OPEN_ROUTER_API_KEY,
};