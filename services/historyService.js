// services/historyService.js

// --- In-Memory State Management (TO BE REPLACED WITH PERSISTENT STORAGE) ---
/** @type {Record<string, Array<{ role: string, parts: Array<{ text: string }> }>>} Cache for Google Gemini chat sessions, keyed by session GUID. */
const geminiChatSessions = {};
/** @type {Record<string, Array<{ role: string, content: string }>>} Cache for Deepseek message history, keyed by session GUID. */
const deepseekMessageHistories = {};
/** @type {Record<string, Array<{ role: string, content: string }>>} Cache for OpenAI GPT message history, keyed by session GUID. */
const openAIGptMessageHistories = {};
/** @type {Record<string, Array<{ role: string, content: string }>>} Cache for Anthropic Claude message history, keyed by session GUID. */
const anthropicClaudeMessageHistories = {};
/** @type {Record<string, Array<{ role: string, content: string }>>} Cache for Grok message history, keyed by session GUID. */
const grokMessageHistories = {};

/**
 * Returns the appropriate history container for a given model ID.
 * @param {string} modelId
 * @returns {Record<string, Array<object>>} The history object for the model.
 */
function getHistoryContainer(modelId) {
  switch (modelId) {
    case 'gemini':
      return geminiChatSessions;
    case 'deepseek':
      return deepseekMessageHistories;
    case 'gpt':
      return openAIGptMessageHistories;
    case 'claude':
      return anthropicClaudeMessageHistories;
    case 'grok':
      return grokMessageHistories;
    default:
      throw new Error(`Invalid modelId: ${modelId}`);
  }
}

/**
 * Clears chat history for a given session GUID across selected models.
 * @param {string} guid - The unique identifier for the current user session.
 * @param {number} valueToClear - The number of messages/turns to clear.
 */
function clearHistory(guid, valueToClear) {
  // The logic `valueToClear % 2 !== 0` suggests `valueToClear` should represent pairs,
  // and the intent might be to clear a specific number of *turns* (user + assistant).
  // If so, making it even ensures we clear full turns. If `valueToClear` represents messages,
  // this logic might be redundant or incorrect. Assuming it means pairs of messages.
  const effectiveClearCount = (valueToClear % 2 !== 0) ? valueToClear + 1 : valueToClear;
  const startIndex = 0; // Always clear from the beginning of the history.

  const historyContainers = [
    geminiChatSessions,
    deepseekMessageHistories,
    openAIGptMessageHistories,
    anthropicClaudeMessageHistories,
    grokMessageHistories,
  ];

  historyContainers.forEach(container => {
    const historyArray = container[guid];
    if (historyArray && historyArray.length > effectiveClearCount) {
      historyArray.splice(startIndex, effectiveClearCount);
    }
    // If history becomes empty, clean up the session entry
    if (historyArray && historyArray.length === 0) {
        delete container[guid];
    }
  });
}

/**
 * Removes the last `clearCount` messages from a specific model's conversation history.
 * @param {string} modelId - The identifier for the model.
 * @param {string} guid - The session GUID.
 * @param {number} clearCount - The number of messages to remove from the end.
 * @returns {boolean} True if history was modified, false otherwise.
 */
function removeLastMessages(modelId, guid, clearCount) {
  const historyContainer = getHistoryContainer(modelId);
  const historyArray = historyContainer[guid];

  if (historyArray && historyArray.length >= clearCount) {
    historyArray.splice(-clearCount);
    // If history becomes empty, clean up the session entry
    if (historyArray.length === 0) {
        delete historyContainer[guid];
    }
    return true;
  }
  return false;
}

/**
 * Moves a message within a specific model's conversation history.
 * @param {string} modelId - The identifier for the model.
 * @param {string} guid - The session GUID.
 * @param {number} oldIndex - The current index of the message.
 * @param {number} newIndex - The target index for the message.
 * @returns {boolean} True if message was moved, false otherwise (e.g., invalid indices).
 */
function moveMessage(modelId, guid, oldIndex, newIndex) {
  const historyContainer = getHistoryContainer(modelId);
  const historyArray = historyContainer[guid];

  if (!historyArray || historyArray.length <= oldIndex || historyArray.length <= newIndex) {
    return false; // Invalid indices or no history
  }

  const [movedElement] = historyArray.splice(oldIndex, 1);
  historyArray.splice(newIndex, 0, movedElement);
  return true;
}

/**
 * Deletes a specific message from a model's conversation history by index.
 * @param {string} modelId - The identifier for the model.
 * @param {string} guid - The session GUID.
 * @param {number} messageIndex - The 0-based index of the message to delete.
 * @returns {boolean} True if message was deleted, false otherwise.
 */
function deleteMessage(modelId, guid, messageIndex) {
  const historyContainer = getHistoryContainer(modelId);
  const historyArray = historyContainer[guid];

  if (!historyArray || historyArray.length <= messageIndex) {
    return false; // No history or index out of bounds
  }

  historyArray.splice(messageIndex, 1);
  // If history array becomes empty, delete the GUID entry to clean up memory
  if (historyArray.length === 0) {
    delete historyContainer[guid];
  }
  return true;
}

module.exports = {
  getHistoryContainer,
  clearHistory,
  removeLastMessages,
  moveMessage,
  deleteMessage,
  // Export the raw history objects (for llmService to directly modify)
  geminiChatSessions,
  deepseekMessageHistories,
  openAIGptMessageHistories,
  anthropicClaudeMessageHistories,
  grokMessageHistories,
};