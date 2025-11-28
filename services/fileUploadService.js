// services/fileUploadService.js
const axios = require("axios");
const fs = require('fs');
const fsPromise = require('fs/promises');
const mime = require('mime-types');
const nFormData = require('form-data'); // Renamed from FormData to nFormData to avoid conflict

const { UPLOAD_BASE_URL, GOOGLE_API_KEY, OPENAI_API_KEY } = require('../config');

/**
 * Handles the two-step resumable file upload process to Google's File API.
 * @param {string} filePath - The local path to the file to upload (e.g., from Multer temp storage).
 * @param {string} displayName - The display name for the file in the API.
 * @param {string} initialRequestContentType - The Content-Type header for the initial metadata request (e.g., 'application/json').
 * @returns {Promise<object>} - The parsed JSON response from the final upload step, containing file.uri etc.
 */
async function uploadFileResumable(filePath, displayName, initialRequestContentType) {
  try {
    const fileStats = await fsPromise.stat(filePath); // Use async fs.promises.stat
    const numBytes = fileStats.size;
    let mimeType = mime.lookup(filePath) || 'application/json';

    console.log(`Uploading file from temp storage: ${filePath}`);
    console.log(`Size: ${numBytes} bytes`);
    console.log(`MIME Type: ${mimeType}`);

    // --- Step 1: Initial resumable request defining metadata ---
    console.log("Step 1: Initiating resumable upload to Gemini File API...");
    const initialResponse = await axios.post(
      UPLOAD_BASE_URL,
      { file: { display_name: displayName } },
      {
        headers: {
          'x-goog-api-key': GOOGLE_API_KEY,
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': numBytes,
          'X-Goog-Upload-Header-Content-Type': mimeType,
          'Content-Type': initialRequestContentType,
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    const uploadUrl = initialResponse.headers['x-goog-upload-url'];
    if (!uploadUrl) {
      throw new Error("Failed to get X-Goog-Upload-Url from initial upload response.");
    }
    console.log(`Gemini Upload URL received: ${uploadUrl}`);

    // --- Step 2: Upload the actual bytes ---
    console.log("Step 2: Uploading file bytes to Gemini...");
    const fileStream = fs.createReadStream(filePath);
    const finalUploadResponse = await axios.put(
      uploadUrl,
      fileStream,
      {
        headers: {
          'Content-Length': numBytes,
          'X-Goog-Upload-Offset': 0,
          'X-Goog-Upload-Command': 'upload, finalize',
          'Content-Type': mimeType,
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    console.log("File uploaded to Gemini successfully.");
    return finalUploadResponse.data;
  } catch (error) {
    console.error(`Error during resumable file upload for ${filePath}:`, error.message);
    if (error.response) {
      console.error('Gemini API Response status:', error.response.status);
      console.error('Gemini API Response data:', error.response.data);
    }
    throw error;
  } finally {
    // Clean up the temporary file regardless of success or failure
    await fsPromise.unlink(filePath).catch(err => {
      console.error(`Error deleting temp file ${filePath}:`, err);
    });
    console.log(`Cleaned up temporary file: ${filePath}`);
  }
}

/**
 * Uploads a file to OpenAI.
 * @param {string} filePath - The local path to the file.
 * @param {string} purpose - The purpose for the file (e.g., 'batch').
 * @returns {Promise<object>} OpenAI file upload response.
 */
async function uploadFileToOpenAI(filePath, purpose) {
    try {
        const formData = new nFormData();
        formData.append('purpose', purpose);
        const fileBuffer = fs.readFileSync(filePath); // Synchronous read is okay for small files, but async is better for large ones
        formData.append('file', fileBuffer, 'batchinput.jsonl'); // Assuming JSONL for batch
        const response = await axios.post(
            'https://api.openai.com/v1/files',
            formData,
            {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    ...formData.getHeaders(),
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
            }
        );
        return response.data;
    } catch (error) {
        console.error(`Error uploading file to OpenAI from ${filePath}:`, error.message);
        if (error.response) {
            console.error('OpenAI API Response status:', error.response.status);
            console.error('OpenAI API Response data:', error.response.data);
        }
        throw error;
    } finally {
        await fsPromise.unlink(filePath).catch(err => {
            console.error(`Error deleting temp file ${filePath}:`, err);
        });
        console.log(`Cleaned up temporary file: ${filePath}`);
    }
}


module.exports = {
  uploadFileResumable,
  uploadFileToOpenAI,
};