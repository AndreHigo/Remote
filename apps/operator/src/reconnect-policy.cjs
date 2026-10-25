const MAX_RECONNECT_ATTEMPTS = 12;

function getReconnectDelay(attempt) {
  if (!Number.isInteger(attempt) || attempt < 0) throw new Error("Tentativa de reconexao invalida.");
  return Math.min(15_000, 500 * 2 ** attempt);
}

module.exports = { MAX_RECONNECT_ATTEMPTS, getReconnectDelay };
