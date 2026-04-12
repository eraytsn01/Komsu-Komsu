import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist/public");
  const publicPath = path.resolve(process.cwd(), "server/public");

  // Önce APK ve diğer dosyalar için server/public'u servis et
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
  }

  // Sonra client build dosyalarını servis et
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));

    // fall through to index.html if the file doesn't exist
    app.use("/{*path}", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  } else {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }
}
