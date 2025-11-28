// services/batchJobService.js
const axios = require("axios");
const {
  BATCH_GENERATE_CONTENT_URL,
  BASE_GEMINI_API_URL,
  GOOGLE_API_KEY,
  GOOGLE_GEMINI_MODEL,
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL,
  ANTHROPIC_MAX_TOKENS,
  OPENAI_API_KEY,
} = require('../config');
const { getNonZeroStatus } = require('../utils/batchHelpers');

// --- In-Memory Job Store (TO BE REPLACED WITH PERSISTENT STORAGE) ---
const jobs = {}; // Structure: { internalJobId: { model, method, prompts, status, fullName, llmJobId, result, createdAt, lastChecked, successData } }
let nextInternalJobId = 1;

/**
 * Generates a unique internal job ID.
 * @returns {string}
 */
function generateInternalJobId() {
  return `job-${nextInternalJobId++}`;
}

/**
 * Formats raw prompts into the structure required for Gemini Batch API (text input).
 * @param {string[]} rawPrompts An array of individual prompt strings.
 * @param {boolean} isSingleBatchChat - True if all prompts are part of a single conversational turn.
 * @returns {Array} Array of objects in Gemini batch request format.
 */
function formatGeminiBatchRequests(rawPrompts, isSingleBatchChat, temperature, systemPrompt) {
  if (isSingleBatchChat) {
    let localMessages = rawPrompts.map((prompt) => ({
      role: 'user',
      parts: [{ text: prompt }]
    }));
    if (systemPrompt) {
      return {
        metadata: { key: 'request-1' },
        request: {
          contents: localMessages,
          generationConfig: { temperature: temperature },
          systemInstruction: {
            parts: [
              { text: systemPrompt }
            ]
          }
        }
      };
    }
    else {
      return {
        metadata: { key: 'request-1' },
        request: { contents: localMessages, generationConfig: { temperature: temperature } }
      };
    }
  } else {
    if (systemPrompt) {
      return rawPrompts.map((prompt, index) => ({
        request: {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: temperature },
          systemInstruction: {
            parts: [
              { text: systemPrompt }
            ]
          }
        },
        metadata: { key: `request-${index + 1}` }
      }));
    }
    else {
      return rawPrompts.map((prompt, index) => ({
        request: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: temperature } },
        metadata: { key: `request-${index + 1}` }
      }));
    }

  }
}

/**
 * Formats raw prompts into the structure required for Claude Batch API (text input).
 * @param {string[]} rawPrompts An array of individual prompt strings.
 * @param {boolean} isSingleBatchChat - True if all prompts are part of a single conversational turn.
 * @returns {Array} Array of objects in Claude batch request format.
 */
function formatClaudeBatchRequests(rawPrompts, isSingleBatchChat) {
  if (isSingleBatchChat) {
    let localMessages = rawPrompts.map((prompt) => ({
      role: 'user',
      content: prompt
    }));
    return [{
      custom_id: 'request-1',
      params: {
        model: ANTHROPIC_MODEL,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        messages: localMessages
      }
    }];
  } else {
    return rawPrompts.map((prompt, index) => ({
      custom_id: `request-${index + 1}`,
      params: {
        model: ANTHROPIC_MODEL,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        messages: [{
          role: 'user',
          content: prompt
        }]
      }
    }));
  }
}

/**
 * Submits a new batch job to the specified LLM provider.
 * @param {string} method - The input method ('text_input' or 'file_upload').
 * @param {string[]} prompts - Array of prompts for text_input method.
 * @param {string[]} models - Array of model IDs to submit to.
 * @param {boolean} isSingleBatchChat - Flag for single conversational batch.
 * @param {Number} temperature - the temperate to use
 * @param {string} systemPrompt - the system prompt command
 * @returns {Promise<object>} An object containing submitted job details for each model.
 */
async function submitBatchJob(method, prompts, models, isSingleBatchChat, temperature, systemPrompt) {
  const submittedJobs = {};
  if (!models || models.length === 0) {
    throw new Error('At least one LLM must be selected.');
  }
  if (method === 'text_input' && (!prompts || prompts.length === 0)) {
    throw new Error('Prompts are required for text input method.');
  }

  console.log(`Submitting batch job (method: ${method}) for models: ${models.join(', ')}`);

  const creationPromises = models.map(async (modelId) => {
    const internalJobId = generateInternalJobId();
    jobs[internalJobId] = {
      model: modelId,
      method: method,
      prompts: prompts,
      status: 'PENDING',
      fullName: null,
      llmJobId: null,
      result: null,
      createdAt: new Date(),
      lastChecked: new Date(),
      successData: null
    };

    try {
      if (modelId === 'gemini') {
        if (!GOOGLE_API_KEY) throw new Error('Gemini API key not configured.');
        const geminiRequests = formatGeminiBatchRequests(prompts, isSingleBatchChat, temperature, systemPrompt);
        const batchRequestPayload = {
          batch: {
            display_name: `my-batch-requests-${internalJobId}`,
            input_config: {
              requests: {
                requests: geminiRequests
              }
            }
          }
        };
        const geminiResponse = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_GEMINI_MODEL}:batchGenerateContent`,
          batchRequestPayload,
          { headers: { 'x-goog-api-key': GOOGLE_API_KEY, 'Content-Type': 'application/json' } }
        );
        const llmJobname = geminiResponse.data.name;
        const llmJobId = llmJobname.split('/').pop();
        jobs[internalJobId].fullName = llmJobname;
        jobs[internalJobId].llmJobId = llmJobId;
        submittedJobs[modelId] = { internalJobId, llmJobId: llmJobId, status: 'PENDING' };
      } else if (modelId === 'claude') {
        if (!ANTHROPIC_API_KEY) throw new Error('Anthropic API key not configured.');
        const claudeRequests = formatClaudeBatchRequests(prompts, isSingleBatchChat);
        const batchRequestPayload = { requests: claudeRequests };
        const claudeResponse = await axios.post(
          `https://api.anthropic.com/v1/messages/batches`,
          batchRequestPayload,
          { headers: { 'x-api-key': ANTHROPIC_API_KEY, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' } }
        );
        const claudeData = claudeResponse.data;
        const llmJobname = claudeData.id;
        const llmJobId = llmJobname.split('/').pop();
        jobs[internalJobId].fullName = llmJobname;
        jobs[internalJobId].llmJobId = llmJobId;
        submittedJobs[modelId] = { internalJobId, llmJobId: llmJobId, status: 'PENDING' };
      } else {
        throw new Error(`Model ${modelId} not supported for batch text input.`);
      }
    } catch (error) {
      console.error(`Error submitting ${modelId} batch job for ${internalJobId}:`, error);
      jobs[internalJobId].status = 'FAILED';
      jobs[internalJobId].result = `Failed to submit job: ${error.message}`;
      submittedJobs[modelId] = { internalJobId, status: 'FAILED', message: error.message };
    }
    return null; // Return null for this promise, results gathered in submittedJobs
  });

  await Promise.allSettled(creationPromises);
  return submittedJobs;
}

/**
 * Checks the status of batch jobs with LLM providers.
 * @param {string[]} internalJobIds - Array of internal job IDs to check.
 * @param {boolean} isFileUpload - True if the job was initiated by a file upload.
 * @param {string} modelId - The model ID for file upload jobs.
 * @returns {Promise<object>} An object containing status updates for each job.
 */
async function getBatchJobStatus(internalJobIds, isFileUpload, modelId) {
  const statusUpdates = {};
  if (!internalJobIds || internalJobIds.length === 0) {
    throw new Error('No job IDs provided.');
  }

  if (isFileUpload) {
    if (modelId === 'gemini') {
      const operationName = internalJobIds[0];
      if (!operationName) throw new Error("operationName is required.");
      const url = `${BASE_GEMINI_API_URL}${operationName}`;
      const response = await axios.get(url, { headers: { 'x-goog-api-key': GOOGLE_API_KEY, 'Content-Type': 'application/json' } });
      const status = response.data.metadata?.state;
      return { state: status, fullResponse: response.data };
    } else if (modelId === 'openai') {
      const operationName = internalJobIds[0];
      if (!operationName) throw new Error("operationName is required.");
      const url = `https://api.openai.com/v1/batches/${operationName}`;
      const response = await axios.get(url, { headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' } });
      const status = response.data.status;
      const output_file_id = response.data.output_file_id;
      const completed_at = response.data.completed_at;
      statusUpdates[operationName] = { status: status, result: output_file_id, lastChecked: completed_at };
      if (jobs[operationName]) {
        jobs[operationName].successData = output_file_id;
      }
      return statusUpdates;
    } else {
      throw new Error(`Model ${modelId} not supported for file upload batch status check.`);
    }
  } else {
    const checkPromises = internalJobIds.map(async (internalJobId) => {
      const job = jobs[internalJobId];
      if (!job) {
        statusUpdates[internalJobId] = { status: 'NOT_FOUND', message: 'Job not found.' };
        return;
      }
      if (job.status === 'COMPLETED' || job.status === 'FAILED') {
        statusUpdates[internalJobId] = { status: job.status, result: job.result, lastChecked: job.lastChecked };
        return;
      }
      try {
        let currentLLMStatus = job.status;
        if (job.model === 'gemini') {
          if (!job.llmJobId) throw new Error(`Gemini job ${internalJobId} has no LLM job ID.`);
          const geminiOperationUrl = `${BASE_GEMINI_API_URL}${job.fullName}`;
          const geminiResponse = await axios.get(geminiOperationUrl, { headers: { 'x-goog-api-key': GOOGLE_API_KEY }, "Content-Type": "application/json" });
          const lroInfo = geminiResponse.data;
          currentLLMStatus = lroInfo.done ? 'SUCCEEDED' : (lroInfo.error ? 'FAILED' : 'RUNNING');
          if (lroInfo.done) {
            if (lroInfo.error) {
              job.status = 'FAILED';
              job.result = `Gemini job failed: ${lroInfo.error.message}`;
            } else {
              job.status = 'COMPLETED';
              job.result = `Gemini batch job ${job.llmJobId.split('/').pop()} SUCCEEDED. Results are available.`;
              job.successData = lroInfo;
            }
          } else {
            job.status = currentLLMStatus;
          }
        } else if (job.model === 'claude') {
          if (!job.llmJobId) throw new Error(`Claude job ${internalJobId} has no LLM job ID.`);
          const claudeOperationUrl = `https://api.anthropic.com/v1/messages/batches/${job.llmJobId}`;
          const claudeResponse = await axios.get(claudeOperationUrl, { headers: { 'x-api-key': ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" } });
          const lroInfo = claudeResponse.data;
          currentLLMStatus = (lroInfo.ended_at && lroInfo.processing_status == 'ended') ? 'COMPLETED' : 'PENDING';
          if (lroInfo.ended_at && lroInfo.processing_status == 'ended') {
            job.result = `Claude batch job ${job.llmJobId.split('/').pop()} status. ${getNonZeroStatus(lroInfo.request_counts)}`;
            job.successData = lroInfo.results_url;
            job.status = currentLLMStatus;
          } else {
            job.status = 'RUNNING';
            job.result = `Model ${job.model} is still running, please check later.`;
          }
        }
      } catch (error) {
        console.error(`Error checking status for ${job.model} job ${internalJobId} (LLM ID: ${job.llmJobId}):`, error);
        job.status = 'FAILED';
        job.result = `Failed to check status: ${error.message}`;
      }
      job.lastChecked = new Date();
      statusUpdates[internalJobId] = { status: job.status, result: job.result, lastChecked: job.lastChecked };
    });
    await Promise.allSettled(checkPromises);
    return statusUpdates;
  }
}

/**
 * Retrieves results for batch jobs.
 * @param {string[]} internalJobIds - Array of internal job IDs.
 * @param {boolean} isSingleBatchChat - Flag for single conversational batch.
 * @param {boolean} isFileUpload - True if the job was initiated by a file upload.
 * @param {string} modelId - The model ID for file upload jobs.
 * @returns {Promise<object>} An object containing results for each job.
 */
async function getBatchJobResult(internalJobIds, isSingleBatchChat, isFileUpload, modelId) {
  const statusUpdates = {};
  if (!internalJobIds || internalJobIds.length === 0) {
    throw new Error('No job IDs provided.');
  }

  if (isFileUpload) {
    if (modelId === 'gemini') {
      const operationName = internalJobIds[0];
      if (!operationName) throw new Error("operationName is required.");
      const statusUrl = `${BASE_GEMINI_API_URL}${operationName}`;
      const statusResponse = await axios.get(statusUrl, { headers: { 'x-goog-api-key': GOOGLE_API_KEY, 'Content-Type': 'application/json' } });
      const batchState = statusResponse.data.metadata?.state;
      const outputFileName = statusResponse.data.metadata?.outputConfig?.fileName || statusResponse.data.metadata?.output?.responsesFile || statusResponse.data.response?.responsesFile;
      if (batchState !== "BATCH_STATE_COMPLETED" && batchState !== 'BATCH_STATE_SUCCEEDED') {
        throw new Error(`Batch is not completed yet. Current state: ${batchState}`);
      }
      if (!outputFileName) {
        throw new Error("Batch completed, but no output file name found in its metadata.");
      }
      let localUrl = `https://generativelanguage.googleapis.com/download/v1beta/${outputFileName}:download?alt=media`;
      const resultResponse = await axios.get(localUrl, { headers: { 'x-goog-api-key': GOOGLE_API_KEY } });
      let data = {};
      data.results = parseJsonlResults(resultResponse.data);
      data.usageData = parseJsonlUsageData(resultResponse.data);
      return data;
    } else if (modelId === 'openai') {
      const operationName = internalJobIds[0];
      const job = jobs[operationName];
      if (!job || !job.successData) throw new Error("Job not found or output file ID missing.");
      const statusUrl = `https://api.openai.com/v1/files/${job.successData}/content`;
      const statusResponse = await axios.get(statusUrl, { headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' } });
      let data = {};
      data.results = parseJsonlResults(statusResponse.data);
      data.usageData = parseJsonlUsageData(statusResponse.data);
      return data;
    } else {
      throw new Error(`Model ${modelId} not supported for file upload batch result retrieval.`);
    }
  } else {
    const checkPromises = internalJobIds.map(async (internalJobId) => {
      const job = jobs[internalJobId];
      if (!job) {
        statusUpdates[internalJobId] = { status: 'NOT_FOUND', message: 'Job not found.' };
        return;
      }
      if (job.status !== 'COMPLETED') {
        return;
      }
      try {
        if (job.model === 'gemini') {
          if (!job.llmJobId) throw new Error(`Gemini job ${internalJobId} has no LLM job ID.`);
          if (job.status == 'COMPLETED' && job.successData) {
            job.result = parseGeminiInlineResponses(job.successData, job.prompts, isSingleBatchChat);
            job.usageData = parseGeminiUsageData(job.successData, job.prompts, isSingleBatchChat);
          } else {
            const geminiOperationUrl = `${BASE_GEMINI_API_URL}${job.fullName}`;
            const geminiResponse = await axios.get(geminiOperationUrl, { headers: { 'x-goog-api-key': GOOGLE_API_KEY }, "Content-Type": "application/json" });
            const lroInfo = geminiResponse.data;
            if (lroInfo.done && !lroInfo.error) {
              job.status = 'COMPLETED';
              job.result = parseGeminiInlineResponses(lroInfo, job.prompts, isSingleBatchChat);
              job.usageData = parseGeminiUsageData(job.successData, job.prompts, isSingleBatchChat);
            } else if (lroInfo.done && lroInfo.error) {
              job.status = 'FAILED';
              job.result = `Gemini job failed: ${lroInfo.error.message}`;
            } else {
              job.status = lroInfo.metadata?.state || lroInfo.state || 'RUNNING';
              job.result = `Gemini job is ${job.status}. Results are not yet available.`;
            }
          }
        } else if (job.model === 'claude') {
          if (!job.llmJobId) throw new Error(`Claude job ${internalJobId} has no LLM job ID.`);
          if (job.status == 'COMPLETED' && job.successData) {
            let allData = await getClaudeJobResult(job.successData, job.prompts, isSingleBatchChat);
            job.result = allData.split('_USAGE_')[0];
            job.usageData = JSON.parse(allData.split('_USAGE_')[1]);
          } else {
            const claudeOperationUrl = `https://api.anthropic.com/v1/messages/batches/${job.llmJobId}`;
            const claudeResponse = await axios.get(claudeOperationUrl, { headers: { 'x-api-key': ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" } });
            const lroInfo = claudeResponse.data;
            if (lroInfo.ended_at && lroInfo.processing_status == 'ended') {
              let allData = await getClaudeJobResult(lroInfo.results_url, job.prompts, isSingleBatchChat);
              job.result = allData.split('_USAGE_')[0];
              job.usageData = JSON.parse(allData.split('_USAGE_')[1]);
              job.successData = lroInfo.results_url;
              job.status = 'COMPLETED';
            } else {
              job.status = 'PENDING';
              job.result = `Model ${job.model} is still running, please check later.`;
            }
          }
        }
      } catch (error) {
        console.error(`Error checking status for ${job.model} job ${internalJobId} (LLM ID: ${job.llmJobId}):`, error);
        job.status = 'FAILED';
        job.result = `Failed to check status: ${error.message}`;
      }
      job.lastChecked = new Date();
      statusUpdates[internalJobId] = { status: job.status, result: job.result, lastChecked: job.lastChecked, usageData: job.usageData };
    });
    await Promise.allSettled(checkPromises);
    return statusUpdates;
  }
}

/**
 * Parses Gemini batch inline responses from the LRO object.
 * @param {Object} lroInfo The full LRO response data.
 * @param {string[]} originalPrompts The original list of prompts for context.
 * @returns {string} Formatted results string.
 */
function parseGeminiInlineResponses(lroInfo, originalPrompts, isSingleBatchChat) {

  const inlinedResponses = lroInfo.response?.inlinedResponses?.inlinedResponses ||
    lroInfo.metadata?.output?.inlinedResponses?.inlinedResponses ||
    [];
  if (inlinedResponses.length === 0) {
    return 'Gemini batch job SUCCEEDED, but no inline responses found.';
  }

  const formattedResults = inlinedResponses.map((item, index) => {
    let originalPrompt;
    if (isSingleBatchChat) {
      originalPrompt = originalPrompts.join('__'); // Join all prompts if it was a single chat
    } else {
      originalPrompt = (originalPrompts && originalPrompts[index]) ? originalPrompts[index] : `(Prompt ${index + 1})`;
    }
    const metadataKey = item.metadata?.key;
    let responseContent = '[No response content]';
    let errorMessage = item.error?.message;
    if (item.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      responseContent = item.response.candidates[0].content.parts[0].text; // add the 0 and 1 and all upto where exists
    } else if (item.response) {
      responseContent = JSON.stringify(item.response);
    }
    return `--- Request Key: ${metadataKey || `(Index ${index + 1})`} ---\n` +
      `Prompt: ${originalPrompt}\n` +
      `Response: ${responseContent}` +
      (errorMessage ? `\nError: ${errorMessage}` : '');
  }).join('\n\n');
  return formattedResults;
}

/**
 * Parses Gemini batch inline responses for usage object from the LRO object.
 * @param {Object} lroInfo The full LRO response data.
 * @param {string[]} originalPrompts The original list of prompts for context.
 * @returns {string} Formatted results string.
 */
function parseGeminiUsageData(lroInfo, originalPrompts, isSingleBatchChat) {
  const inlinedResponses = lroInfo.response?.inlinedResponses?.inlinedResponses ||
    lroInfo.metadata?.output?.inlinedResponses?.inlinedResponses ||
    [];
  if (inlinedResponses.length === 0) {
    return 'Gemini batch job SUCCEEDED, but no inline responses found.';
  }

  let totalPromptTokenCount = 0;
  let totalCandidatesTokenCount = 0;
  let totalTotalTokenCount = 0;
  let totalThoughtsTokenCount = 0;
  let totalPromptDetailsTokenCount = 0;

  if (isSingleBatchChat) {
    try {
      // Safely get usageMetadata, defaulting to an empty object if not found
      const usageMetadata = inlinedResponses[0]?.response?.usageMetadata || {};

      // Sum scalar token counts, defaulting to 0 if not present
      totalPromptTokenCount += usageMetadata?.promptTokenCount || 0;
      totalCandidatesTokenCount += usageMetadata?.candidatesTokenCount || 0;
      totalTotalTokenCount += usageMetadata?.totalTokenCount || 0;
      totalThoughtsTokenCount += usageMetadata?.thoughtsTokenCount || 0;

      // Sum tokenCount from promptTokensDetails, which is a list
      const promptDetailsList = usageMetadata?.promptTokensDetails || [];
      for (const detail of promptDetailsList) {
        totalPromptDetailsTokenCount += detail.tokenCount || 0;
      }
      const aggregatedOutput = {
        usageMetadata: {
          promptTokenCount: totalPromptTokenCount,
          candidatesTokenCount: totalCandidatesTokenCount,
          totalTokenCount: totalTotalTokenCount,
          promptTokensDetails: [
            {
              modality: "TEXT", // This field appears to be constant in your sample
              tokenCount: totalPromptDetailsTokenCount
            }
          ],
          thoughtsTokenCount: totalThoughtsTokenCount
        }
      };

      return aggregatedOutput;
    }
    catch (error) {
      console.log(`Warning: Skipping a malformed inlined response entry: ${error.message}`);
    }
  }
  else {

    // The relevant responses are located here:
    // jsonData.response.inlinedResponses.inlinedResponses
    // Note: There's also metadata.output.inlinedResponses.inlinedResponses,
    // which appears to contain identical data. We'll process the 'response'
    // path to avoid double-counting.
    // let inlinedResponses = [];
    // try {

    //   if (inlinedResponses.length === 0 && jsonData?.response?.inlinedResponses?.inlinedResponses !== undefined) {
    //     // If the path exists but the array is empty, it's not an error in structure, but no data to aggregate.
    //     // We can proceed, and the sums will remain 0.
    //   } else if (inlinedResponses.length === 0 && !jsonData?.response?.inlinedResponses?.inlinedResponses) {
    //     console.log("Error: Could not find 'response.inlinedResponses.inlinedResponses' path in the JSON.");
    //     return null;
    //   }

    // } catch (error) {
    //   // This catch block is mostly for unexpected errors during property access,
    //   // though optional chaining should prevent most `TypeError` for `undefined` properties.
    //   console.log(`Error processing JSON structure: ${error.message}`);
    //   return null;
    // }

    for (const entry of inlinedResponses) {
      try {
        // Safely get usageMetadata, defaulting to an empty object if not found
        const usageMetadata = entry?.response?.usageMetadata || {};

        // Sum scalar token counts, defaulting to 0 if not present
        totalPromptTokenCount += usageMetadata.promptTokenCount || 0;
        totalCandidatesTokenCount += usageMetadata.candidatesTokenCount || 0;
        totalTotalTokenCount += usageMetadata.totalTokenCount || 0;
        totalThoughtsTokenCount += usageMetadata.thoughtsTokenCount || 0;

        // Sum tokenCount from promptTokensDetails, which is a list
        const promptDetailsList = usageMetadata.promptTokensDetails || [];
        for (const detail of promptDetailsList) {
          totalPromptDetailsTokenCount += detail.tokenCount || 0;
        }

      } catch (error) {
        // This handles cases where an individual entry might be malformed
        console.log(`Warning: Skipping a malformed inlined response entry: ${error.message}`);
        continue; // Continue processing other entries
      }
    }

    // Construct the final output object
    const aggregatedOutput = {
      usageMetadata: {
        promptTokenCount: totalPromptTokenCount,
        candidatesTokenCount: totalCandidatesTokenCount,
        totalTokenCount: totalTotalTokenCount,
        promptTokensDetails: [
          {
            modality: "TEXT", // This field appears to be constant in your sample
            tokenCount: totalPromptDetailsTokenCount
          }
        ],
        thoughtsTokenCount: totalThoughtsTokenCount
      }
    };

    return aggregatedOutput;
  }
}

/**
 * Fetches and parses results from Claude batch job output URL.
 * @param {string} resultsUrl - The URL to download batch results from.
 * @param {string[]} originalPrompts - The original list of prompts for context.
 * @param {boolean} isSingleBatchChat - Flag for single conversational batch.
 * @returns {Promise<string>} Formatted results string.
 */
async function getClaudeJobResult(resultsUrl, originalPrompts, isSingleBatchChat) {
  let returnMessage = '';
  let input_tokens_total = 0, cache_creation_input_tokens_total = 0, cache_read_input_tokens_total = 0, output_tokens_total = 0
  try {
    const resultsResponse = await axios.get(resultsUrl, {
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }
    });
    const jsonlString = resultsResponse.data;

    if (isSingleBatchChat) {
      const { custom_id, result, error } = jsonlString;
      const resultType = result?.type;
      returnMessage += `--- Request Key: ${custom_id || `(Index 1)`} ---\n` +
        `Prompt: ${originalPrompts.join('__')}\n`; // Joined all prompts for single chat

      switch (resultType) {
        case 'succeeded':
          const messageContent = result.message?.content?.[0]?.text;
          returnMessage += `Response: ${messageContent}`;
          break;
        case 'errored':
          returnMessage += `Error: ${JSON.stringify(error || result?.error)}`;
          break;
        case 'expired':
          returnMessage += `Expired: ${JSON.stringify(result)}`;
          break;
        default:
          returnMessage += `Unknown: ${JSON.stringify(result)}`;
          break;
      }
      input_tokens_total += result?.message?.usage?.input_tokens;
      cache_creation_input_tokens_total += result?.message?.usage?.cache_creation_input_tokens;
      cache_read_input_tokens_total += result?.message?.usage?.cache_read_input_tokens;
      output_tokens_total += result?.message?.usage?.output_tokens;
      returnMessage += '\n\n';
    } else {
      const lines = jsonlString.split('\n').filter(line => line.trim() !== '');
      let counter = 0;
      for (const line of lines) {
        try {
          const result = JSON.parse(line);
          const { custom_id, result: resultDetails, error } = result;
          const resultType = resultDetails?.type;
          counter++;
          returnMessage += `--- Request Key: ${custom_id || `(Index ${counter})`} ---\n` +
            `Prompt: ${originalPrompts[counter - 1]}\n`;

          switch (resultType) {
            case 'succeeded':
              const messageContent = resultDetails.message?.content?.[0]?.text;
              returnMessage += `Response: ${messageContent}`;
              break;
            case 'errored':
              returnMessage += `Error: ${JSON.stringify(error || resultDetails?.error)}`;
              break;
            case 'expired':
              returnMessage += `Expired: ${JSON.stringify(resultDetails)}`;
              break;
            default:
              returnMessage += `Unknown: ${JSON.stringify(resultDetails)}`;
              break;
          }
          input_tokens_total += resultDetails?.message?.usage?.input_tokens;
          cache_creation_input_tokens_total += resultDetails?.message?.usage?.cache_creation_input_tokens;
          cache_read_input_tokens_total += resultDetails?.message?.usage?.cache_read_input_tokens;
          output_tokens_total += resultDetails?.message?.usage?.output_tokens;
          returnMessage += '\n\n';
        } catch (parseError) {
          console.error(`Error parsing JSONL line for Claude results: "${line}"`, parseError);
        }
      }
    }
    let usageObj = {
      input_tokens: input_tokens_total,
      cache_creation_input_tokens: cache_creation_input_tokens_total,
      cache_read_input_tokens: cache_read_input_tokens_total,
      output_tokens: output_tokens_total
    }
    return returnMessage + "_USAGE_" + JSON.stringify(usageObj);
  } catch (error) {
    console.error("Error retrieving Claude batch job status or results:", error);
    if (error.response) console.error("Status:", error.response.status, "Data:", error.response.data);
    return `Error fetching Claude batch results: ${error.message}`;
  }
}

/**
 * Parses JSONL string into an array of JSON objects.
 * @param {string} jsonlString - The JSONL string.
 * @returns {Array<object>} An array of parsed JSON objects.
 */
function parseJsonlResults(jsonlString) {
  return jsonlString.trim().split('\n').map(line => {
    if (line) {
      try {
        return JSON.parse(line);
      } catch (parseError) {
        console.error(`Backend: Error parsing JSONL line: ${parseError.message} - Line: ${line}`);
        return { error: "JSON parsing error on result line", rawLine: line };
      }
    }
    return null;
  }).filter(item => item !== null);
}

/**
 * Parses JSONL string for usage data object
 * @param {string} jsonlString - The JSONL string.
 * @returns {Array<object>} An array of parsed JSON objects.
 */
function parseJsonlUsageData(jsonlString) {
  let totalPromptTokenCount = 0;
  let totalCandidatesTokenCount = 0;
  let totalTotalTokenCount = 0;
  let totalThoughtsTokenCount = 0;
  let totalPromptDetailsTokenCount = 0;
  jsonlString.trim().split('\n').forEach(line => {
    if (line) {
      try {
        let obj = JSON.parse(line);
        let usageMetadata = obj?.response?.usageMetadata || obj?.response?.body?.usage;
        // Sum scalar token counts, defaulting to 0 if not present
        totalPromptTokenCount += usageMetadata?.promptTokenCount || usageMetadata?.prompt_tokens || 0;
        totalCandidatesTokenCount += usageMetadata?.candidatesTokenCount || 0;
        totalTotalTokenCount += usageMetadata?.totalTokenCount || usageMetadata?.total_tokens || 0;
        totalThoughtsTokenCount += usageMetadata?.thoughtsTokenCount || usageMetadata?.completion_tokens_details?.reasoning_tokens || 0;
        // Sum tokenCount from promptTokensDetails, which is a list
        const promptDetailsList = usageMetadata?.promptTokensDetails || [];
        for (const detail of promptDetailsList) {
          totalPromptDetailsTokenCount += detail.tokenCount || 0;
        }
      } catch (parseError) {
        console.error(`Backend: Error parsing JSONL line: ${parseError.message} - Line: ${line}`);
        return { error: "JSON parsing error on result line", rawLine: line };
      }
    }
  });
  // Construct the final output object
  const aggregatedOutput = {
    usageMetadata: {
      promptTokenCount: totalPromptTokenCount,
      candidatesTokenCount: totalCandidatesTokenCount,
      totalTokenCount: totalTotalTokenCount,
      promptTokensDetails: [
        {
          modality: "TEXT", // This field appears to be constant in your sample
          tokenCount: totalPromptDetailsTokenCount
        }
      ],
      thoughtsTokenCount: totalThoughtsTokenCount
    }
  };

  return aggregatedOutput;
}


module.exports = {
  submitBatchJob,
  getBatchJobStatus,
  getBatchJobResult,
  jobs, // Export the raw jobs object for file upload service to update
};