// ============================================================================
// bulk.js - Multimodel LLM Portal Frontend Logic
//
// This script manages the user interface for submitting prompts to multiple
// Language Model providers (Gemini, OpenAI, Claude), handling batch processing
// via text input or file upload, displaying job statuses, and retrieving results.
// It also provides utilities for user feedback (toasts) and UI state management.
// ============================================================================

// --- Global Constants and Configurations ---
/**
 * @const {string} GLOBAL_CLAUDE_MODEL - The default Claude model to use for requests.
 *   Ensure this matches your backend configuration.
 */
const GLOBAL_CLAUDE_MODEL = 'claude-3-opus-20240229'; // Or your preferred Claude model

/**
 * @const {string} GLOBAL_OPENAI_MODEL - The default OpenAI model to use for requests.
 *   Ensure this matches your backend configuration.
 */
const GLOBAL_OPENAI_MODEL = 'gpt-3.5-turbo'; // Or 'gpt-4'

/**
 * @const {string} OPEN_AI_BATCH_API_URL - The internal API endpoint for OpenAI chat completions
 *   when creating batch files for OpenAI's batch API.
 */
const OPEN_AI_BATCH_API_URL = '/v1/chat/completions'; // Endpoint for chat completions batch

// --- Type Definitions for JSDoc ---

/**
 * @typedef {object} ModelElements
 * @property {HTMLInputElement} checkbox - The checkbox element to enable/disable the model.
 * @property {HTMLDivElement} outputBox - The div element where the model's responses/job info are displayed.
 * @property {HTMLParagraphElement} placeholder - The placeholder paragraph inside the outputBox.
 * @property {HTMLDivElement} llmColumn - The entire column container for the LLM.
 * @property {HTMLButtonElement} fetchStatusBtn - Button to fetch the status of jobs for this model.
 * @property {HTMLButtonElement} fetchResultBtn - Button to fetch the results of jobs for this model.
 * @property {HTMLButtonElement} clearAreaBtn - Button to clear the output area for this model.
 * @property {Array<JobInfo>} jobs - An array to track all submitted jobs for this model.
 */

/**
 * @typedef {object} JobInfo
 * @property {string} internalJobId - A unique ID assigned by the frontend/backend for internal tracking.
 * @property {string} [llmJobId] - The job ID assigned by the LLM provider (e.g., Gemini's operation name, OpenAI's batch ID).
 * @property {string} status - The current status of the job (e.g., 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED').
 * @property {string} model - The ID of the model this job was submitted to ('gemini', 'openai', 'claude').
 * @property {string} [result] - The final result or a summary of the job if available.
 * @prop {object} tokenUsage - The token usage info
 */

/**
 * @typedef {'success'|'failure'|'info'|'general'} ToastType
 */

// --- DOM Element References ---
/** @const {HTMLTextAreaElement} */
const mainInputBox = document.getElementById('main-input-box');
/** @const {HTMLButtonElement} */
const submitBtn = document.getElementById('submit-btn');
/** @const {HTMLDivElement} */
const overallStatusToast = document.getElementById('overall-status-toast');
/** @const {HTMLDivElement} */
const batchModeToast = document.getElementById('batch-mode-toast'); // Toast for batch validation

// Batch mode checkboxes and file input
/** @const {HTMLInputElement} */
const temperatureInput = document.getElementById('temperatureInput'); // The value of temperature 
/** @const {HTMLInputElement} */
const sbiCheckbox = document.getElementById('sbi-checkbox'); // Submit as Batch Input (Text Area)
/** @const {HTMLInputElement} */
const sbiCheckboxSingle = document.getElementById('sbi-checkbox-single'); // Submit as Single Chat Batch
/** @const {HTMLInputElement} */
const sbfCheckbox = document.getElementById('sbf-checkbox'); // Submit as Batch File (Upload)
/** @const {HTMLButtonElement} */
const tdffBtn = document.getElementById('tdff-btn'); // Transform Data For File button
/** @const {HTMLInputElement} */
const batchFileInput = document.getElementById('batch-file-input');

// LLM Checkboxes
/** @const {HTMLInputElement} */
const geminiCheckbox = document.getElementById('gemini-checkbox');
/** @const {HTMLInputElement} */
const openaiCheckbox = document.getElementById('openai-checkbox');
/** @const {HTMLInputElement} */
const claudeCheckbox = document.getElementById('claude-checkbox');

// LLM Output Areas
/** @const {HTMLDivElement} */
const geminiOutput = document.getElementById('gemini-output');
/** @const {HTMLDivElement} */
const openaiOutput = document.getElementById('openai-output');
/** @const {HTMLDivElement} */
const claudeOutput = document.getElementById('claude-output');

// LLM Output Usage Output Areas
/** @const {HTMLDivElement} */
const geminiUsageOutput = document.getElementById('gemini-usage');
/** @const {HTMLDivElement} */
const openaiUsageOutput = document.getElementById('openai-usage');
/** @const {HTMLDivElement} */
const claudeUsageOutput = document.getElementById('claude-usage');

// LLM Status Toasts
/** @const {HTMLDivElement} */
const geminiStatusToast = document.getElementById('gemini-status-toast');
/** @const {HTMLDivElement} */
const openaiStatusToast = document.getElementById('openai-status-toast');
/** @const {HTMLDivElement} */
const claudeStatusToast = document.getElementById('claude-status-toast');

// LLM Fetch/Clear Buttons
/** @const {HTMLButtonElement} */
const geminiFetchStatusBtn = document.getElementById('gemini-fetch-status-btn');
/** @const {HTMLButtonElement} */
const geminiFetchResultBtn = document.getElementById('gemini-fetch-result-btn');
/** @const {HTMLButtonElement} */
const geminiClearAreaBtn = document.getElementById('gemini-clear-area-btn'); // Clear area button

/** @const {HTMLButtonElement} */
const openaiFetchStatusBtn = document.getElementById('openai-fetch-status-btn');
/** @const {HTMLButtonElement} */
const openaiFetchResultBtn = document.getElementById('openai-fetch-result-btn');
/** @const {HTMLButtonElement} */
const openaiClearAreaBtn = document.getElementById('openai-clear-area-btn'); // Clear area button

/** @const {HTMLButtonElement} */
const claudeFetchStatusBtn = document.getElementById('claude-fetch-status-btn');
/** @const {HTMLButtonElement} */
const claudeFetchResultBtn = document.getElementById('claude-fetch-result-btn');
/** @const {HTMLButtonElement} */
const claudeClearAreaBtn = document.getElementById('claude-clear-area-btn'); // Clear area button

// File Upload Buttons
/** @const {HTMLButtonElement} */
const uploadButton = document.getElementById('uploadButton');
/** @const {HTMLButtonElement} */
const uploadButtonOI = document.getElementById('uploadButtonOI');

/**
 * @const {HTMLPreElement} responseOutput - Element to display raw API responses or debugging info.
 *   NOTE: This element is referenced in JS and CSS but is missing from the provided HTML.
 *   Add `<pre id="responseOutput"></pre>` to your HTML if you intend to use it.
 */
const responseOutput = document.getElementById('responseOutput');


/**
 * @const {Object<string, ModelElements>} modelElements - A map linking model IDs to their
 *   associated DOM elements for easier access and management.
 */
const modelElements = {
    'gemini': {
        checkbox: geminiCheckbox,
        outputBox: geminiOutput,
        statusToast: geminiStatusToast,
        placeholder: geminiOutput.querySelector('.placeholder'),
        llmColumn: document.getElementById('llm-gemini-column'),
        fetchStatusBtn: geminiFetchStatusBtn,
        fetchResultBtn: geminiFetchResultBtn,
        clearAreaBtn: geminiClearAreaBtn, // Add clear area button
        jobs: [], // Initialize jobs array for internal tracking
        usageTrackingArea: geminiUsageOutput
    },
    'openai': {
        checkbox: openaiCheckbox,
        outputBox: openaiOutput,
        statusToast: openaiStatusToast,
        placeholder: openaiOutput.querySelector('.placeholder'),
        llmColumn: document.getElementById('llm-openai-column'),
        fetchStatusBtn: openaiFetchStatusBtn,
        fetchResultBtn: openaiFetchResultBtn,
        clearAreaBtn: openaiClearAreaBtn, // Add clear area button
        jobs: [],
        usageTrackingArea: openaiUsageOutput
    },
    'claude': {
        checkbox: claudeCheckbox,
        outputBox: claudeOutput,
        statusToast: claudeStatusToast,
        placeholder: claudeOutput.querySelector('.placeholder'),
        llmColumn: document.getElementById('llm-claude-column'),
        fetchStatusBtn: claudeFetchStatusBtn,
        fetchResultBtn: claudeFetchResultBtn,
        clearAreaBtn: claudeClearAreaBtn, // Add clear area button
        jobs: [],
        usageTrackingArea: claudeUsageOutput
    }
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Debounce utility function to limit how often a function can run.
 * Useful for input events to prevent excessive function calls.
 *
 * @param {Function} func - The function to debounce.
 * @param {number} delay - The debounce delay in milliseconds.
 * @returns {Function} A new function that, when invoked, will wait until
 *   after `delay` milliseconds have passed since the last time it was invoked.
 */
function debounce(func, delay) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

/**
 * Displays a toast message with a specific type and optional auto-hide timeout.
 *
 * @param {HTMLElement} element - The toast element to display.
 * @param {string} message - The message text to show in the toast.
 * @param {ToastType} type - The type of toast ('success', 'failure', 'info', 'general') for styling.
 * @param {number} [timeout=5000] - How long to display the toast in milliseconds (0 for no auto-hide).
 */
function showToast(element, message, type, timeout = 5000) {
    element.textContent = message;
    element.className = `status-toast ${type} show`;
    element.style.visibility = 'visible'; // Ensure visibility for CSS transitions
    if (timeout > 0) {
        setTimeout(() => hideToast(element), timeout);
    }
}

/**
 * Hides a toast message and resets its styling and content.
 *
 * @param {HTMLElement} element - The toast element to hide.
 */
function hideToast(element) {
    element.classList.remove('show');
    // Use a small delay to allow CSS opacity transition to complete before
    // completely hiding, preventing sudden message disappearance.
    setTimeout(() => {
        element.textContent = '';
        element.classList.remove('success', 'failure', 'info', 'general');
        element.style.visibility = 'hidden'; // Hide completely after transition
    }, 300); // Matches CSS transition duration
}

/**
 * Parses multi-line raw Gemini API response data into a more readable string format.
 *
 * @param {Array<object>} data - An array of Gemini response objects.
 * @returns {string} A formatted string summarizing the responses.
 */
function parseGeminiResponse(data) {
    let result = '--- Gemini Batch Results ---\n';
    if (data && data.length) {
        data.forEach((v) => {
            const key = v?.metadata?.key;
            const text = v?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
            result += `Prompt Key: ${key || 'N/A'}\nResponse: ${text || 'No response content'}\n---\n`;
        });
    } else {
        result += 'No detailed results available.\n';
    }
    return result;
}

/**
 * Parses multi-line raw OpenAI API response data into a more readable string format.
 *
 * @param {Array<object>} data - An array of OpenAI response objects.
 * @returns {string} A formatted string summarizing the responses.
 */
function parseOpenAIResponse(data) {
    let result = '--- OpenAI Batch Results ---\n';
    if (data && data.length) {
        data.forEach((v) => {
            const customId = v?.custom_id;
            const content = v?.response?.body?.choices?.[0]?.message?.content;
            result += `Custom ID: ${customId || 'N/A'}\nResponse: ${content || 'No response content'}\n---\n`;
        });
    } else {
        result += 'No detailed results available.\n';
    }
    return result;
}

// ============================================================================
// UI Management Functions
// ============================================================================

/**
 * Clears the content of an LLM's output box, displays a placeholder,
 * and resets its internal job tracking array.
 * Also updates the state of fetch buttons for that model.
 *
 * @param {string} modelId - The ID of the model ('gemini', 'openai', 'claude').
 */
function clearOutput(modelId) {
    const modelProps = modelElements[modelId]; // Get the properties for the model
    const { outputBox } = modelProps;
    outputBox.innerHTML = ''; // Clear all existing job entries

    const placeholderText = `${modelId.charAt(0).toUpperCase() + modelId.slice(1)}'s job info and results will appear here...`;
    outputBox.innerHTML = `<p class="placeholder">${placeholderText}</p>`;

    // IMPORTANT FIX: Re-reference the placeholder element after innerHTML change
    // This ensures modelProps.placeholder always points to the currently active placeholder in the DOM.
    modelProps.placeholder = outputBox.querySelector('.placeholder');

    // Clear stored jobs
    modelElements[modelId].jobs = []; // Reset internal job tracking for this model
    updateModelFetchButtons(modelId); // Update buttons after clearing jobs
    submitBtn.disabled = false;
}

/**
 * Appends new job information to the top of a specific LLM's output box.
 * Removes the placeholder if present and stores the job internally.
 *
 * @param {string} modelId - The ID of the model ('gemini', 'openai', 'claude').
 * @param {JobInfo} jobInfo - An object containing details about the job.
 */
function appendJobInfoToOutput(modelId, jobInfo) {
    const { outputBox } = modelElements[modelId];

    // Remove placeholder if present
    if (outputBox.querySelector('.placeholder')) {
        outputBox.innerHTML = '';
    }

    const jobElement = document.createElement('div');
    jobElement.classList.add('llm-job-entry'); // Use 'llm-job-entry' for the container
    jobElement.dataset.internalJobId = jobInfo.internalJobId; // Store internal ID for lookup
    jobElement.dataset.llmJobId = jobInfo.llmJobId || jobInfo.internalJobId; // Store LLM provider ID or fallback
    jobElement.dataset.jobStatus = jobInfo.status; // Store status

    const jobStatusClass = jobInfo.status ? jobInfo.status.toLowerCase() : 'unknown';

    jobElement.innerHTML = `
        <div class="job-row">
            <span class="job-id">${jobInfo.llmJobId || jobInfo.internalJobId}</span>
            <span class="job-status ${jobStatusClass}">${jobInfo.status || 'UNKNOWN'}</span>
        </div>
        ${jobInfo.result ? `<div class="job-result"><strong>Result:</strong><pre>${jobInfo.result}</pre></div>` : ''}
    `;
    outputBox.prepend(jobElement); // Add to top for latest first
    outputBox.scrollTop = 0; // Scroll to top to see new job

    // Add job to internal tracking array for this model
    if (!modelElements[modelId].jobs) {
        modelElements[modelId].jobs = [];
    }
    modelElements[modelId].jobs.push(jobInfo);
}

/**
 * Updates an existing job entry in the output box and in the internal tracking array.
 *
 * @param {string} modelId - The ID of the model ('gemini', 'openai', 'claude').
 * @param {JobInfo} updatedJobInfo - An object with updated job details. Must include `internalJobId`.
 */
function updateJobInfoInOutput(modelId, updatedJobInfo) {
    const { outputBox, usageTrackingArea } = modelElements[modelId];
    const existingJobElement = outputBox.querySelector(`[data-internal-job-id="${updatedJobInfo.internalJobId}"]`);

    if (existingJobElement) {
        existingJobElement.dataset.jobStatus = updatedJobInfo.status; // Update status in dataset

        const statusSpan = existingJobElement.querySelector('.job-status');
        if (statusSpan) {
            statusSpan.textContent = updatedJobInfo.status;
            statusSpan.className = `job-status ${updatedJobInfo.status.toLowerCase()}`;
        }

        if (updatedJobInfo.result) {
            let resultContainer = existingJobElement.querySelector('.job-result');
            if (!resultContainer) {
                resultContainer = document.createElement('div');
                resultContainer.classList.add('job-result');
                existingJobElement.appendChild(resultContainer);
            }
            // Ensure pre tag for results
            // resultContainer.innerHTML = `<strong>Result:</strong><pre>${updatedJobInfo.result}</pre>`;
            resultContainer.textContent = updatedJobInfo.result;

        }

        if (usageTrackingArea && updatedJobInfo.usageData) {
            usageTrackingArea.textContent = JSON.stringify(updatedJobInfo.usageData, null, 2)
        }
    }

    // Update the internal job tracking array
    if (modelElements[modelId].jobs) {
        const jobIndex = modelElements[modelId].jobs.findIndex(j => j.internalJobId === updatedJobInfo.internalJobId);
        if (jobIndex !== -1) {
            modelElements[modelId].jobs[jobIndex] = { ...modelElements[modelId].jobs[jobIndex], ...updatedJobInfo };
        }
    }
}

/**
 * Disables primary UI elements during an active request to prevent user interaction.
 */
function disableUI() {
    mainInputBox.disabled = true;
    sbiCheckbox.disabled = true;
    sbiCheckboxSingle.disabled = true;
    sbfCheckbox.disabled = true;
    tdffBtn.disabled = true;
    batchFileInput.disabled = true;
    submitBtn.disabled = true;
    uploadButton.disabled = true;
    uploadButtonOI.disabled = true;

    // Disable all LLM-specific checkboxes and fetch buttons during main request
    Object.values(modelElements).forEach(({ checkbox, fetchStatusBtn, fetchResultBtn, clearAreaBtn, llmColumn, outputBox }) => {
        checkbox.disabled = true;
        fetchStatusBtn.disabled = true;
        fetchResultBtn.disabled = true;
        clearAreaBtn.disabled = true; // Disable clear button
        llmColumn.classList.add('disabled-llm-column'); // Add class to dim entire column
        outputBox.classList.add('disabled'); // Add class to dim output box
    });
}

/**
 * Enables primary UI elements after a request completes or fails,
 * restoring their state based on current batch mode selections.
 */
function enableUI() {
    // Re-enable based on previous state logic, then update full batch UI
    sbiCheckbox.disabled = false;
    sbfCheckbox.disabled = false;
    uploadButton.disabled = false;
    uploadButtonOI.disabled = false;

    // Call updateBatchUI to correctly re-evaluate all states, including:
    // mainInputBox, batchFileInput, tdffBtn, submitBtn, LLM checkboxes, and fetch/clear buttons.
    updateBatchUI();
}

/**
 * Resets the overall UI to a clean state before a new submission.
 * This includes hiding toasts, clearing output areas, and resetting raw response display.
 */
function resetUIForNewRequest() {
    hideToast(overallStatusToast);
    hideToast(batchModeToast);

    // Clear output and status toasts for all models
    Object.entries(modelElements).forEach(([modelId, modelProps]) => {
        hideToast(modelProps.statusToast);
        clearOutput(modelId); // Clears output AND modelElements[modelId].jobs
    });
}

/**
 * Disables specific UI elements related to a model during status/result polling.
 * This is a less aggressive disable than `disableUI`.
 *
 * @param {string} modelId - The ID of the model currently being polled.
 */
function disableUIForPolling(modelId) {
    const { fetchStatusBtn, fetchResultBtn, checkbox, clearAreaBtn } = modelElements[modelId];
    fetchStatusBtn.disabled = true;
    fetchResultBtn.disabled = true;
    checkbox.disabled = true; // Also disable checkbox
    clearAreaBtn.disabled = true; // Disable clear button during polling

    // Keep main submit/upload buttons enabled if they weren't disabled by a full UI disable
    // This allows concurrent actions if backend supports it or if user wants to submit new prompt.
    // Ensure tdffBtn is handled too.
    uploadButton.disabled = true;
    uploadButtonOI.disabled = true;
    tdffBtn.disabled = true;
}

/**
 * Enables specific UI elements related to a model after polling completes.
 * Re-evaluates their states based on the latest job data.
 *
 * @param {string} modelId - The ID of the model that just finished polling.
 */
function enableUIForPolling(modelId) {
    const { checkbox } = modelElements[modelId];
    checkbox.disabled = false; // Re-enable checkbox

    // Re-evaluate main submit and upload buttons
    updateSubmitButtonState();
    updateTdffButtonState();
    uploadButton.disabled = false;
    uploadButtonOI.disabled = false;

    // Re-evaluate fetch and clear buttons for the specific model
    updateModelFetchButtons(modelId);
}

// ============================================================================
// Batch Mode UI Logic
// ============================================================================

/**
 * Updates the disabled state of LLM checkboxes, their associated columns,
 * output boxes, and fetch/clear buttons based on the active batch submission method
 * and, when in SBF mode, the selected file.
 * This function primarily manages the 'disabled' property of the checkboxes.
 * It does NOT automatically 'check' or 'uncheck' enabled checkboxes to allow user control.
 */
function updateModelCheckboxesUI() {
    const isSBISelected = sbiCheckbox.checked; // Submit as Batch Input (Text Area)
    const isSBFSelected = sbfCheckbox.checked; // Submit as Batch File (Upload)

    // First, set default disabled states for all LLMs
    Object.values(modelElements).forEach(({ checkbox, llmColumn, outputBox }) => {
        checkbox.disabled = true; // Start by disabling all
        // Do NOT change checkbox.checked here.
        llmColumn.classList.add('disabled-llm-column');
        outputBox.classList.add('disabled');
    });

    if (isSBISelected) { // Logic for Submit as Batch Input (Text Area)
        // Gemini and Claude are enabled for SBI
        geminiCheckbox.disabled = false;
        claudeCheckbox.disabled = false;

        // OpenAI is disabled for SBI
        openaiCheckbox.disabled = true;

    } else if (isSBFSelected) { // Logic for Submit as Batch File (Upload)
        const file = batchFileInput.files[0];
        if (file) {
            const fileName = file.name.toLowerCase();
            const isGeminiFile = fileName.includes('gemini');
            const isOpenAIFile = fileName.includes('openai');

            if (isGeminiFile && !isOpenAIFile) {
                geminiCheckbox.disabled = false;
            } else if (isOpenAIFile && !isGeminiFile) {
                openaiCheckbox.disabled = false;
            }
            // If neither matches or both match, all remain disabled as per initial reset.
        } else {
            // No file selected in SBF mode, so all LLM checkboxes remain disabled.
        }

        // Claude is always disabled for SBF
        claudeCheckbox.disabled = true;
    } else {
        // Neither SBI nor SBF is selected, all LLM checkboxes remain disabled.
    }

    // Apply visual states and update model-specific buttons
    // This loop now runs *after* the checkbox.disabled states are finalized.
    Object.values(modelElements).forEach(({ checkbox, outputBox, llmColumn }) => {
        if (checkbox.disabled) {
            llmColumn.classList.add('disabled-llm-column');
            outputBox.classList.add('disabled');
        } else {
            llmColumn.classList.remove('disabled-llm-column');
            outputBox.classList.remove('disabled');
        }
        updateModelFetchButtons(checkbox.id.replace('-checkbox', '')); // Update fetch/clear buttons
    });
}

/**
 * Dynamically enables or disables the Gemini and OpenAI upload buttons
 * based on the filename selected in the batch file input.
 * Buttons are only considered if 'Submit as Batch File' is active.
 */
function updateUploadButtonsState() {
    const file = batchFileInput.files[0];
    const isSBFSelected = sbfCheckbox.checked;

    // By default, assume buttons should be disabled.
    uploadButton.disabled = true;
    uploadButtonOI.disabled = true;

    // If 'Submit as Batch File' is not selected, then these buttons
    // should remain disabled and will be hidden by `updateBatchUI`.
    if (!isSBFSelected) {
        return;
    }

    if (file) {
        const fileName = file.name.toLowerCase();
        const isGeminiFile = fileName.includes('gemini');
        const isOpenAIFile = fileName.includes('openai');

        if (isGeminiFile && !isOpenAIFile) {
            uploadButton.disabled = false;
        } else if (isOpenAIFile && !isGeminiFile) {
            uploadButtonOI.disabled = false;
        }
        // If filename contains both "gemini" and "openai", or neither,
        // or other content, both buttons remain disabled.
    }
    // If no file is selected, both buttons remain disabled (initial state or file cleared).
}

/**
 * Handles the logic for updating the entire batch UI based on checkbox selections.
 * This includes managing the state of batch input (text area vs. file),
 * visibility of related buttons (TDFF, Upload), and displaying validation toasts.
 *
 * @param {Event} [e] - The event object from the checkbox change, if applicable.
 */
function updateBatchUI(e) {
    let isSBISelected = sbiCheckbox.checked;
    let isSBFSelected = sbfCheckbox.checked;

    // --- Enforce mutual exclusivity between SBI and SBF ---
    if (e && e.target === sbiCheckbox) {
        if (isSBISelected) {
            sbfCheckbox.checked = false;
            // Auto-check Gemini and Claude when SBI is selected
            geminiCheckbox.checked = true;
            claudeCheckbox.checked = true;
            openaiCheckbox.checked = false; // Ensure OpenAI is unchecked for SBI
        }
        sbiCheckboxSingle.disabled = !isSBISelected;
        if (!isSBISelected) sbiCheckboxSingle.checked = false;
    } else if (e && e.target === sbfCheckbox) {
        if (isSBFSelected) {
            sbiCheckbox.checked = false;
            sbiCheckboxSingle.checked = false;
            sbiCheckboxSingle.disabled = true;
            // Auto-uncheck all LLMs when SBF is selected, they'll be checked by file selection logic
            geminiCheckbox.checked = false;
            openaiCheckbox.checked = false;
            claudeCheckbox.checked = false; // Claude is not for SBF anyway
        }
    }

    // Re-read states after potential changes
    isSBISelected = sbiCheckbox.checked;
    isSBFSelected = sbfCheckbox.checked;

    const anyBatchModeSelected = isSBISelected || isSBFSelected;
    const isBothSelected = isSBISelected && isSBFSelected; // Should be prevented by above logic, but for safety

    // --- Batch Mode Validation Toast ---
    if (!anyBatchModeSelected) {
        showToast(batchModeToast, 'Please select at least one batch submission method (Text Area or File).', 'info', 0);
    } else if (isBothSelected) {
        // This case should ideally not be reachable if mutual exclusivity is enforced correctly
        showToast(batchModeToast, 'For submission, please select EITHER "Text Area" or "File", not both.', 'info', 0);
    } else {
        hideToast(batchModeToast);
    }

    // --- Control Main Input Box and File Input Visibility/State ---
    if (isSBISelected) { // Text Area batch input
        mainInputBox.disabled = false;
        batchFileInput.classList.add('hidden');
        batchFileInput.disabled = true;
        batchFileInput.value = ''; // Clear file input when not used
        tdffBtn.classList.add('hidden'); // TDFF not relevant for SBI
        uploadButton.classList.add('hidden'); // Hide upload buttons
        uploadButtonOI.classList.add('hidden');
        mainInputBox.focus();
    } else if (isSBFSelected) { // Batch File input
        mainInputBox.disabled = false; // Main input box can be used as a source for TDFF
        batchFileInput.classList.remove('hidden');
        batchFileInput.disabled = false;
        tdffBtn.classList.remove('hidden'); // TDFF is relevant for SBF
        uploadButton.classList.remove('hidden'); // Show upload buttons
        uploadButtonOI.classList.remove('hidden');
        updateUploadButtonsState();
    } else { // Neither selected
        mainInputBox.disabled = true;
        mainInputBox.value = ''; // Clear main input when not used
        batchFileInput.classList.add('hidden');
        batchFileInput.disabled = true;
        batchFileInput.value = '';
        tdffBtn.classList.add('hidden');
        uploadButton.classList.add('hidden'); // Hide upload buttons
        uploadButtonOI.classList.add('hidden');
    }

    // Update LLM checkboxes and their dependent UI states
    updateModelCheckboxesUI();
    // Re-evaluate submit and TDFF button states after all other UI changes
    updateSubmitButtonState();
    updateTdffButtonState();
}

/**
 * Determines whether the main `submitBtn` should be enabled or disabled
 * based on the selected batch mode, input content, and selected LLMs.
 */
function updateSubmitButtonState() {
    const isSBISelected = sbiCheckbox.checked;
    const isSBFSelected = sbfCheckbox.checked;

    const anyBatchModeSelected = isSBISelected || isSBFSelected;
    const isBothSelected = isSBISelected && isSBFSelected; // Should be mutually exclusive, but for safety

    const promptHasContent = mainInputBox.value.trim() !== '';
    const fileHasContent = batchFileInput.files.length > 0;
    const anyLLMSelected = Object.values(modelElements).some(m => m.checkbox.checked && !m.checkbox.disabled);

    let canSubmit = false;

    if (!anyBatchModeSelected || isBothSelected) {
        canSubmit = false;
    } else if (isSBISelected) { // Submit as Batch Input (Text Area)
        canSubmit = promptHasContent && anyLLMSelected;
    } else if (isSBFSelected) { // Submit as Batch File (File Upload)
        // Main submit button is only for text input or direct backend submit for files
        // For SBF, actual submission is via upload buttons. So this `submitBtn` would generally be disabled.
        // It could be re-enabled if SBF implied a *direct* submission to backend with a pre-selected file.
        // As per current structure, SBF means using `uploadButton` or `uploadButtonOI`.
        canSubmit = false; // `submitBtn` is not used for file upload direct submission currently
    }

    submitBtn.disabled = !canSubmit;
}

/**
 * Helper function consolidating the call to updateSubmitButtonState and tdff button
 */
function updateSubmitButtonStateAndTdffStatus(e) {
    updateSubmitButtonState();
    updateTdffButtonState();
}

/**
 * Determines File type and accordingly updates UI.
 */
function handleFileChange(e) {
    updateSubmitButtonState();
    updateUploadButtonsState();       // Update upload buttons (based on filename)
    // When a file is selected in SBF mode, we need to ensure the correct LLM checkbox is checked.
    // updateModelCheckboxesUI will correctly enable/disable based on filename,
    // but won't *check* it. We need to do that based on the same filename logic.
    const file = batchFileInput.files[0];
    if (sbfCheckbox.checked && file) {
        const fileName = file.name.toLowerCase();
        const isGeminiFile = fileName.includes('gemini');
        const isOpenAIFile = fileName.includes('openai');

        // Reset all LLM checkboxes when a new file is chosen, then set only the relevant one.
        geminiCheckbox.checked = false;
        openaiCheckbox.checked = false;
        claudeCheckbox.checked = false;

        if (isGeminiFile && !isOpenAIFile) {
            geminiCheckbox.checked = true;
        } else if (isOpenAIFile && !isGeminiFile) {
            openaiCheckbox.checked = true;
        }
    } else if (sbfCheckbox.checked && !file) { // If SBF is selected but file is cleared
        geminiCheckbox.checked = false;
        openaiCheckbox.checked = false;
        claudeCheckbox.checked = false;
    }

    updateModelCheckboxesUI(); // Recalculate disabled states based on the new check state
}

/**
 * Determines whether the TDFF (Transform Data For File) button should be enabled or disabled.
 * TDFF is only enabled when 'Submit as Batch File' is selected,
 * the main input box has content, and at least one compatible LLM (Gemini or OpenAI) is selected.
 */
function updateTdffButtonState() {
    const isSBFSelected = sbfCheckbox.checked;
    const promptHasContent = mainInputBox.value.trim() !== '';
    tdffBtn.disabled = !(isSBFSelected && promptHasContent);
}

/**
 * Updates the disabled state of "Fetch Status", "Fetch Result", and "Clear Area" buttons
 * for a specific LLM based on its checkbox status and whether it has active jobs or visible content.
 *
 * @param {string} modelId - The ID of the model ('gemini', 'openai', 'claude').
 */
function updateModelFetchButtons(modelId) {
    const { checkbox, fetchStatusBtn, fetchResultBtn, clearAreaBtn, jobs, outputBox, placeholder } = modelElements[modelId];

    // Buttons are always disabled if the model's checkbox is disabled.
    if (checkbox.disabled) {
        fetchStatusBtn.disabled = true;
        fetchResultBtn.disabled = true;
        clearAreaBtn.disabled = true;
        return;
    }

    const hasAnyJobs = jobs && jobs.length > 0;
    fetchStatusBtn.disabled = !hasAnyJobs; // Enable status if any jobs exist

    // Enable Fetch Result if there are any jobs that are 'COMPLETED' or 'FAILED'
    const hasCompletedOrFailedJobs = jobs.some(job => job.status === 'COMPLETED' || job.status === 'FAILED');
    fetchResultBtn.disabled = !hasCompletedOrFailedJobs;

    // --- Specific logic for Clear Area button ---
    // The clear button should be enabled if:
    // 1. There are actual jobs being tracked (even if their display is cleared or pending)
    // 2. OR, if the outputBox contains content *other than just the placeholder*.
    //    We can check if the outputBox has more than one child, or if its first child
    //    is not the placeholder.
    const isOnlyPlaceholder = outputBox.children.length === 1 && outputBox.children[0] === placeholder;

    clearAreaBtn.disabled = !(hasAnyJobs || !isOnlyPlaceholder);
}

// ============================================================================
// Core Event Handlers (API Interactions)
// ============================================================================

/**
 * Parses the content of the main input box into an array of individual prompts.
 * Each non-empty line is treated as a separate prompt.
 *
 * @returns {string[]} An array of trimmed, non-empty prompts.
 */
function getIndividualPrompts() {
    return mainInputBox.value.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

/**
 * Generates and downloads batch files in JSONL format for selected LLMs
 * based on the prompts in the text area. This is triggered by the TDFF button.
 *
 * @param {string[]} individualPrompts - An array of prompts from the text area.
 * @param {string[]} selectedModels - An array of model IDs ('gemini', 'openai')
 *   for which batch files should be generated.
 */
function generateAndDownloadBatchFile(individualPrompts, selectedModels) {
    if (individualPrompts.length === 0) {
        showToast(overallStatusToast, 'No prompts found in the text area to transform.', 'failure');
        return;
    }

    const dateTime = new Date().toISOString().replace(/[:.]/g, '-');
    let generatedCount = 0;

    selectedModels.forEach(modelId => {
        let fileContent = '';
        let fileName = '';

        if (modelId === 'gemini') {
            // Gemini batch file format: JSONL, each line is an object with 'request' and 'metadata'
            individualPrompts.forEach((prompt, index) => {
                const item = {
                    request: { contents: [{ parts: [{ text: prompt }] }] },
                    metadata: { key: `request-${index + 1}` }
                };
                fileContent += JSON.stringify(item) + '\n';
            });
            fileName = `gemini-batch-${dateTime}.jsonl`; // .jsonl is a common extension for JSON Lines

        } else if (modelId === 'openai') {
            // OpenAI batch file format: JSONL, each line is an object with 'custom_id', 'method', 'url', 'body'
            individualPrompts.forEach((prompt, index) => {
                const item = {
                    custom_id: `request-${index + 1}`,
                    method: 'POST',
                    url: OPEN_AI_BATCH_API_URL,
                    body: {
                        model: GLOBAL_OPENAI_MODEL,
                        messages: [{ role: 'user', content: prompt }]
                    }
                };
                fileContent += JSON.stringify(item) + '\n';
            });
            fileName = `openai-batch-${dateTime}.jsonl`;

        }
        // Claude does not have a "batch file" API in the same sense, so it's skipped here.

        if (fileContent && fileName) {
            const blob = new Blob([fileContent], { type: 'application/jsonl' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url); // Clean up the URL object
            generatedCount++;
        }
    });

    if (generatedCount > 0) {
        showToast(overallStatusToast, `Generated ${generatedCount} batch file(s) for download.`, 'success');
    } else {
        showToast(overallStatusToast, 'No compatible LLMs selected for batch file generation (OpenAI and Gemini supported).', 'info');
    }
}

/**
 * Handles the main submission process for text-based prompts.
 * This function is responsible for preparing the payload, making the API call,
 * and updating the UI with job information.
 */
async function handleSubmit() {
    resetUIForNewRequest();
    disableUI(); // Disable UI elements during the request

    const isSBISelected = sbiCheckbox.checked;
    const isSBFSelected = sbfCheckbox.checked;
    const selectedModels = Object.keys(modelElements).filter(modelId => modelElements[modelId].checkbox.checked);

    if (isSBISelected && !isSBFSelected) {
        const individualPrompts = getIndividualPrompts();
        if (individualPrompts.length === 0) {
            showToast(overallStatusToast, 'No prompts found in the text area. Please enter prompts, one per line.', 'failure');
            enableUI();
            return;
        }

        const submitPayload = {
            method: 'text_input', // Backend expects this to differentiate submission types
            prompts: individualPrompts,
            models: selectedModels,
            isSingleBatchChat: sbiCheckboxSingle.checked,
            temperature: temperatureInput.value,
            systemPrompt: systemPrompt?.value?.trim()
        };
        console.log('Batch input payload:', submitPayload);
        showToast(overallStatusToast, 'Preparing batch jobs from text input...', 'info');

        try {
            const response = await fetch('/submit-batch-job', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(submitPayload)
            });

            const data = await response.json();

            if (response.ok) {
                console.log('Batch job submission successful:', data);
                let overallMsg = 'Batch jobs submitted:';
                for (const modelId in data) {
                    const jobInfo = data[modelId]; // Backend returns JobInfo for each model
                    const modelName = modelId.charAt(0).toUpperCase() + modelId.slice(1);

                    showToast(modelElements[modelId].statusToast, `${modelName} job ID: ${jobInfo.llmJobId || jobInfo.internalJobId}. Status: ${jobInfo.status}`, 'info', 5000);

                    const jobToStore = { ...jobInfo, model: modelId }; // Add modelId to job info
                    appendJobInfoToOutput(modelId, jobToStore);

                    overallMsg += ` ${modelName} (${jobInfo.llmJobId || jobInfo.internalJobId}, Status: ${jobInfo.status}),`;
                }
                showToast(overallStatusToast, overallMsg.slice(0, -1) + '.', 'success', 0); // Remove trailing comma, no timeout
                selectedModels.forEach(modelId => updateModelFetchButtons(modelId)); // Update buttons after new jobs
            } else {
                console.error('Batch job submission failed:', data);
                showToast(overallStatusToast, `Batch job submission failed: ${data.error || response.statusText}`, 'failure', 0);
            }
        } catch (error) {
            console.error('Network error during batch job submission:', error);
            showToast(overallStatusToast, `Network error: ${error.message}`, 'failure', 0);
        } finally {
            enableUI(); // Re-enable UI after submission attempt
            submitBtn.disabled = true; // disable until previous cleared so no click by mistake
        }
    } else if (isSBFSelected && !isSBISelected) {
        // For file uploads, the primary submission methods are the dedicated 'Upload and Run' buttons.
        // This path serves as a safeguard or fallback but should generally be routed to specific upload handlers.
        console.warn('Attempted to use main submit button for SBF. Please use "Upload and Run" buttons.');
        showToast(overallStatusToast, 'Please use the "Upload and Run" buttons for file batch submission.', 'info', 0);
        enableUI();
    } else {
        // This case should ideally be prevented by updateSubmitButtonState and updateBatchUI
        showToast(overallStatusToast, 'Invalid batch submission method selected.', 'failure');
        enableUI();
    }
}

/**
 * Fetches job status or results for all active jobs of a given model from the backend.
 *
 * @param {string} modelId - The ID of the model ('gemini', 'openai', 'claude').
 * @param {'status'|'result'} fetchType - Specifies whether to fetch 'status' or 'result'.
 */
async function fetchJobInfo(modelId, fetchType) {
    const { statusToast, jobs } = modelElements[modelId];
    if (!jobs || jobs.length === 0) {
        showToast(statusToast, `No active jobs found for ${modelId.charAt(0).toUpperCase() + modelId.slice(1)}.`, 'info');
        return;
    }

    showToast(statusToast, `Fetching ${fetchType} for ${modelId.charAt(0).toUpperCase() + modelId.slice(1)} jobs...`, 'info', 0);
    disableUIForPolling(modelId); // Disable model-specific UI during polling

    try {
        const internalJobIds = jobs.map(job => job.internalJobId);
        const endpoint = fetchType === 'status' ? '/get-batch-job-status' : '/get-batch-job-result';

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobIds: internalJobIds,
                isFileUpload: sbfCheckbox.checked, // Indicate if it's a file upload job
                modelId: modelId, // Needed by backend to route correctly
                isSingleBatchChat: sbiCheckboxSingle.checked // For single chat batch specific logic
            })
        });

        const data = await response.json();

        if (response.ok) {
            // For file upload jobs, there's typically only one LLM batch operation.
            if (sbfCheckbox.checked && jobs.length === 1) {
                let jobData = data.fullResponse || data.batchOperation; // Backend might return different keys
                let latestJob = jobs[0]; // Assuming only one job for file upload per model
                let newStatus = latestJob.status;
                let newResult = latestJob.result;

                if (modelId === 'gemini') {
                    const geminiState = jobData?.metadata?.state;
                    if (geminiState) {
                        newStatus = geminiState.toLowerCase().includes('succeeded') || geminiState.toLowerCase().includes('complete') ? 'COMPLETED' :
                            geminiState.toLowerCase().includes('failed') ? 'FAILED' :
                                geminiState.toLowerCase().includes('running') ? 'RUNNING' : 'PENDING';
                    }
                    if (fetchType === 'result' && data.results && data.results?.length) {
                        newResult = parseGeminiResponse(data.results);
                        newStatus = 'COMPLETED'; // If results are here, job is done
                    } else if (fetchType === 'result' && data && data?.length) {
                        newResult = parseGeminiResponse(data);
                        newStatus = 'COMPLETED'; // If results are here, job is done
                    } else if (fetchType === 'result' && jobData?.response?.result) {
                        newResult = jobData.response.result; // Direct result from operation if available
                    } else if (jobData?.error) {
                        newResult = `Error: ${jobData.error.message || jobData.error}`;
                        newStatus = 'FAILED';
                    } else if (jobData?.response?.responsesFile) {
                        newResult = `Results available at: ${jobData.response.responsesFile}`;
                    }

                } else if (modelId === 'openai') {
                    if (!jobData) {
                        jobData = data[internalJobIds];
                    }
                    let openaiJobStatus = jobData?.status;
                    if (openaiJobStatus) {
                        newStatus = openaiJobStatus.toLowerCase().includes('completed') ? 'COMPLETED' :
                            openaiJobStatus.toLowerCase().includes('failed') ? 'FAILED' :
                                openaiJobStatus.toLowerCase().includes('running') ? 'RUNNING' : openaiJobStatus.toLowerCase().includes('in_progress') ? 'RUNNING' : 'PENDING';
                    }
                    if (fetchType === 'result' && data.results && data.results?.length) {
                        newResult = parseOpenAIResponse(data.results);
                        newStatus = 'COMPLETED'; // If results are here, job is done
                    } else if (fetchType === 'result' && data && data?.length) {
                        newResult = parseOpenAIResponse(data);
                        newStatus = 'COMPLETED';
                    } else if (jobData?.results) {
                        newResult = `Results output file ID: ${jobData.results}`;
                        newStatus = 'COMPLETED'; // If results are here, job is done
                    } else if (jobData?.errors) {
                        newResult = `Errors: ${JSON.stringify(jobData.errors)}`;
                        newStatus = 'FAILED';
                    } else if (jobData?.error) {
                        newResult = `Error: ${jobData.error.message || jobData.error}`;
                        newStatus = 'FAILED';
                    }
                }

                updateJobInfoInOutput(modelId, { internalJobId: latestJob.internalJobId, status: newStatus, result: newResult, model: modelId, usageData: data.usageData });
                showToast(statusToast, `${modelId.charAt(0).toUpperCase() + modelId.slice(1)} ${fetchType} updated. Status: ${newStatus}`, newStatus === 'FAILED' ? 'failure' : 'success');

            } else {
                // Handle multiple job responses for text input batch (or multiple jobs in file mode)
                let anyPending = false;
                for (const internalJobId in data) {
                    const updatedJobInfo = data[internalJobId];
                    // Ensure jobInfo has the model ID for consistency
                    updateJobInfoInOutput(modelId, { ...updatedJobInfo, internalJobId, model: modelId });

                    // Update internal jobs array directly
                    const jobIndex = jobs.findIndex(j => j.internalJobId === internalJobId);
                    if (jobIndex !== -1) {
                        jobs[jobIndex] = { ...jobs[jobIndex], ...updatedJobInfo };
                    }

                    if (['PENDING', 'RUNNING', 'PENDING_SUB_JOBS', 'VALIDATING'].includes(updatedJobInfo.status)) {
                        anyPending = true;
                    }
                }
                showToast(statusToast, `${modelId.charAt(0).toUpperCase() + modelId.slice(1)} ${fetchType} updated. ${anyPending ? 'Some jobs are still pending.' : 'All jobs have a final status.'}`, anyPending ? 'info' : 'success');
            }
        } else {
            console.error(`Failed to fetch ${fetchType} for ${modelId}:`, data);
            showToast(statusToast, `Failed to fetch ${fetchType}: ${data.error || response.statusText}`, 'failure');
        }
    } catch (error) {
        console.error(`Network error fetching ${fetchType} for ${modelId}:`, error);
        showToast(statusToast, `Network error fetching ${fetchType}: ${error.message}`, 'failure');
    } finally {
        enableUIForPolling(modelId); // Re-enable model-specific UI
        submitBtn.disabled = true;
    }
}

/**
 * Handles the file upload process for a specific LLM (Gemini or OpenAI).
 * This function initiates the backend call to upload the file and start a batch job.
 *
 * @param {string} targetModelId - The ID of the target model ('gemini' or 'openai').
 */
async function handleUploadBatchFile(targetModelId) {
    const file = batchFileInput.files[0];
    if (!file) {
        showToast(overallStatusToast, 'Please select a file first (JSONL, JSON, CSV, or TXT).', 'failure');
        return;
    }

    showToast(overallStatusToast, 'Uploading and processing file...')
    hideToast(overallStatusToast);
    hideToast(modelElements[targetModelId].statusToast);
    clearOutput(targetModelId); // Clear previous output for this model

    disableUI(); // Disable full UI during upload

    const formData = new FormData();
    formData.append('userFile', file);
    formData.append('targetModel', targetModelId); // Indicate which model to upload for

    try {
        const response = await fetch('/upload-batch-file', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Batch job submission successful:', data);

            let llmJobId, status, internalJobId;
            if (targetModelId === 'gemini') {
                llmJobId = data.batchOperation.name; // Gemini uses operation name
                status = data.batchOperation.metadata.state;
                internalJobId = llmJobId; // Use LLM ID as internal ID for file uploads
            } else if (targetModelId === 'openai') {
                llmJobId = data.batchOperation.id; // OpenAI uses batch ID
                status = data.batchOperation.status;
                internalJobId = llmJobId; // Use LLM ID as internal ID for file uploads
            } else {
                throw new Error('Unsupported target model for file upload response parsing.');
            }

            // Standardize status for display (e.g., 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED')
            const displayStatus = (status.toLowerCase().includes('pending') || status.toLowerCase().includes('validating')) ? 'PENDING' :
                (status.toLowerCase().includes('succeeded') || status.toLowerCase().includes('complete')) ? 'COMPLETED' :
                    (status.toLowerCase().includes('running')) ? 'RUNNING' : 'UNKNOWN';

            const jobToStore = {
                internalJobId: internalJobId,
                llmJobId: llmJobId,
                status: displayStatus,
                model: targetModelId
            };

            showToast(modelElements[targetModelId].statusToast, `${targetModelId.charAt(0).toUpperCase() + targetModelId.slice(1)} job ID: ${llmJobId}. Status: ${displayStatus}`, 'info', 5000);
            appendJobInfoToOutput(targetModelId, jobToStore);

            showToast(overallStatusToast, `Batch job submitted for ${targetModelId.charAt(0).toUpperCase() + targetModelId.slice(1)} (ID: ${llmJobId}, Status: ${displayStatus}).`, 'success', 0);
            updateModelFetchButtons(targetModelId); // Update buttons after new job
        } else {
            const errorData = await response.json();
            console.error('Batch job submission failed:', errorData);
            showToast(overallStatusToast, `Batch job submission failed: ${errorData.error || response.statusText}`, 'failure', 0);
        }
    } catch (error) {
        showToast(overallStatusToast, `Network error during batch file upload: ${error.message}`, 'failure', 0);
        console.error('Frontend upload error:', error);
    } finally {
        enableUI(); // Re-enable UI after upload attempt
    }
}

// ============================================================================
// Event Listener Bindings
// ============================================================================

// --- Main Input and Submit ---
mainInputBox.addEventListener('input', debounce(updateSubmitButtonStateAndTdffStatus, 300));
batchFileInput.addEventListener('change', updateSubmitButtonState);
batchFileInput.addEventListener('change', handleFileChange);
submitBtn.addEventListener('click', handleSubmit);

// --- Batch Mode Checkboxes and TDFF Button ---
sbiCheckbox.addEventListener('change', updateBatchUI);
sbiCheckboxSingle.addEventListener('change', updateSubmitButtonState); // This checkbox affects submit state, so update it.
sbfCheckbox.addEventListener('change', updateBatchUI);

tdffBtn.addEventListener('click', async () => {
    resetUIForNewRequest();
    disableUI(); // Temporarily disable UI during file generation

    const individualPrompts = getIndividualPrompts();

    if (individualPrompts.length === 0) {
        showToast(overallStatusToast, 'Please enter prompts in the text area before transforming.', 'failure');
        enableUI();
        return;
    }

    showToast(overallStatusToast, 'Generating batch files for download...', 'info');
    generateAndDownloadBatchFile(individualPrompts, ['gemini', 'openai']);

    // Re-enable UI after file generation (add a small delay for user feedback)
    await new Promise(resolve => setTimeout(resolve, 500));
    enableUI();
});

// --- LLM Checkboxes, Fetch, and Clear Buttons ---
Object.entries(modelElements).forEach(([modelId, { checkbox, fetchStatusBtn, fetchResultBtn, clearAreaBtn }]) => {
    checkbox.addEventListener('change', () => {
        updateSubmitButtonState(); // Checkboxes affect main submit button state
        updateTdffButtonState(); // Checkboxes affect TDFF button state
        updateModelFetchButtons(modelId); // Checkboxes affect model's own buttons
        updateModelCheckboxesUI(); // Ensure visual state of column/output is updated
    });
    fetchStatusBtn.addEventListener('click', () => fetchJobInfo(modelId, 'status'));
    fetchResultBtn.addEventListener('click', () => fetchJobInfo(modelId, 'result'));
    clearAreaBtn.addEventListener('click', () => clearOutput(modelId)); // Bind clear area button
});

// --- File Upload Buttons (for SBF mode) ---
uploadButton.addEventListener('click', () => handleUploadBatchFile('gemini'));
uploadButtonOI.addEventListener('click', () => handleUploadBatchFile('openai'));

// --- Window Event Listeners ---
/**
 * Handles the 'beforeunload' event. Modern browsers largely restrict custom messages
 * to prevent abusive behavior. The user will see a generic browser-controlled message.
 * @param {Event} event - The beforeunload event.
 */
window.addEventListener('beforeunload', function (event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    let exit = confirm("are you sure you want to exit?");
    if (!exit) {
        return false;
    }
});


// ============================================================================
// Initial State Setup
// ============================================================================

/**
 * Initializes the UI when the DOM is fully loaded.
 * Sets up placeholders, clears previous states, and applies initial batch mode logic.
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Ensure all output boxes have their placeholders and no stored jobs initially
    Object.keys(modelElements).forEach(modelId => clearOutput(modelId));

    // 2. Hide specific elements that should only appear based on interactions
    batchFileInput.classList.add('hidden');
    tdffBtn.classList.add('hidden');
    uploadButton.classList.add('hidden');
    uploadButtonOI.classList.add('hidden');

    // 3. Initial UI update based on default checkbox states
    // This will correctly configure the main input box, file input, TDFF button,
    // submit button, and LLM checkboxes/fetch buttons.
    updateBatchUI();

    // Ensure initial state for single batch chat checkbox (disabled if SBI isn't checked)
    sbiCheckboxSingle.disabled = !sbiCheckbox.checked;

    // Initially hide toasts
    hideToast(overallStatusToast);
    hideToast(batchModeToast);
});