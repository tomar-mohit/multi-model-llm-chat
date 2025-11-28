// config/constants.js

// Delimiters for API responses
const RESPONSE_DELIMITER = '___';
const FINISH_REASON_DELIMITER = '__';

// Define common model identifiers
const MODEL_IDENTIFIERS = ['gemini', 'deepseek', 'gpt', 'claude', 'grok'];

// Common model configuration structure (can be extended)
const MODELS_CONFIG = [
  { id: 'gemini', name: 'Google Gemini', defaultChecked: true, color: 'blue' },
  { id: 'deepseek', name: 'Deepseek', defaultChecked: false, color: 'green' },
  { id: 'gpt', name: 'OpenAI GPT', defaultChecked: false, color: 'purple' },
  { id: 'claude', name: 'Anthropic Claude', defaultChecked: false, color: 'red' },
  { id: 'grok', name: 'Grok', defaultChecked: false, color: 'orange' },
];

module.exports = {
  RESPONSE_DELIMITER,
  FINISH_REASON_DELIMITER,
  MODEL_IDENTIFIERS,
  MODELS_CONFIG,
};