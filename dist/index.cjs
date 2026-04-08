const url = require('url');
const originalFileURLToPath = url.fileURLToPath;
url.fileURLToPath = (value, ...args) => {
  if (value === undefined || value === null) return process.cwd();
  return originalFileURLToPath(value, ...args);
};
require('./server.cjs');
