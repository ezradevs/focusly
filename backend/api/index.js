// Vercel serverless function entry point
const app = require('./dist/server.js').default || require('./dist/server.js');

module.exports = app;
