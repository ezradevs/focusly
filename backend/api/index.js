// Vercel serverless function entry point
const app = require('./dist/server.js').default || require('./dist/server.js');

function normalizeForwardedPath(rawValue) {
  if (!rawValue) {
    return null;
  }

  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  if (!value) {
    return null;
  }

  try {
    // Some Vercel headers include the full URL. Parse to extract path + query.
    const parsed = new URL(value, 'https://placeholder.local');
    if (parsed.pathname) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // Ignore parse errors – fallback to manual normalization below.
  }

  if (typeof value === 'string') {
    return value.startsWith('/') ? value : `/${value}`;
  }

  return null;
}

module.exports = (req, res) => {
  const forwardedPath =
    normalizeForwardedPath(req.headers['x-vercel-forwarded-url']) ||
    normalizeForwardedPath(req.headers['x-vercel-forwarded-path']) ||
    normalizeForwardedPath(req.headers['x-original-path']) ||
    normalizeForwardedPath(req.headers['x-forwarded-uri']);

  if (forwardedPath && forwardedPath !== req.url) {
    req.url = forwardedPath;
  }

  return app(req, res);
};
