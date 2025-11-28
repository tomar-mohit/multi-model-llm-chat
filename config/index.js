// config/index.js
const secrets = require('./secrets');
const constants = require('./constants');
const api = require('./api');
const serverConfig = require('./serverConfig'); // <--- RENAMED to avoid confusion with the main server.js file

module.exports = {
  ...secrets,
  ...constants,
  ...api,
  ...serverConfig, // <--- Spreading the exports from config/server.js (the config values)
};