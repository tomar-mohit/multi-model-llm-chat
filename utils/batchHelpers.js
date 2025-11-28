// utils/batchHelpers.js

/**
 * Formats a summary of non-zero status counts from a model's request counts.
 * @param {object} modelInfo - An object containing request counts (e.g., { canceled: 0, errored: 1, ... }).
 * @returns {string} A human-readable string summarizing non-zero counts.
 */
function getNonZeroStatus(modelInfo) {
  let totalresult = '';
  if (modelInfo.canceled) {
    totalresult += `Canceled : ${modelInfo.canceled} `;
  }
  if (modelInfo.errored) {
    totalresult += `Errored : ${modelInfo.errored} `;
  }
  if (modelInfo.expired) {
    totalresult += `Expired : ${modelInfo.expired} `;
  }
  if (modelInfo.processing) {
    totalresult += `Processing : ${modelInfo.processing} `;
  }
  if (modelInfo.succeeded) {
    totalresult += `Succeeded : ${modelInfo.succeeded} `;
  }
  return totalresult.trim();
}

module.exports = {
  getNonZeroStatus,
};