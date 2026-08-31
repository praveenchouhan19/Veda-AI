/**
 * Run an async mapper over items with a bounded number of parallel workers.
 * Keeps Gemini page requests under the API's rate limit while still
 * overlapping network latency. Results preserve input order.
 */
const mapWithConcurrency = async (items, limit, mapper) => {
  const results = new Array(items.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  };

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker);
  await Promise.all(workers);
  return results;
};

module.exports = { mapWithConcurrency };
