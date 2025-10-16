// Copy the entire dist folder to api folder for Vercel
const fs = require('fs');
const path = require('path');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(function(childItemName) {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

const distPath = path.join(__dirname, '../dist');
const apiDistPath = path.join(__dirname, '../api/dist');

if (fs.existsSync(distPath)) {
  // Remove old dist in api if exists
  if (fs.existsSync(apiDistPath)) {
    fs.rmSync(apiDistPath, { recursive: true, force: true });
  }
  copyRecursiveSync(distPath, apiDistPath);
  console.log('✓ Copied dist folder to api/dist');
} else {
  console.error('✗ dist folder not found');
  process.exit(1);
}
