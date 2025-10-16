// Vercel serverless function entry point
let app;

try {
  // Try to load the compiled app
  const serverModule = require('../dist/server.js');
  app = serverModule.default || serverModule;
} catch (error) {
  console.error('Failed to load server:', error);
  throw error;
}

// Export the app for Vercel
module.exports = app;
