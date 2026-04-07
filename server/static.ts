import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export function serveStatic(app: Express) {
  let distPath: string;
  
  // Handle both ESM and CommonJS contexts
  try {
    // Try using __dirname if available (CommonJS)
    if (typeof __dirname !== "undefined") {
      distPath = path.resolve(__dirname, "public");
    } else {
      throw new Error();
    }
  } catch {
    // Fallback: use process.cwd() for CommonJS bundled version
    distPath = path.resolve(process.cwd(), "dist/public");
  }

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
