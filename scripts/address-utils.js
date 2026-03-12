function normalizeAddress(input, fieldName = 'address') {
  if (!input || typeof input !== 'string') {
    throw new Error(`${fieldName} is missing or not a string`);
  }

  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  if (!/^0x[0-9a-f]{40}$/.test(lower)) {
    throw new Error(`${fieldName} is invalid: ${trimmed} (expected 0x + 40 hex chars)`);
  }

  return lower;
}

module.exports = { normalizeAddress };
