// config/secrets.js
require('dotenv').config(); // Load environment variables from .env file

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPEN_ROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY;

// Basic validation to ensure critical keys are set
const checkRequiredKeys = () => {
  const requiredKeys = {
    GOOGLE_API_KEY,
    DEEPSEEK_API_KEY,
    OPENAI_API_KEY,
    ANTHROPIC_API_KEY,
    OPEN_ROUTER_API_KEY,
  };

  for (const key in requiredKeys) {
    if (!requiredKeys[key]) {
      console.warn(`WARNING: Environment variable ${key} is not set. Related features may not function.`);
      // In a production app, you might want to throw an error and exit here:
      // throw new Error(`Missing critical environment variable: ${key}. Please set it in your .env file.`);
    }
  }
};

checkRequiredKeys();

module.exports = {
  GOOGLE_API_KEY,
  DEEPSEEK_API_KEY,
  OPENAI_API_KEY,
  ANTHROPIC_API_KEY,
  OPEN_ROUTER_API_KEY,
};