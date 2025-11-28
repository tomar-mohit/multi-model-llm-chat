// server.js (main application file)

// --- Load Environment Variables (at the very top) ---
require('dotenv').config();

// --- Node Modules ---
const express = require("express");
const bodyParser = require("body-parser");
const cors = require('cors');
const path = require("path");

// --- Configuration ---
const config = require('./config');

// --- Route Imports ---
const chatRoutes = require('./routes/chatRoutes');
const batchRoutes = require('./routes/batchRoutes');

// --- Express Server Setup ---
const app = express();
const PORT = config.PORT;

// --- Middleware Setup ---
app.use(bodyParser.json({ limit: config.JSON_LIMIT })); // Limit JSON payload size.
app.use(express.static(path.join(__dirname, "public"))); // Serve static files from 'public' directory.
// For the 'bulk' route (static serving from parent directory, if needed)
app.use(express.static(path.join(__dirname, '..')));
app.use(express.urlencoded({ limit: config.JSON_LIMIT, extended: true }));

// Enable CORS (configure for production environments!)
app.use(cors()); // TODO: Restrict origins in production: https://expressjs.com/en/resources/middleware/cors.html

// --- API Routes ---
// Use the modularized routes
app.use('/', chatRoutes);
app.use('/', batchRoutes);


// --- Generic Error Handling Middleware (optional but recommended) ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});


// --- Server Startup ---
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`JSON body limit set to: ${config.JSON_LIMIT}`);
});