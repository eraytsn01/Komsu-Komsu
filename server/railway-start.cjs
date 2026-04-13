
// Firebase Database URL ortam değişkenini elle set et

process.env.FIREBASE_DATABASE_URL = "https://komsukomsu-1282f-default-rtdb.europe-west1.firebasedatabase.app";
process.env.DATABASE_URL = process.env.FIREBASE_DATABASE_URL;
console.log("FIREBASE_DATABASE_URL:", process.env.FIREBASE_DATABASE_URL);
console.log("DATABASE_URL:", process.env.DATABASE_URL);

const url = require("url");

const originalFileURLToPath = url.fileURLToPath;
url.fileURLToPath = (value, ...args) => {
  if (value === undefined || value === null) {
    return process.cwd();
  }
  return originalFileURLToPath(value, ...args);
};

require("../dist/index.cjs");
