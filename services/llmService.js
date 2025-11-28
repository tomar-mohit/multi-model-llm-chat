// services/llmService.js
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');
const { Anthropic } = require('@anthropic-ai/sdk');
const { normalizeTemperature } = require('../utils/siteHelper');

const {
  MODEL_CONFIGS,
  GOOGLE_API_KEY,
  ANTHROPIC_API_KEY,
} = require('../config');

// Initialize LLM SDKs once globally for efficiency
const genAI = new GoogleGenAI(GOOGLE_API_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

/**
 * Generic function to call an LLM API and manage its history.
 * @param {string} modelId - The identifier for the model (e.g., 'gemini', 'deepseek').
 * @param {string} input - User's input message.
 * @param {boolean} [isChat=true] - Whether to maintain chat history.
 * @param {string} guid - Session GUID.
 * @param {Record<string, Array<object>>} historyContainer - The global object holding message histories for this model type.
 * @param {Number} temperature - model temperature
 * @param {string} systemPrompt - the prompt to be used for system
 * @returns {Promise<{success: boolean, content?: string, rawResponse?: object, error?: string, errorCode?: string}>}
 */
async function callLLMAPI(modelId, input, isChat = true, guid, historyContainer, temperature, systemPrompt) {
  const apiConfig = MODEL_CONFIGS[modelId];
  if (!apiConfig) {
    return {
      success: false,
      errorCode: 'invalid_model',
      error: `Configuration not found for model: ${modelId}`,
    };
  }

  let localMessageHistory = historyContainer[guid];
  let userMessageAdded = false;

  try {
    if (isChat) {
      if (!localMessageHistory) {
        localMessageHistory = apiConfig.initialHistory ? [...apiConfig.initialHistory] : [];
        historyContainer[guid] = localMessageHistory;
      }
    } else {
      localMessageHistory = apiConfig.initialHistory ? [...apiConfig.initialHistory] : []; // Fresh history for non-chat
    }

    const userMessage = apiConfig.formatUserMessage(input);
    localMessageHistory.push(userMessage);
    userMessageAdded = true;

    let payload
    if (systemPrompt) {
      payload = apiConfig.formatPayloadExtended(localMessageHistory, temperature, systemPrompt);
    } else {
      payload = apiConfig.formatPayload(localMessageHistory, temperature);
    }

    // Special handling for Anthropic SDK if needed, though MODEL_CONFIGS should cover direct HTTP
    let responseData;
    const headers = apiConfig.formatHeaders();
    const response = await axios.post(apiConfig.url, payload, { headers }); // add gemini safety settings
    responseData = response.data;

    const { content, finishReason, totalTokens } = apiConfig.parseResponse(responseData);

    if (isChat && content) {
      localMessageHistory.push(apiConfig.formatAssistantMessage(content));
    }

    let responseContent = content || `${modelId}_empty_response`;

    if (totalTokens !== undefined && apiConfig.maxTokens !== Infinity && totalTokens > apiConfig.maxTokens) {
      responseContent += ` (Token limit: ${apiConfig.maxTokens}, used: ${totalTokens})`;
    }

    return {
      success: true,
      content: responseContent,
      finishReason: finishReason, // Return finishReason separately
      rawResponse: responseData,
    };
  } catch (error) {
    if (userMessageAdded) {
      localMessageHistory.pop(); // Remove the user message if API call failed
    }
    const errorCode = `${modelId}_failed`;
    const errorData = error.response?.data || error.message;
    console.error(`Full ${modelId} Error:`, { status: error.response?.status, data: errorData });
    return {
      success: false,
      errorCode: errorCode,
      error: JSON.stringify(errorData),
    };
  }
}

// Wrapper functions for client-facing calls (can be further simplified if not strictly needed)
async function getGeminiResponse(input, isChat, guid, historyContainer) {
  const result = await callLLMAPI('gemini', input, isChat, guid, historyContainer);
  if (result.success) {
    return result.content + RESPONSE_DELIMITER + JSON.stringify(result.rawResponse);
  } else {
    return `${result.errorCode} ${result.error}`;
  }
}

async function getDeepseekResponse(input, isChat, guid, historyContainer) {
  const result = await callLLMAPI('deepseek', input, isChat, guid, historyContainer);
  if (result.success) {
    return result.content + RESPONSE_DELIMITER + JSON.stringify(result.rawResponse);
  } else {
    return `${result.errorCode} ${result.error}`;
  }
}

async function getOpenAIGptResponse(input, isChat, guid, historyContainer) {
  const result = await callLLMAPI('gpt', input, isChat, guid, historyContainer); // Note 'gpt'
  if (result.success) {
    return result.content + RESPONSE_DELIMITER + JSON.stringify(result.rawResponse);
  } else {
    return `${result.errorCode} ${result.error}`;
  }
}

async function getAnthropicClaudeResponse(input, isChat, guid, historyContainer) {
  const result = await callLLMAPI('claude', input, isChat, guid, historyContainer);
  if (result.success) {
    return result.content + RESPONSE_DELIMITER + JSON.stringify(result.rawResponse);
  } else {
    return `${result.errorCode} ${result.error}`;
  }
}

async function getGrokResponse(input, isChat, guid, historyContainer) {
  const result = await callLLMAPI('grok', input, isChat, guid, historyContainer);
  if (result.success) {
    return result.content + RESPONSE_DELIMITER + JSON.stringify(result.rawResponse);
  } else {
    return `${result.errorCode} ${result.error}`;
  }
}


module.exports = {
  callLLMAPI,
  getGeminiResponse,
  getDeepseekResponse,
  getOpenAIGptResponse,
  getAnthropicClaudeResponse,
  getGrokResponse,
  genAI, // Export SDK instance if needed for other complex tasks
  anthropic, // Export SDK instance if needed for other complex tasks
};