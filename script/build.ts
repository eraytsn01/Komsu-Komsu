import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, writeFile, mkdir } from "fs/promises";
import { config as loadEnv } from "dotenv";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

function loadFirebaseEnv() {
  loadEnv({ path: ".env.production", override: false });
  loadEnv({ path: "client/.env.production", override: false });

  return {
    VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID: process.env.VITE_FIREBASE_APP_ID,
  };
}

async function generateFirebaseMessagingServiceWorker() {
  const env = loadFirebaseEnv();
  const allValuesPresent = Object.values(env).every(Boolean);
  const outputPath = "client/public/firebase-messaging-sw.js";

  await mkdir("client/public", { recursive: true });

  if (!allValuesPresent) {
    await writeFile(
      outputPath,
      "self.addEventListener('install', () => self.skipWaiting());\nself.addEventListener('activate', () => self.clients.claim());\n",
      "utf-8",
    );
    return;
  }

  const template = await readFile("client/firebase/firebase-messaging-sw.template.js", "utf-8");
  const rendered = Object.entries(env).reduce((content, [key, value]) => {
    return content.replaceAll(`__${key}__`, String(value ?? ""));
  }, template);

  await writeFile(outputPath, rendered, "utf-8");
}

async function buildAll() {
  await rm("dist", { recursive: true, force: true });
  await generateFirebaseMessagingServiceWorker();

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/server.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // Keep legacy entrypoint for platforms still running `node dist/index.cjs`
  // and patch `fileURLToPath(undefined)` crash seen in some Railway runtimes.
  await writeFile(
    "dist/index.cjs",
    [
      "const url = require('url');",
      "const originalFileURLToPath = url.fileURLToPath;",
      "url.fileURLToPath = (value, ...args) => {",
      "  if (value === undefined || value === null) return process.cwd();",
      "  return originalFileURLToPath(value, ...args);",
      "};",
      "require('./server.cjs');",
      "",
    ].join("\n"),
    "utf-8",
  );
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
