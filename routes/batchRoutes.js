// routes/batchRoutes.js
const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const axios = require('axios');

const batchJobService = require('../services/batchJobService');
const fileUploadService = require('../services/fileUploadService');
const { GOOGLE_API_KEY, OPENAI_API_KEY, BATCH_GENERATE_CONTENT_URL  } = require('../config'); // Needed for some direct checks

// Multer storage configuration: files will be stored in a temporary 'uploads/' directory
const upload = multer({ dest: 'uploads/' });

router.get("/bulk", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "bulk.html"));
});

/**
 * Endpoint to submit a new batch request (text input).
 */
router.post('/submit-batch-job', async (req, res) => {
  const { method, prompts, models, isSingleBatchChat, temperature, systemPrompt } = req.body;
  try {
    const submittedJobs = await batchJobService.submitBatchJob(method, prompts, models, isSingleBatchChat, temperature, systemPrompt);
    res.json(submittedJobs);
  } catch (error) {
    console.error('Error in /submit-batch-job:', error.message);
    res.status(400).json({ error: error.message, details: error.response?.data || error.stack });
  }
});

/**
 * Endpoint to check the status of specific batch jobs.
 */
router.post('/get-batch-job-status', async (req, res) => {
  const { jobIds, isFileUpload, modelId } = req.body;
  try {
    const statusUpdates = await batchJobService.getBatchJobStatus(jobIds, isFileUpload, modelId);
    res.json(statusUpdates);
  } catch (error) {
    console.error('Error in /get-batch-job-status:', error.message);
    res.status(500).json({ error: error.message, details: error.response?.data || error.stack });
  }
});

/**
 * Endpoint to retrieve results of specific batch jobs.
 */
router.post('/get-batch-job-result', async (req, res) => {
  const { jobIds, isSingleBatchChat, isFileUpload, modelId } = req.body;
  try {
    const results = await batchJobService.getBatchJobResult(jobIds, isSingleBatchChat, isFileUpload, modelId);
    res.json(results);
  } catch (error) {
    console.error('Error in /get-batch-job-result:', error.message);
    res.status(500).json({ error: error.message, details: error.response?.data || error.stack });
  }
});

/**
 * API endpoint for handling file uploads from the browser and initiating batch jobs.
 */
router.post('/upload-batch-file', upload.single('userFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  const tempFilePath = req.file.path;
  const originalFileName = req.file.originalname;
  const displayName = path.basename(originalFileName, path.extname(originalFileName));
  const contentTypeForMetadata = 'application/json';
  const targetModel = req.body.targetModel; // 'gemini' or 'openai'

  try {
    if (targetModel === 'gemini') {
      if (!GOOGLE_API_KEY) throw new Error('Google API key not configured.');
      const fileInfo = await fileUploadService.uploadFileResumable(tempFilePath, displayName, contentTypeForMetadata);
      const fileUri = fileInfo.file.uri;
      const batchOperationResponse = await callBatchGenerateContentGemini(fileUri); // Moved this function internally
      res.json({
        message: 'File uploaded to Gemini and batch request initiated successfully.',
        geminiFileUri: fileUri,
        batchOperation: batchOperationResponse,
        details: "You will need to poll the operation name (batchOperation.name) to get the final batch results."
      });
    } else if (targetModel === 'openai') {
      if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured.');
      const fileInfo = await fileUploadService.uploadFileToOpenAI(tempFilePath, 'batch');
      const fileId = fileInfo.id;
      const batchResponse = await initiateOpenAIBatchJob(fileId); // Moved this function internally
      // Update the in-memory jobs object for tracking
      if (!batchJobService.jobs[batchResponse.id]) {
        batchJobService.jobs[batchResponse.id] = { model: 'openai', method: 'file_upload', llmJobId: batchResponse.id, status: 'PENDING', createdAt: new Date(), lastChecked: new Date(), successData: null };
      }
      res.json({
        message: 'File uploaded to OpenAI and batch request initiated successfully.',
        openaiFileId: fileId,
        batchOperation: batchResponse,
        details: "You will need to poll the operation name (batchOperation.id) to get the final batch results."
      });
    } else {
      res.status(400).json({ error: `Unsupported target model for file upload: ${targetModel}` });
    }
  } catch (error) {
    console.error('Error processing browser upload and batch request:', error);
    res.status(500).json({
      error: error.message,
      details: error.response?.data || error.stack
    });
  }
});


// --- Internal helper functions for batchRoutes (could be moved to batchJobService if preferred) ---
/**
 * Initiates a BatchGenerateContent request for Gemini after a file has been uploaded.
 * @param {string} uploadedBatchFileUri - The URI of the uploaded file on Gemini.
 * @returns {Promise<object>} The response from the BatchGenerateContent API.
 */
async function callBatchGenerateContentGemini(uploadedBatchFileUri) {
  if (!uploadedBatchFileUri) {
    throw new Error("No uploaded batch file URI provided for BatchGenerateContent.");
  }
  const batchInputFileId = uploadedBatchFileUri;
  const shortInputFileId = batchInputFileId.split('/').pop();
  console.log(`Initiating BatchGenerateContent using File ID: ${batchInputFileId}`);
  const resourceFileName = `files/${shortInputFileId}`;

  try {
    const batchGeneratePayload = {
      batch: {
        display_name: `my-browser-batch-requests-${Date.now()}`,
        input_config: {
          file_name: resourceFileName
        }
      }
    };
    const batchGenerateResponse = await axios.post(
      BATCH_GENERATE_CONTENT_URL,
      batchGeneratePayload,
      {
        headers: {
          'x-goog-api-key': GOOGLE_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log("BatchGenerateContent request sent for Gemini.");
    return batchGenerateResponse.data;
  } catch (error) {
    console.error("Error calling BatchGenerateContent for Gemini:", error.message);
    if (error.response) {
      console.error('Gemini API Response status:', error.response.status);
      console.error('Gemini API Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Initiates a batch job on OpenAI after a file has been uploaded.
 * @param {string} fileId - The ID of the uploaded file on OpenAI.
 * @returns {Promise<object>} The response from the OpenAI batches API.
 */
async function initiateOpenAIBatchJob(fileId) {
    try {
        const batchResponse = await axios.post(
            'https://api.openai.com/v1/batches',
            {
                input_file_id: fileId,
                endpoint: "/v1/chat/completions",
                completion_window: "24h"
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
            }
        );
        console.log('OpenAI batch job initiated successfully.');
        return batchResponse.data;
    } catch (error) {
        console.error('Error initiating OpenAI batch job:', error.message);
        if (error.response) {
            console.error('OpenAI API Response status:', error.response.status);
            console.error('OpenAI API Response data:', error.response.data);
        }
        throw error;
    }
}

module.exports = router;