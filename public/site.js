// --- IMPORTS ---
// import { modelsConfig } from '../common.js'; // Assuming common.js provides modelsConfig now.

/**
 * @typedef {object} ModelConfig
 * @property {string} id - Unique identifier for the model (e.g., 'gemini', 'deepseek').
 * @property {string} name - Display name of the model.
 * @property {string} htmlColumnId - The ID of the HTML element that will display the model's output.
 * @property {string} trackHistoryId - The ID of the checkbox to track history for this model.
 * @property {string} enableId - The ID of the checkbox to enable/disable this model.
 */
/** @type {Array<ModelConfig>} Centralized configuration array for all AI models. */
const modelsConfig = [
    { id: 'gemini', name: 'Gemini', htmlColumnId: 'geminiOut', trackHistoryId: 'trackHisotryGemini', enableId: 'enableGemini' },
    { id: 'deepseek', name: 'Deepseek', htmlColumnId: 'deepOut', trackHistoryId: 'trackHisotryDS', enableId: 'enableDS' },
    { id: 'gpt', name: 'GPT', htmlColumnId: 'gptOut', trackHistoryId: 'trackHisotrygpt', enableId: 'enableGPT' },
    { id: 'claude', name: 'Claude', htmlColumnId: 'claudeOut', trackHistoryId: 'trackHisotryClaude', enableId: 'enableClaude' },
    { id: 'grok', name: 'Grok', htmlColumnId: 'grokeOut', trackHistoryId: 'trackHisotryGrok', enableId: 'enableGrok' }
];


/**
 *  site.js
 *  Main JavaScript file for the interactive web application.
 *  Handles DOM manipulation, event listeners, API interactions, and real-time response handling.
 */

// --- Constants ---
const TOAST_DURATION = 5000; // Duration (ms) for toast messages to be visible.
const DEFAULT_MAX_HISTORY_CLEAR = 1; // Default value for the "Clear X (pairs)" input.
const HISTORY_TRUNCATE_WORD_COUNT = 5; // (c) Configurable: Number of words to display in history list before truncating.
const SELECTED_MODELS = Object.freeze({
    DEFAULT: 1,
    ALL: 2,
    NONE: 3
});



// --- Global State for Shift Feature ---
/** @type {{modelId: string, index: number}|null} Stores the currently selected message for moving (the source). */
let selectedMessageForMove = null;
/** @type {HTMLElement|null} Stores a reference to the DOM element of the selected message for highlighting. */
let selectedMessageDomElement = null;
// shift between gemini and other models
let currentModelState = SELECTED_MODELS.DEFAULT;


// --- Model Configuration ---
// (The typedef ModelConfig above is sufficient)

/**
 * @typedef {object} HistoryMessage
 * @property {'user' | 'model'} role - The role of the message sender.
 * @property {string} fullContent - The original, untruncated content of the message.
 * @property {string} displayContent - The truncated content for display in the history list.
 */

/**
 * @typedef {object} ModelElements
 * @property {HTMLElement} column - The main container element for the model's output.
 * @property {HTMLTextAreaElement} outputDisplay - The textarea element where the model's output is displayed.
 * @property {HTMLInputElement} trackHistoryCheckbox - The checkbox for tracking history.
 * @property {HTMLInputElement} enableCheckbox - The checkbox for enabling/disabling the model.
 * @property {HTMLButtonElement} clearButton - The button to clear the model's output.
 * @property {HTMLButtonElement} retryButton - The button to retry the last query for this specific model.
 * @property {HTMLInputElement} removeLastCount - The count of last history to remove
 * @property {HTMLButtonElement} removeLastButton - The button to remove the last message from this model's history.
 * @property {HTMLElement|null} cutOffReasonLabel - The label for the cutoff reason (if present).
 * @property {HTMLElement|null} cutOffReasonValueSpan - The span displaying the cutoff reason value (if present).
 * @property {Array<HistoryMessage>} chatData - **UPDATED**: The structured chat data for displaying conversation history.
 * @prop {HTMLElement} saveDataButton - the button to export the chat of a model
 * @property {HTMLButtonElement} collapsibleButton - button to show and hide API response
 * @property {HTMLElement|null} ApiResponsePanel - button to show API response
 * @property {HTMLElement|null} historyListElement - **NEW**: The div element to display conversation history.
 */
/**
 * @type {Record<string, ModelElements>} A map for quick lookup of model-specific HTML elements, keyed by model ID.
 * Example: modelElements.gemini.outputDisplay
 */
const modelElements = {};

// --- Global State ---
/** @type {string|undefined} Stores the current unique identifier for the session. Generated if not present. */
let currentSessionGuid = null;
/** @type {string} Stores the last successful query submitted by the user. Used for retry functionality. */
let lastQuery = '';

// --- DOM Element Cache ---
/** @type {HTMLTextAreaElement | null} The main input area for user queries. */
let inputArea = null;
/** @type {HTMLButtonElement | null} The button to submit user queries. */
let submitBtn = null;
/** @type {HTMLElement | null} The loading indicator element, shown during API calls. */
let loadingIndicator = null;
/** @type {HTMLButtonElement | null} The button shift history, not used right now. */
let shiftBtn = null;
/** @type {HTMLButtonElement | null} The button to clear the entire chat history. */
let clearHistoryBtn = null;
/**@type {HTMLInputElement | null } The input button for temperature */
let temperatureInput = null;
/** @type {HTMLButtonElement | null} The button to clear all output windows */
let clearAllOutputBtn = null;
/** @type {HTMLButtonElement | null} The button to save the guid. */
let saveGuidBtn = null;
/** @type {HTMLButtonElement | null} The toggle button to swich states */
let toggleSelectionBtn = null;
/** @type {HTMLInputElement | null } This will toggle a on/off for adding system prompt */
let toggleCheckbox = null;
/** @type {HTMLTextAreaElement | null} The text area that displays the history of all questions asked. */
let questTextArea = null;
/** @type {HTMLInputElement | null} The input for clearing history (X pairs). */
let clearHistoryValueInput = null;
/** @type {HTMLElement | null} The element that displays toast notifications. */
let toastMessageElement = null;
/** @type {NodeJS.Timeout | null} Timer ID for clearing the toast message. */
let toastTimeout = null;

// --- Utility Functions ---

/**
 * Initializes or retrieves the current unique identifier for the session.
 * If `currentSessionGuid` is not set, a new UUID is generated.
 * @returns {string} The session GUID.
 */
function getSessionGuid() {
    if (!currentSessionGuid) {
        currentSessionGuid = self.crypto.randomUUID();
        // Note: If persisting this across page reloads were needed, localStorage would be used here.
        // Example:
        // const storedGuid = localStorage.getItem(GUID_STORAGE_KEY);
        // if (storedGuid) {
        //     currentSessionGuid = storedGuid;
        // } else {
        //     currentSessionGuid = self.crypto.randomUUID();
        //     localStorage.setItem(GUID_STORAGE_KEY, currentSessionGuid);
        // }
    }
    return currentSessionGuid;
}

/**
 * Displays a temporary toast message to the user.
 * @param {string} message - The message content to display.
 * @param {'success' | 'error' | 'warning' | 'info'} type - The type of message, influencing its styling.
 */
function showToast(message, type) {
    if (!toastMessageElement) {
        console.error('Toast message element not found.');
        return;
    }
    // Clear any existing timeout to prevent premature hiding
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    // Reset classes and content
    toastMessageElement.className = ''; // Clear all classes
    toastMessageElement.textContent = message;

    // Apply new classes for type and visibility
    toastMessageElement.classList.add(`toast-${type}`);
    toastMessageElement.classList.add('toast-visible');

    // Hide after duration
    toastTimeout = setTimeout(() => {
        toastMessageElement.classList.remove('toast-visible');
        toastMessageElement.classList.add('toast-hidden'); // Add hidden class for transition
    }, TOAST_DURATION);
}

/**
 * Truncates a given text to a specified number of words and appends an ellipsis.
 * @param {string} text - The input text to truncate.
 * @param {number} wordLimit - The maximum number of words to keep.
 * @returns {string} The truncated text.
 */
function truncateText(text, wordLimit) {
    if (!text) return '';
    const words = text.split(/\s+/); // Split by one or more whitespace characters
    if (words.length > wordLimit) {
        return words.slice(0, wordLimit).join(' ') + '...';
    }
    return text;
}

/**
 * Displays the result of a model's operation in its designated output area.
 * Handles different statuses like 'Success', 'Error', 'Skipped' and applies visual styling.
 *
 * @param {string} componentId - The ID of the model that produced the result (e.g., 'gemini').
 * @param {'Success' | 'Error' | 'Skipped' | 'Complete' | 'Info'} status - The status of the operation.
 * @param {string} result - The content of the result or error message.
 */
function displayResult(componentId, status, result) {
    const model = modelElements[componentId];
    if (!model || !model.outputDisplay) {
        console.error(`Attempted to display result for unknown or uninitialized model: ${componentId}`, result);
        return;
    }

    switch (status) {
        case 'Success':
            const resultData = result.split('___');
            if (resultData && resultData.length === 2) {
                const chatResult = resultData[0];
                const apiResponse = resultData[1];
                model.outputDisplay.value += chatResult + '\n';
                model.outputDisplay.classList.add('success');
                model.outputDisplay.classList.remove('error', 'skip');
                // model.chatData.push(chatResult); // OLD: now handled in handleSubmitClick for structured history

                // (b) Append API response to history if tracking is enabled
                if (model.trackHistoryCheckbox.checked) {
                    model.chatData.push({
                        role: 'model',
                        fullContent: chatResult,
                        displayContent: truncateText(chatResult, HISTORY_TRUNCATE_WORD_COUNT)
                    });
                    renderConversationHistory(componentId); // (a) & (b) Re-render history after adding model response
                }

                if (model.ApiResponsePanel) {
                    model.ApiResponsePanel.textContent = JSON.stringify(JSON.parse(apiResponse), null, 2);
                }
                else {
                    console.warn(`could not find ApiResponse panel for ${componentId}`);
                }
                break;
            }
            else {
                console.warn('letting falling into error');
            }
        case 'Error':
            model.outputDisplay.value += result + '\n';
            model.outputDisplay.classList.add('error');
            model.outputDisplay.classList.remove('success', 'skip');

            // (b) Remove API response to history if tracking is enabled
            if (model.trackHistoryCheckbox.checked) {
                // remove 2 => 1 is the error message, 2nd is user message because that's also removed from backend 
                if (model.chatData.length >= 2) {
                    model.chatData.splice(model.chatData.length - 2, 2);
                }
                renderConversationHistory(componentId); // (a) & (b) Re-render history after adding model response
            }
            break;
        case 'Skipped':
            model.outputDisplay.value += result + '\n';
            model.outputDisplay.classList.add('skip');
            model.outputDisplay.classList.remove('success', 'error');
            break;
        case 'Complete':
            console.log('Operation complete for model:', componentId);
            break;
        case 'Info':
            console.log(`Info for ${componentId}:`, result);
            // Optionally display info elsewhere (e.g., toast, dedicated info panel)
            break;
        default:
            console.error(`Received unexpected status "${status}" for model ${componentId}:`, result);
            break;
    }
}

/**
 * Renders the conversation history for a specific model into its designated history list element.
 * Includes interactive elements for deleting and selecting messages.
 * (a) The section/div should be scroll-able to new message do not clutter the UI
 * (b) all message should be appended, after user submission and api response
 * (c) since the text can be long, it should be after after a few words, this "few words" count should be configurable
 * (d) there should be a option to see the whole text somehow if needed (either on hover as tooltip, or on click, or whatever)
 * (i) next to each one should be a small button
 * (ii) or on double click of that particular line/chat (iii) or via any other means to interact. Upon the click (either button next to it, or double click or whatever you decide, it should)
 *
 * @param {string} modelId - The ID of the model whose history is to be rendered.
 */
// function renderConversationHistory(modelId) {
//     const model = modelElements[modelId];
//     if (!model || !model.historyListElement || !model.chatData) {
//         return;
//     }

//     model.historyListElement.innerHTML = ''; // Clear existing history

//     model.chatData.forEach((message, index) => {
//         const messageDiv = document.createElement('div');
//         messageDiv.classList.add('history-message', `history-${message.role}-message`);
//         messageDiv.title = message.fullContent; // (d) Full text on hover tooltip

//         const messageNumber = index + 1; // Consecutive numbering for each message

//         messageDiv.innerHTML = `
//             <span class="history-message-number">${messageNumber}.</span>
//             <span class="history-message-role">${message.role === 'user' ? 'User' : 'Model'}:</span>
//             <span class="history-message-content">${message.displayContent}</span>
//             <button class="delete-history-btn" data-index="${index}" title="Delete this message">×</button> <!-- (i) Delete button -->
//         `;
//         model.historyListElement.appendChild(messageDiv);
//     });

//     // (a) Scroll to the bottom to show the newest message
//     model.historyListElement.scrollTop = model.historyListElement.scrollHeight;

//     // Attach event listeners for delete buttons using event delegation
//     // This is more efficient than attaching to each button individually
//     model.historyListElement.querySelectorAll('.delete-history-btn').forEach(button => {
//         button.addEventListener('click', (e) => {
//             const messageIndex = parseInt(e.target.dataset.index); // Get the 0-based index
//             handleDeleteMessage(modelId, messageIndex);
//         });
//     });
// }
function renderConversationHistory(modelId) {
    const model = modelElements[modelId];
    if (!model || !model.historyListElement || !model.chatData) {
        return;
    }

    model.historyListElement.innerHTML = ''; // Clear existing history

    model.chatData.forEach((message, index) => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('history-message', `history-${message.role}-message`);
        messageDiv.title = message.fullContent;

        const messageNumber = index + 1;

        messageDiv.innerHTML = `
            <span class="history-message-number">${messageNumber}.</span>
            <span class="history-message-role">${message.role === 'user' ? 'User' : 'Model'}:</span>
            <span class="history-message-content">${message.displayContent}</span>
            <button class="delete-history-btn" data-model-id="${modelId}" data-index="${index}" title="Delete this message">×</button>
        `;

        // Add selection/move listener (replaces previous simple selection)
        messageDiv.addEventListener('click', (e) => {
            // Prevent selection if clicking the delete button itself
            if (e.target.classList.contains('delete-history-btn')) {
                return;
            }
            handleMessageInteraction(modelId, index, messageDiv, message.displayContent);
        });

        model.historyListElement.appendChild(messageDiv);
    });

    // Re-apply highlight if the currently selected message is still in the history
    if (selectedMessageForMove && selectedMessageForMove.modelId === modelId) {
        // We need to re-query the DOM element because it was re-rendered
        const reRenderedSelected = model.historyListElement.querySelector(`.history-message:nth-child(${selectedMessageForMove.index + 1})`);
        if (reRenderedSelected) {
            reRenderedSelected.classList.add('selected-for-move');
            selectedMessageDomElement = reRenderedSelected;
        } else {
            // If the selected message was deleted or moved, clear selection state
            selectedMessageForMove = null;
            selectedMessageDomElement = null;
        }
    }

    // Scroll to the bottom
    model.historyListElement.scrollTop = model.historyListElement.scrollHeight;

    // Attach event listeners for delete buttons using event delegation
    model.historyListElement.querySelectorAll('.delete-history-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const messageIndex = parseInt(e.target.dataset.index);
            const messageModelId = e.target.dataset.modelId;
            handleDeleteMessage(messageModelId, messageIndex);
        });
    });
}


/**
 * Handles the deletion of a specific message from a model's conversation history.
 * (A) asks the user to confirm if they want to delete it.
 * (B) goes to the backend to remove that particular message from history.
 * (C) upon success, removes that particular chat from the conversation history section,
 *     while also updating the sequence number to be in sync with backend.
 *
 * @param {string} modelId - The ID of the model whose message is to be deleted.
 * @param {number} messageIndex - The 0-based index of the message to delete.
 */
async function handleDeleteMessage(modelId, messageIndex) {
    // (A) Ask the user to confirm
    const confirmDelete = confirm(`Are you sure you want to delete message #${messageIndex + 1} for ${modelId.toUpperCase()}?`);
    if (!confirmDelete) {
        showToast('Message deletion cancelled.', 'info');
        return;
    }

    const guid = getSessionGuid();

    try {
        // (B) Go to the backend to remove the message
        const response = await fetch('/api/deleteMessage', { // NEW ENDPOINT
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modelId, guid, messageIndex })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Client Error: Server error deleting message for ${modelId}: ${response.status} - ${errorText}`);
            showToast(`Error deleting message: ${response.status} - ${errorText}`, "error");
            return;
        }

        const data = await response.json();

        if (data.message === "Message deleted successfully") {
            showToast(`Message #${messageIndex + 1} for ${modelId.toUpperCase()} deleted.`, "success");

            // (C) Update client-side chatData and re-render
            const model = modelElements[modelId];
            if (model && model.chatData) {
                model.chatData.splice(messageIndex, 1); // Remove from client-side array
                renderConversationHistory(modelId); // Re-render to update numbers
                // Also update the main output textarea for this model
                // This is less precise, ideally the server would send back the full updated history text.
                // For now, we'll just clear the output box to signify the change.
                model.outputDisplay.value = ''; // Clear for now, could be improved.
            }

        } else {
            console.error(`Server response indicates failure for deleteMessage:`, data);
            showToast(`Failed to delete message: ${data.error || "Unknown error"}`, "error");
        }

    } catch (error) {
        console.error('Network error during deleteMessage request:', error);
        showToast('Network error: Could not delete message.', "error");
    }
}

/**
 * Handles clicks on history messages for selection and moving.
 * (1) double/single click to select a message from chat (we'll use single click)
 * (3) upon clicking "any other message" in the list, a confirmation will come,
 *     "do you want to move the message (k) AFTER the message (p)?"
 * (4) if user accidentally clicks the same message again that he selected, the selection will reset/removed
 * (5) after confirmation, do the same thing you were doing, the backend call
 * (6) on success, re-render the chat.
 *
 * @param {string} modelId - The ID of the model the message belongs to.
 * @param {number} index - The 0-based index of the clicked message.
 * @param {HTMLElement} domElement - The DOM element of the clicked message.
 * @param {string} displayContent - The truncated text content of the clicked message for confirmation.
 */
async function handleMessageInteraction(modelId, index, domElement, displayContent) {
    if (selectedMessageForMove) {
        // A message is already selected (source)
        if (selectedMessageForMove.modelId === modelId && selectedMessageForMove.index === index) {
            // (4) User clicked the same message again, deselect it
            clearMessageSelection();
            showToast('Message deselected.', 'info');
        } else if (selectedMessageForMove.modelId !== modelId) {
            // Cannot move between models for now (simplification)
            showToast('Cannot move messages between different models.', 'warning');
        }
        else {
            // (3) User clicked a *different* message in the *same model* (destination)
            const oldIndex = selectedMessageForMove.index;
            const oldDisplayContent = modelElements[modelId].chatData[oldIndex].displayContent;

            const confirmMove = confirm(`Do you want to move message #${oldIndex + 1}: "${oldDisplayContent}" AFTER message #${index + 1}: "${displayContent}"?`);
            if (!confirmMove) {
                showToast('Message move cancelled.', 'info');
                clearMessageSelection(); // Clear selection after cancellation
                return;
            }

            // (5) Perform the move
            await performMoveMessage(modelId, oldIndex, index);

            clearMessageSelection(); // Clear selection after move attempt
        }
    } else {
        // No message selected yet, this is the first click (source selection)
        selectedMessageForMove = { modelId, index };
        selectedMessageDomElement = domElement;
        selectedMessageDomElement.classList.add('selected-for-move');
        showToast(`Message #${index + 1}: "${displayContent}" from ${modelId.toUpperCase()} selected. Now click on the destination message.`, 'info');
    }
}

/**
 * Clears the current message selection highlight and state.
 */
function clearMessageSelection() {
    if (selectedMessageDomElement) {
        selectedMessageDomElement.classList.remove('selected-for-move');
    }
    selectedMessageForMove = null;
    selectedMessageDomElement = null;
}

/**
 * Performs the actual backend call and client-side update for moving a message.
 * @param {string} modelId - The ID of the model.
 * @param {number} oldIndex - The 0-based index of the message to move.
 * @param {number} targetIndex - The 0-based index of the message AFTER which to insert.
 */
async function performMoveMessage(modelId, oldIndex, targetIndex) {
    const guid = getSessionGuid();
    const model = modelElements[modelId];

    // Calculate the actual newIndex for splice:
    // If we're moving message A (oldIndex) AFTER message B (targetIndex):
    // If oldIndex < targetIndex, the targetIndex becomes (targetIndex - 1) after A is removed.
    // So, we want to insert A at (targetIndex - 1) + 1 = targetIndex.
    // If oldIndex > targetIndex, the targetIndex remains the same relative to the remaining messages.
    // So, we want to insert A at targetIndex + 1.
    // A simpler way: just remove from oldIndex, then insert at targetIndex (adjusted for removal).
    let newIndex;
    if (oldIndex < targetIndex) {
        // If moving down, the actual index of the target message will shift up by 1 when the source message is removed.
        // But we want to place it *after* targetIndex.
        // Example: [A, B, C, D]. Move A (0) after C (2).
        // Remove A: [B, C, D]. targetIndex is still 2. We want to insert A at index 3.
        newIndex = targetIndex; // If removed from earlier, new index is effectively targetIndex
    } else {
        // If moving up, the actual index of the target message will not shift.
        // Example: [A, B, C, D]. Move D (3) after A (0).
        // Remove D: [A, B, C]. targetIndex is 0. We want to insert D at index 1.
        newIndex = targetIndex + 1; // If removed from later, new index is targetIndex + 1
    }

    // Edge case: if moving A (index 0) after B (index 0) of a two-message history, newIndex would be 1.
    // If we try to move message at index 0 after message at index 0, it means move to index 1.
    // if oldIndex === targetIndex && history.length > 1, then newIndex should be targetIndex + 1;
    if (oldIndex === targetIndex) {
        newIndex = targetIndex + 1; // Move right after itself if it's the only option or just after itself
    }
    // Ensure newIndex is within bounds if targetIndex was the last message.
    newIndex = Math.min(newIndex, model.chatData.length);


    try {
        const response = await fetch('/api/moveMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modelId, guid, oldIndex, newIndex }) // Send calculated newIndex
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Client Error: Server error moving message for ${modelId}: ${response.status} - ${errorText}`);
            showToast(`Error moving message: ${response.status} - ${errorText}`, "error");
            return;
        }

        const data = await response.json();

        if (data.message === "Message moved successfully") {
            showToast(`Message #${oldIndex + 1} for ${modelId.toUpperCase()} moved.`, "success");

            // Update client-side chatData and re-render (same logic as backend)
            const [movedMessage] = model.chatData.splice(oldIndex, 1);
            model.chatData.splice(newIndex, 0, movedMessage);
            renderConversationHistory(modelId); // (6) Re-render to update numbers and display

            // Also update the main output textarea for this model (simplistic)
            model.outputDisplay.value = '';

        } else {
            console.error(`Server response indicates failure for moveMessage:`, data);
            showToast(`Failed to move message: ${data.error || "Unknown error"}`, "error");
        }

    } catch (error) {
        console.error('Network error during moveMessage request:', error);
        showToast('Network error: Could not move message.', "error");
    }
}



/**
 * Parses the user input to separate common messages from model-specific directives.
 * Supports formats like: "@gemini(directive text) Common message @all(directive for all)".
 *
 * @param {string} rawInput - The raw text from the input area.
 * @returns {{ commonMessage: string, modelSpecificDirectives: Record<string, { directive: string }>, allMessageText: string, appliesToAll: boolean }}
 *          An object containing:
 *          - commonMessage: The base message to be sent to all enabled models.
 *          - modelSpecificDirectives: An object mapping model IDs to their specific appended directives.
 *          - allMessageText: The message with '@all' directives processed.
 *          - appliesToAll: A flag indicating if '@all' was used.
 */
function parseInputDirectives(rawInput) {
    const commonMessageParts = [];
    const modelSpecificDirectives = {}; // { modelId: { directive: "..." } }
    const allMessageParts = [];
    let appliesToAll = false;

    // Regex to find directives like @modelName or @modelName(directive_text), modified now to take two @@ instead of one @
    const directiveRegex = /@@(\w+)(?:\((.*?)\))?/g;

    let lastIndex = 0;
    let match;

    while ((match = directiveRegex.exec(rawInput)) !== null) {
        const modelTarget = match[1]; // e.g., "gemini" or "all"
        const directiveText = match[2] || ""; // e.g., "call me Ravi" or "" if no parentheses

        // Add the text *before* this directive to the common message parts
        commonMessageParts.push(rawInput.substring(lastIndex, match.index));
        allMessageParts.push(rawInput.substring(lastIndex, match.index)); // Add same to 'all' parts initially

        // Process the directive
        if (modelTarget === 'all') {
            appliesToAll = true;
            // Format the directive for the '@all' case. Ensure parentheses are present if text exists.
            allMessageParts.push(directiveText ? `(${directiveText})` : "");
        } else {
            // For specific models
            modelSpecificDirectives[modelTarget] = { directive: directiveText ? `(${directiveText})` : "" };
        }

        lastIndex = directiveRegex.lastIndex; // Update lastIndex to continue search from after the match
    }

    // Add any remaining text after the last directive to the common message parts
    commonMessageParts.push(rawInput.substring(lastIndex));
    allMessageParts.push(rawInput.substring(lastIndex));

    // Construct the final common message by joining parts and trimming
    const finalCommonMessage = commonMessageParts.join('').trim();
    const finalAllMessage = allMessageParts.join('').trim(); // This is the input text with '@all' directives incorporated

    return {
        commonMessage: finalCommonMessage,
        modelSpecificDirectives: modelSpecificDirectives,
        allMessageText: finalAllMessage,
        appliesToAll: appliesToAll
    };
}

// --- Event Handlers ---

/**
 * Handles the submission of user queries to the backend API.
 * Manages loading states, processes API responses (including streaming), and updates the UI.
 * Supports both initial submissions and retries of specific models.
 *
 * @param {Event} e - The click event object.
 * @param {boolean} [ggr=false] - Flag to indicate if Gemini should be retried.
 * @param {boolean} [dsr=false] - Flag to indicate if Deepseek should be retried.
 * @param {boolean} [oir=false] - Flag to indicate if GPT should be retried.
 * @param {boolean} [acr=false] - Flag to indicate if Claude should be retried.
 */
async function handleSubmitClick(e, ggr = false, dsr = false, oir = false, acr = false) {
    const rawInput = inputArea.value?.trim();
    const anyRetryFlagTrue = (ggr || dsr || oir || acr);

    // UI Feedback: Show loading and disable submit button
    if (loadingIndicator) loadingIndicator.style.display = 'inline';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.cursor = 'not-allowed';
        submitBtn.style.backgroundColor = 'grey';
    }

    let finalPayload; // This will contain the data sent to the server
    let userPromptToStore = ''; // The prompt that will be added to client-side history
    let systemPromptValue = '';
    if (toggleCheckbox && systemPrompt?.value) {
        systemPromptValue = systemPrompt?.value?.trim();
    }


    try {
        if (anyRetryFlagTrue) {
            if (!lastQuery) {
                alert('Cannot retry: No previous query found.');
                return;
            }
            // Construct the retry message: Original query + user's new input for context.
            // Note: This 'retryMessage' is what gets sent to the backend, not necessarily what's stored in history directly.
            const retryMessage = `Sorry I missed what you said, can you please repeat? Here's what I said in case you missed: ${lastQuery}. AND: ${rawInput}`;
            const parsedRetryInput = parseInputDirectives(retryMessage);
            userPromptToStore = rawInput || lastQuery; // Store either new input or original lastQuery

            // For retries, determine enabled/checked status based on retry flags and model's current state.
            const retryEnabledList = modelsConfig.map((model, index) => [ggr, dsr, oir, acr][index]);
            const retryCheckedList = modelsConfig.map((model, index) => {
                // Respect the original 'checked' state of the checkbox, but only if the model is being retried and is enabled.
                const modelEl = modelElements[model.id];
                return modelEl?.enableCheckbox.checked && retryEnabledList[index] && modelEl.trackHistoryCheckbox.checked;
            });

            finalPayload = {
                text: retryMessage, // The full prompt sent for this retry
                parsedDirectives: parsedRetryInput,
                enabledList: retryEnabledList,
                checkedList: retryCheckedList,
                guid: getSessionGuid(),
                temperature: temperatureInput.value,
                systemPrompt: systemPromptValue
            };

        } else {
            // Fresh submission
            if (!rawInput) {
                alert('Please enter some text before submitting.');
                return;
            }
            lastQuery = rawInput; // Update lastQuery on fresh submission
            userPromptToStore = rawInput; // Store raw input for fresh submission

            const parsedInput = parseInputDirectives(rawInput);

            // Determine which models are enabled and checked for this submission
            const enabledModelsForSubmission = modelsConfig.map(modelConfig => modelElements[modelConfig.id]?.enableCheckbox.checked ?? false);
            const checkedModelsForSubmission = modelsConfig.map(modelConfig => modelElements[modelConfig.id]?.trackHistoryCheckbox.checked ?? false);

            finalPayload = {
                text: rawInput,
                parsedDirectives: parsedInput,
                enabledList: enabledModelsForSubmission,
                checkedList: checkedModelsForSubmission,
                guid: getSessionGuid(),
                temperature: temperatureInput.value,
                systemPrompt: systemPromptValue
            };

            // Clear all model output styling at the start of a fresh submission
            modelsConfig.forEach(modelConfig => {
                const model = modelElements[modelConfig.id];
                if (model?.outputDisplay) {
                    model.outputDisplay.classList.remove('success', 'error', 'skip');
                }
                // model.chatData = model.chatData || []; // OLD: chatData is initialized in initializeApp now
                // if (modelElements[modelConfig.id]?.enableCheckbox.checked) {
                //     model.chatData.push(rawInput); // OLD: now handled in structured history
                // }
            });

            // Update the quest text area with the current query
            if (questTextArea) {
                questTextArea.value += rawInput + '\n';
            }
        }

        // --- (b) Append user message to history for ENABLED and CHAT-TRACKING models ---
        modelsConfig.forEach((modelConfig, index) => {
            const model = modelElements[modelConfig.id];
            if (model && finalPayload.enabledList[index] && finalPayload.checkedList[index]) { // Only if enabled and tracking chat
                model.chatData.push({
                    role: 'user',
                    fullContent: userPromptToStore, // Use the user-facing prompt for history
                    displayContent: truncateText(userPromptToStore, HISTORY_TRUNCATE_WORD_COUNT)
                });
                renderConversationHistory(modelConfig.id); // (a) Re-render history after adding user prompt
            }
        });


        // --- API Call and SSE Stream Processing ---
        const response = await fetch('/api/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalPayload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Client Error: Server error: ${response.status} - ${errorText}`);
            showToast(`Server error: ${response.status} - ${errorText}`, 'error');
            return; // Exit function if server error
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                console.log('Stream complete.');
                break;
            }

            buffer += decoder.decode(value, { stream: true });

            let lastNewlineIndex;
            while ((lastNewlineIndex = buffer.indexOf('\n\n')) !== -1) {
                const eventBlock = buffer.substring(0, lastNewlineIndex + 2).trim();
                buffer = buffer.substring(lastNewlineIndex + 2);

                const lines = eventBlock.split('\n').filter(line => line.trim() !== '');
                let eventType = 'message';
                let eventData = '';

                lines.forEach(line => {
                    if (line.startsWith('event:')) {
                        eventType = line.substring('event:'.length).trim();
                    } else if (line.startsWith('data:')) {
                        eventData = line.substring('data:'.length).trim();
                    }
                });

                if (eventData) {
                    try {
                        const parsedData = JSON.parse(eventData);
                        switch (eventType) {
                            case 'model_result':
                                displayResult(parsedData.model, 'Success', parsedData.result);
                                break;
                            case 'model_error':
                                // (b) For errors, we should also record it in history if tracking
                                const modelEl = modelElements[parsedData.model];
                                if (modelEl && modelEl.trackHistoryCheckbox.checked) {
                                    const errorMessage = `ERROR: ${parsedData.error}`;
                                    modelEl.chatData.push({
                                        role: 'model', // Even though it's an error, it's the model's response to the prompt
                                        fullContent: errorMessage,
                                        displayContent: truncateText(errorMessage, HISTORY_TRUNCATE_WORD_COUNT)
                                    });
                                    renderConversationHistory(parsedData.model);
                                }
                                displayResult(parsedData.model, 'Error', parsedData.error);
                                break;
                            case 'model_skipped':
                                // (b) For skipped models, also record in history if tracking
                                const skippedModelEl = modelElements[parsedData.model];
                                if (skippedModelEl && skippedModelEl.trackHistoryCheckbox.checked) {
                                    const skippedMessage = `SKIPPED: ${parsedData.result || "Model not enabled or other reason."}`;
                                    skippedModelEl.chatData.push({
                                        role: 'model',
                                        fullContent: skippedMessage,
                                        displayContent: truncateText(skippedMessage, HISTORY_TRUNCATE_WORD_COUNT)
                                    });
                                    renderConversationHistory(parsedData.model);
                                }
                                displayResult(parsedData.model, 'Skipped', parsedData.result || "Skipped: Model not enabled or other reason.");
                                break;
                            case 'all_complete':
                                console.log('All model responses processed:', parsedData.message);
                                const finalResults = parsedData.finalResults;
                                const hasEnabledModels = finalPayload.enabledList.some(Boolean);

                                if (!hasEnabledModels) {
                                    showToast('No models enabled. Request skipped.', 'warning');
                                } else if (finalResults.some(res => res.status === 'error') && !finalResults.some(res => res.status === 'success')) {
                                    showToast('All enabled requests failed!', 'error');
                                } else if (finalResults.some(res => res.status === 'error')) {
                                    showToast('Some requests failed. Check individual model outputs.', 'warning');
                                } else {
                                    showToast('All enabled requests completed successfully!', 'success');
                                }
                                break;
                            case 'server_error':
                                console.error('Server Error:', parsedData.message + (parsedData.error ? ` (${parsedData.error})` : ''));
                                showToast('Server Error: ' + parsedData.message, 'error');
                                break;
                            default:
                                console.warn(`Unknown SSE Event - Type: ${eventType}, Data: ${eventData}`);
                                showToast(`Unknown event type received: ${eventType}`, 'error');
                        }
                    } catch (e) {
                        console.error('Failed to parse SSE data:', e, 'Raw data:', eventData);
                        showToast(`Failed to parse SSE data for event "${eventType}"`, 'error');
                    }
                }
            }
        }
    } catch (error) {
        console.error('Fetch request failed:', error);
        showToast('Network request failed: ' + error.message, 'error');
    } finally {
        // Restore UI state
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.cursor = 'pointer';
            submitBtn.style.backgroundColor = 'blue'; // Or your default submit button color
        }

        if (!anyRetryFlagTrue) { // Only clear input on fresh submission
            if (inputArea) inputArea.value = '';
        }
        if (inputArea) inputArea.focus();
    }
}

/**
 * Clears the chat history from the server and potentially the UI.
 * This function is triggered by the 'Clear History' button.
 *
 * @param {Event} e - The click event object.
 */
async function clearChatHistory(e) {
    if (!clearHistoryValueInput) {
        console.error("Clear history value input element not found.");
        return;
    }
    const valueToClear = clearHistoryValueInput.value;
    const guid = getSessionGuid();

    try {
        const response = await fetch('/api/clearHistory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ valueToClear, guid })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Client Error: Failed to clear history. Server responded with ${response.status}: ${errorText}`);
            showToast('Failed to clear history. See console for details.', 'error');
            return;
        }

        const data = await response.json();
        console.log('History clear API success:', data);
        showToast('Chat history cleared.', 'success');

        // --- Client-side UI Update for ALL models ---
        modelsConfig.forEach(modelConfig => {
            const model = modelElements[modelConfig.id];
            if (model) {
                if (model.outputDisplay) model.outputDisplay.value = '';
                model.chatData = []; // Clear client-side history
                renderConversationHistory(modelConfig.id); // Re-render empty history
            }
        });
        if (questTextArea) questTextArea.value = ''; // Clear the quest text area too

    } catch (error) {
        console.error('Error clearing chat history:', error);
        showToast('Error clearing history: ' + error.message, 'error');
    } finally {
        // Reset the control value if needed
        clearHistoryValueInput.value = DEFAULT_MAX_HISTORY_CLEAR;
    }
}

/**
 * clears all output console windows
 * @param {Event} e - The click event object.
 */
async function clearAllOutput(e) {
    const allOutputs = Array.from(document.getElementsByClassName('output-display'));
    for (let i = 0; i < allOutputs.length; i++) {
        allOutputs[i].value = "";
        allOutputs[i].classList.remove('success', 'error', 'skip');
    }
}

/**
 * This function saves the current guid to local storage (post confirmation if already exists)
 * This function is triggered by the 'Save Guid History' button.
 *
 * @param {Event} e - The click event object.
 */
async function saveCurrentGuid(e) {
    let currentKey = localStorage.getItem('currentGuid');
    if (currentKey) {
        let override = confirm(`key already exists with value ${currentKey}. Do you want to override?`);
        if (override) {
            localStorage.setItem('currentGuid', getSessionGuid());
            showToast('GUID saved successfully!', 'success');
        } else {
            console.warn('Saving GUID cancelled by user.');
            showToast('Saving GUID cancelled.', 'info');
        }
    } else {
        localStorage.setItem('currentGuid', getSessionGuid());
        showToast('GUID saved successfully!', 'success');
    }
}

/**
 * This function toggles between DEFAULT (gemini), ALL (all models), and none (no model) selection
 */
async function toggleCurrentModelSelection(e) {
    let localState = currentModelState;
    switch (localState) {
        case SELECTED_MODELS.DEFAULT:
            currentModelState = SELECTED_MODELS.ALL;
            modelsConfig.forEach(v => {
                let enabledId = document.getElementById(v.enableId);
                let histId = document.getElementById(v.trackHistoryId);
                enabledId.checked = true;
                histId.disabled = false;
                histId.checked = true;
            });
            break;
        case SELECTED_MODELS.ALL:
            currentModelState = SELECTED_MODELS.NONE;
            modelsConfig.forEach(v => {
                let enabledId = document.getElementById(v.enableId);
                let histId = document.getElementById(v.trackHistoryId);
                enabledId.checked = false;
                histId.checked = false;
                histId.disabled = true;
            });
            break;
        case SELECTED_MODELS.NONE:
            currentModelState = SELECTED_MODELS.DEFAULT;
            modelsConfig.filter(v => v.id == 'gemini').forEach(v => {
                let enabledId = document.getElementById(v.enableId);
                let histId = document.getElementById(v.trackHistoryId);
                enabledId.checked = true;
                histId.disabled = false;
                histId.checked = true;
            });
            modelsConfig.filter(v => v.id != 'gemini').forEach(v => {
                let enabledId = document.getElementById(v.enableId);
                let histId = document.getElementById(v.trackHistoryId);
                enabledId.checked = false;
                histId.disabled = true;
                histId.checked = false;
            });
            break;
    }
}

/**
 * Handles the request to remove the last message from a specific model's conversation.
 *
 * @param {Event} e - The click event object.
 * @param {string} modelId - The ID of the model whose last message should be removed (e.g., 'gemini', 'deepseek').
 */
async function handleRemoveLastMessage(e, modelId) {
    if (!modelId) {
        console.error("Model ID is required to remove last message.");
        showToast("Error: Could not identify model.", "error");
        return;
    }
    const countToRemove = e.target.parentElement.querySelector('.clearLastValue').value;
    let countToRemoveNum = Number(countToRemove);
    if (isNaN(countToRemoveNum) || countToRemoveNum < 1 || countToRemoveNum > 99) {
        console.error("Invalid number for removing last messages.");
        showToast("Error: Invalid count to remove.", "error");
        return;
    }
    const guid = getSessionGuid();

    try {
        const response = await fetch('/api/removeLastMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modelId: modelId, guid: guid, clearCount: countToRemoveNum })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Client Error: Server error removing last message for ${modelId}: ${response.status} - ${errorText}`);
            showToast(`Error removing last message: ${response.status}`, "error");
            return;
        }

        const data = await response.json();

        if (data.message === "Last message removed successfully" || data.message.includes("No history found")) { // Allow for "no history" message
            showToast(`Last ${countToRemoveNum} messages for ${modelId.toUpperCase()} removed.`, "success");
            // --- Client-side UI Update ---
            const modelElement = modelElements[modelId];
            if (modelElement && modelElement.outputDisplay) {
                // Clear output display, assuming backend has removed the last few entries
                // A better approach would be to get the *updated* history from the server.
                // For now, we clear and then re-append remaining `chatData` if any.
                modelElement.outputDisplay.value = "[Last message(s) removed by user.]\n";
                modelElement.outputDisplay.classList.remove('success', 'error', 'skip');

                // (b) Update client-side history and re-render
                if (modelElement.chatData.length > 0) {
                    modelElement.chatData.splice(-countToRemoveNum * 2); // Remove both user prompt and model response pairs
                    // We remove `countToRemoveNum * 2` assuming `countToRemoveNum` is for "pairs"
                    // If it's for individual messages, it would be just `countToRemoveNum`.
                    // We will need to clarify this with backend. For now, assuming pairs (user + model messages)
                }
                renderConversationHistory(modelId); // Re-render the updated history

                // Also clear the quest textarea if it's the last few entries
                // This is less precise without specific backend data.
                if (questTextArea) {
                    const lines = questTextArea.value.split('\n').filter(line => line.trim() !== '');
                    if (lines.length >= countToRemoveNum) {
                        questTextArea.value = lines.slice(0, lines.length - countToRemoveNum).join('\n') + '\n';
                    } else {
                        questTextArea.value = '';
                    }
                }
            }
        } else {
            console.error(`Server response indicates failure for removeLastMessage:`, data);
            showToast(`Failed to remove last message: ${data.error || "Unknown error"}`, "error");
        }

    } catch (error) {
        console.error('Network error during removeLastMessage request:', error);
        showToast('Network error: Could not remove last message.', "error");
    }
}

/**
 * Handles the shift to move history
 *
 * @param {Event} e - The click event object.
 */
async function handleShiftClick(e) {
    const guid = getSessionGuid(); // Ensure guid is defined
    try {
        const response = await fetch('/api/moveToLast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guid })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Client Error: Failed to clear history. Server responded with ${response.status}: ${errorText}`);
            showToast('Failed to shift history. See console for details.', 'error');
            return;
        }

        const data = await response.json();
        console.log('History shift API success:', data);
        showToast('History shifted!', 'success');

        // No direct UI update specified for 'shift', but if backend returns updated history,
        // we'd update `model.chatData` and call `renderConversationHistory` here.
        // For now, only a toast is shown.

    } catch (error) {
        console.error('Error shifting chat history:', error);
        showToast('Error shifting history: ' + error.message, 'error');
    } finally {
        // Reset the control value if needed
        clearHistoryValueInput.value = DEFAULT_MAX_HISTORY_CLEAR;
    }
}

/**
 * Handle the toggle show button 
 * @param {Event} e - The click evnet object
 */
async function handleSystemPromptTick(e) {
    const systemPromptContainer = document.getElementById('systemPromptContainer');
    if (toggleCheckbox && systemPromptContainer) {
        if (toggleCheckbox.checked) {
            // If the box is checked, show the container
            systemPromptContainer.classList.add('visible');
        } else {
            // If it's unchecked, hide the container
            systemPromptContainer.classList.remove('visible');
        }
    }
}

// --- Initialization ---

/**
 * Initializes the application by setting up DOM elements, caches, and event listeners.
 */
function initializeApp() {
    // --- Cache DOM Elements ---
    inputArea = document.getElementById('inputBox'); // Corrected from class to ID
    submitBtn = document.getElementById('submitBtn');
    loadingIndicator = document.getElementById('loadingIndicator');
    shiftBtn = document.getElementById('shift');
    clearHistoryBtn = document.getElementById('clearHistory');
    temperatureInput = document.getElementById('temperatureInput');
    clearAllOutputBtn = document.getElementById('clearAllOutput');
    saveGuidBtn = document.getElementById('saveGuid');
    toggleSelectionBtn = document.getElementById('toggleSelection');
    toggleCheckbox = document.getElementById('toggleSystemPrompt');
    questTextArea = document.getElementById('quest');
    clearHistoryValueInput = document.getElementById('clearHistoryValue');
    toastMessageElement = document.getElementById('toastMessage');

    // Initialize GUID
    getSessionGuid(); // Ensures GUID is set on load

    // --- Initialize Model Elements and Attach Listeners ---
    modelsConfig.forEach(modelConfig => {
        const column = document.querySelector(`.output-column[data-model-id="${modelConfig.id}"]`);
        if (column) {
            modelElements[modelConfig.id] = {
                column: column,
                outputDisplay: document.getElementById(modelConfig.htmlColumnId),
                trackHistoryCheckbox: document.getElementById(modelConfig.trackHistoryId),
                enableCheckbox: document.getElementById(modelConfig.enableId),
                clearButton: column.querySelector('.clearButton'),
                retryButton: column.querySelector('.retryButton'),
                removeLastCount: column.querySelector('.clearLastValue'),
                removeLastButton: column.querySelector('.removeLastButton'),
                cutOffReasonLabel: column.querySelector(`#${modelConfig.id}CutOffReason`), // These IDs might need to be dynamic for full support
                cutOffReasonValueSpan: column.querySelector(`#${modelConfig.id}CutOffReasonValue`), // These IDs might need to be dynamic for full support
                saveDataButton: column.querySelector('.saveData'),
                collapsibleButton: column.querySelector('.collapsible'),
                ApiResponsePanel: column.querySelector('.api-response'),
                chatData: [], // Initialize empty structured chat history for each model
                historyListElement: column.querySelector('.history-list') // Get reference to the history list div
            };

            const modelEl = modelElements[modelConfig.id];

            // Synchronize 'Chat' checkbox with 'Enabled' checkbox state
            if (modelEl.enableCheckbox && modelEl.trackHistoryCheckbox) {
                const updateChatCheckboxState = () => {
                    const isEnabled = modelEl.enableCheckbox.checked;
                    modelEl.trackHistoryCheckbox.disabled = !isEnabled;
                    if (!isEnabled) {
                        modelEl.trackHistoryCheckbox.checked = false; // Uncheck if disabled
                        // If you wanted it to be checked AND enabled:
                        // else { modelEl.trackHistoryCheckbox.checked = true; }
                        // For Gemini, it's always checked and disabled initially
                    }
                };

                modelEl.enableCheckbox.addEventListener('change', updateChatCheckboxState);
                updateChatCheckboxState(); // Initialize state on page load
            }

            // Attach Clear button listener
            if (modelEl.clearButton) {
                modelEl.clearButton.addEventListener('click', () => {
                    if (modelEl.outputDisplay) {
                        modelEl.outputDisplay.value = '';
                        modelEl.outputDisplay.classList.remove('success', 'error', 'skip');
                    }
                    // modelEl.chatData = []; // Clear client-side history for this model
                    renderConversationHistory(modelConfig.id); // Re-render empty history for this model
                });
            } else {
                console.warn(`Clear button not found for model: ${modelConfig.id}`);
            }

            // Attach Retry button listener
            if (modelEl.retryButton) {
                modelEl.retryButton.addEventListener('click', (e) => {
                    if (!lastQuery) {
                        alert('Nothing in query to retry!');
                        return false;
                    }
                    // Construct retry flags dynamically for the specific model being retried
                    const retryFlags = modelsConfig.map(m => m.id === modelConfig.id);
                    handleSubmitClick(e, ...retryFlags);
                });
            } else {
                console.warn(`Retry button not found for model: ${modelConfig.id}`);
            }

            // Attach Remove Last button listener
            if (modelEl.removeLastButton) {
                modelEl.removeLastButton.addEventListener('click', (e) => {
                    handleRemoveLastMessage(e, modelConfig.id);
                });
            } else {
                console.warn(`Remove Last button not found for model: ${modelConfig.id}`);
            }

            // Attach the collapsible handler
            if (modelEl.collapsibleButton) {
                modelEl.collapsibleButton.addEventListener('click', (e) => {
                    const currentTarget = e.target;
                    currentTarget.classList.toggle("active");
                    var content = currentTarget.nextElementSibling;
                    if (content.style.maxHeight) {
                        content.style.maxHeight = null;
                    } else {
                        content.style.maxHeight = content.scrollHeight + "px";
                    }
                });
            } else {
                console.warn(`not found the response collapse buttong for model ${modelConfig.id}`)
            }

            // Attach the saveData button
            if (modelEl.saveDataButton) {
                modelEl.saveDataButton.addEventListener('click', (e) => {
                    if (modelEl.chatData && modelEl.chatData.length) {
                        // Export the structured chatData (user prompts + model responses)
                        let exportContent = modelEl.chatData.map(msg => `${msg.role.toUpperCase()}: ${msg.fullContent}`).join('\n');
                        let blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
                        let filename = `${modelConfig.id}_chat_history_${getSessionGuid().substring(0, 8)}.txt`;

                        // Create a temporary link and trigger download
                        let a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(a.href);

                        showToast(`Exported chat history for ${modelConfig.name}.`, 'success');
                    } else {
                        showToast(`No chat data to export for ${modelConfig.name}.`, 'warning');
                    }
                });
            } else {
                console.warn(`not found the save data button for model ${modelConfig.id}`)
            }

            // Initial render of history (will be empty on load)
            renderConversationHistory(modelConfig.id);

        } else {
            console.warn(`Could not find HTML column for model: ${modelConfig.id}`);
        }
    });

    // --- Attach Global Event Listeners ---
    if (submitBtn) {
        submitBtn.addEventListener('click', handleSubmitClick);
    } else {
        console.warn('Submit button (#submitBtn) not found.');
    }

    if (shiftBtn) {
        shiftBtn.addEventListener('click', handleShiftClick)
    } else {
        console.warn('shift button button (#shift) not found.');
    }

    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearChatHistory);
    } else {
        console.warn('Clear all output  (#clearHistoryBtn) not found.');
    }

    if (clearAllOutputBtn) {
        clearAllOutputBtn.addEventListener('click', clearAllOutput);
    } else {
        console.warn('Clear history button (#clearHistory) not found.');
    }

    if (saveGuidBtn) {
        saveGuidBtn.addEventListener('click', saveCurrentGuid)
    }
    else {
        console.warn('save guid buttong (#saveGuid) not found');
    }

    if (toggleSelectionBtn) {
        toggleSelectionBtn.addEventListener('click', toggleCurrentModelSelection);
    }
    else {
        console.warn('toggle model selection button not found.')
    }

    if (toggleCheckbox) {
        toggleCheckbox.addEventListener('click', handleSystemPromptTick);
    } else {
        console.warn('toggole system id not found')
    }

    // Set default for clear history value input
    if (clearHistoryValueInput) {
        clearHistoryValueInput.value = DEFAULT_MAX_HISTORY_CLEAR;
    }

    // Focus the input area on load
    if (inputArea) {
        inputArea.focus();
    }
}

// --- Document Ready ---
document.addEventListener('DOMContentLoaded', initializeApp);

window.addEventListener('beforeunload', function (event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    let exit = confirm("are you sure you want to exit?");
    if (!exit) {
        return false;
    }
});