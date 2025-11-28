// config/server.js (inside the config directory: D:\VS\mch7\config\server.js)

// --- FIX: Add .js extension ---
const { SERVER_PORT, JSON_BODY_LIMIT } = require('../common.js'); // <-- This is where you need .js

const PORT = SERVER_PORT || 3003; // Default to 3003 if not set in common.js
const JSON_LIMIT = JSON_BODY_LIMIT || '100mb'; // Default JSON body limit

module.exports = {
  PORT,
  JSON_LIMIT,
};