// utils/sse.js

/**
 * Helper function to send a Server-Sent Event.
 * @param {express.Response} res - The Express response object configured for SSE.
 * @param {string} event - The name of the SSE event (e.g., 'model_result').
 * @param {object} data - The data payload to be sent, typically a JSON object.
 */
const sendSseEvent = (res, event, data) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

module.exports = {
  sendSseEvent,
};