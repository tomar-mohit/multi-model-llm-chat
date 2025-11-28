// utils/siteHelper.js

/**
 * Formats a summary of non-zero status counts from a model's request counts.
 * @param {string} modelId - A model Id
 * @param {Number} temperature - the temperature passed to model.
 * @returns { Number } - a number as per translated into model's input
 */
function normalizeTemperature(modelId, temperature) {
  let normizedTemp = 0;
  if (modelId == 'gemini') {
    normizedTemp = temperature;
  }
  return normizedTemp.trim();
}

module.exports = {
  normalizeTemperature,
};