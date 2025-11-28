// routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const path = require('path');

const { MODEL_IDENTIFIERS, MODELS_CONFIG, RESPONSE_DELIMITER, FINISH_REASON_DELIMITER } = require('../config');
const { sendSseEvent } = require('../utils/sse');
const historyService = require('../services/historyService');
const llmService = require('../services/llmService'); // Contains callLLMAPI and now delimiters

// --- Helper for Model API Calls (to reduce boilerplate in the switch) ---
async function callModelAndSendSSE(modelId, messageForModel, isChat, guid, res, temperature, systemPrompt) {
  const historyContainer = historyService.getHistoryContainer(modelId);
  try {
    const result = await llmService.callLLMAPI(modelId, messageForModel, isChat, guid, historyContainer, temperature, systemPrompt);
    if (result.success) {
      let formattedText = result.content;
      if (result.finishReason) {
        // --- Use the directly imported FINISH_REASON_DELIMITER ---
        formattedText += `${FINISH_REASON_DELIMITER}${result.finishReason}`;
      }
      // --- Use the directly imported RESPONSE_DELIMITER ---
      const formattedResult = formattedText + RESPONSE_DELIMITER + JSON.stringify(result.rawResponse);

      sendSseEvent(res, 'model_result', { model: modelId, result: formattedResult });
      return { model: modelId, result: formattedResult, status: 'success' };
    } else {
      const errorMessage = `${result.errorCode} ${result.error}`;
      sendSseEvent(res, 'model_error', { model: modelId, error: errorMessage });
      return { model: modelId, error: errorMessage, status: 'error' };
    }
  } catch (error) {
    const errorMessage = `Server internal error: ${error.message || error}`;
    console.error(`Error in callModelAndSendSSE for ${modelId}:`, error);
    sendSseEvent(res, 'model_error', { model: modelId, error: errorMessage });
    return { model: modelId, error: errorMessage, status: 'error' };
  }
}


/**
 * Handles the root route by serving the index.html file.
 * GET /
 */
router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

/**
 * Handles API requests for submitting prompts to AI models and streaming responses via SSE.
 * POST /api/submit
 */
router.post("/api/submit", async (req, res) => {
  const { text: originalRawInput, parsedDirectives, enabledList, checkedList, guid, temperature, systemPrompt } = req.body;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const enabledModelsIndices = enabledList.map((isEnabled, index) => isEnabled ? index : -1).filter(index => index !== -1);

  if (enabledModelsIndices.length === 0) {
    MODEL_IDENTIFIERS.forEach(modelId => {
      sendSseEvent(res, 'model_skipped', { model: modelId, result: "Skipped: No models enabled for this request." });
    });
    sendSseEvent(res, 'all_complete', { message: 'No models enabled. Request aborted.', finalResults: [] });
    res.end();
    return;
  }

  const processingPromises = [];

  for (const modelIndex of enabledModelsIndices) {
    const modelId = MODEL_IDENTIFIERS[modelIndex];
    const modelConfig = MODELS_CONFIG.find(m => m.id === modelId);

    if (!modelConfig) {
      console.error(`Configuration not found for modelId: ${modelId}`);
      sendSseEvent(res, 'model_skipped', { model: modelId, result: `Skipped: Configuration missing.` });
      processingPromises.push(Promise.resolve({ model: modelId, result: "Skipped: Configuration missing.", status: 'skipped' }));
      continue;
    }

    let messageForModel = parsedDirectives.commonMessage;

    if (parsedDirectives.appliesToAll && parsedDirectives.allMessageText) {
      const allDirectiveText = parsedDirectives.allMessageText.replace(/\(|\)/g, '').trim();
      if (allDirectiveText) {
        messageForModel = allDirectiveText;
      }
    }

    if (parsedDirectives.modelSpecificDirectives[modelId]?.directive) {
      messageForModel = `${messageForModel} ${parsedDirectives.modelSpecificDirectives[modelId].directive}`;
    }
    messageForModel = messageForModel.trim();

    if (!messageForModel) {
      messageForModel = "No specific message generated for this model.";
    }

    const isChat = checkedList[modelIndex];

    // Using the unified callModelAndSendSSE helper
    processingPromises.push(callModelAndSendSSE(modelId, messageForModel, isChat, guid, res, temperature, systemPrompt));
  }

  Promise.all(processingPromises)
    .then(allResults => {
      sendSseEvent(res, 'all_complete', { message: 'All model responses processed.', finalResults: allResults });
    })
    .catch(error => {
      console.error("Unhandled error in Promise.all for SSE:", error);
      sendSseEvent(res, 'server_error', { message: 'An unexpected server error occurred.', error: error.message || error });
    })
    .finally(() => {
      res.end();
    });

  req.on('close', () => {
    console.log('Client disconnected from SSE stream.');
  });
});

/**
 * Handles requests to clear chat history for a given session.
 * POST /api/clearHistory
 */
router.post('/api/clearHistory', async (req, res) => {
  const { valueToClear, guid } = req.body;
  if (!guid || typeof valueToClear !== 'number' || valueToClear < 0) {
    return res.status(400).json({ error: "guid and a valid valueToClear are required." });
  }

  try {
    historyService.clearHistory(guid, valueToClear);
    res.json({ message: "Data cleared successfully" });
  } catch (error) {
    console.error("Error processing request for clear history:", error);
    res.status(500).json({ error: "An error occurred while clearing history." });
  }
});

/**
 * Handles requests to remove the last messages from a specific model's conversation history.
 * POST /api/removeLastMessage
 */
router.post('/api/removeLastMessage', async (req, res) => {
  const { modelId, guid, clearCount } = req.body;
  if (!modelId || !guid || typeof clearCount !== 'number' || clearCount < 0) {
    return res.status(400).json({ error: "modelId, guid, and a valid clearCount are required." });
  }

  try {
    const modified = historyService.removeLastMessages(modelId, guid, clearCount);
    if (modified) {
      res.json({ message: "Last message(s) removed successfully" });
    } else {
      res.json({ message: "No history found or not enough messages to remove for this model/session." });
    }
  } catch (error) {
    console.error(`Error processing request for removeLastMessage (${modelId}):`, error);
    res.status(500).json({ error: `An error occurred while removing the last message(s) for ${modelId}.` });
  }
});

/**
 * Handles requests to move a specific message from a model's conversation history.
 * POST /api/moveMessage
 */
router.post('/api/moveMessage', async (req, res) => {
  const { modelId, guid, oldIndex, newIndex } = req.body;
  if (!modelId || !guid || typeof oldIndex !== 'number' || oldIndex < 0 || typeof newIndex !== 'number' || newIndex < 0) {
    return res.status(400).json({ error: "modelId, guid, oldIndex, and newIndex are required and must be valid numbers." });
  }

  try {
    const modified = historyService.moveMessage(modelId, guid, oldIndex, newIndex);
    if (modified) {
      res.json({ message: "Message moved successfully" });
    } else {
      res.status(404).json({ message: "Invalid message index or history does not exist for this model/session." });
    }
  } catch (error) {
    console.error(`Error processing request for moveMessage (${modelId}):`, error);
    res.status(500).json({ error: `An error occurred while moving the message for ${modelId}.` });
  }
});

/**
 * Handles requests to delete a specific message from a model's conversation history by index.
 * POST /api/deleteMessage
 */
router.post('/api/deleteMessage', async (req, res) => {
  const { modelId, guid, messageIndex } = req.body;
  if (!modelId || !guid || typeof messageIndex !== 'number' || messageIndex < 0) {
    return res.status(400).json({ error: "modelId, guid, and a valid messageIndex are required." });
  }

  try {
    const modified = historyService.deleteMessage(modelId, guid, messageIndex);
    if (modified) {
      res.json({ message: "Message deleted successfully" });
    } else {
      res.status(404).json({ message: "Message not found or history does not exist for this model/session at the given index." });
    }
  } catch (error) {
    console.error(`Error processing request for deleteMessage (${modelId}):`, error);
    res.status(500).json({ error: `An error occurred while deleting the message for ${modelId}.` });
  }
});

// The /api/moveToLast route was a specific case of /api/moveMessage.
// It should be refactored or removed if its functionality is covered by /api/moveMessage.
// For now, I'm omitting it to reduce redundancy. If needed, you can implement it
// using `historyService.moveMessage(modelId, guid, 1, historyArray.length - 1)`
// after retrieving `modelId` and `guid` from the request and `historyArray` from `historyService`.

module.exports = router;