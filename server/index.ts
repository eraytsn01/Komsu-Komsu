import "dotenv/config"; // .env dosyası import aşamasında okunur, Firebase çökmez.

// Firebase Database URL ortam değişkenini elle set et (ekstra garanti için)
process.env.FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL || "https://komsukomsu-1282f-default-rtdb.europe-west1.firebasedatabase.app";
console.log("FIREBASE_DATABASE_URL (index.ts):", process.env.FIREBASE_DATABASE_URL);

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import path from "path";
import { createServer } from "http";
import cors from "cors";

// allowedOrigins en üstte tanımlanmalı
const allowedOrigins = [
  'https://localhost',
  'http://localhost',
  'http://localhost:5173',
  'https://localhost:5173',
  'https://komsukomsu.online',
];



const app = express();
const httpServer = createServer(app);

// Loglama fonksiyonu
function log(message: string) {
  console.log(`[express] ${message}`);
}

// CORS ayarları EN BAŞTA ve sadece bir kez
app.use(
  cors({
    origin: function (origin, callback) {
      // Mobilde origin undefined olabilir, onu da kabul et
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-user-id'],
    exposedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 'public' klasöründeki her şeyi internete açar (heroku/railway uyumlu)

app.use('/public', express.static(path.join(process.cwd(), 'public')));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);


// API response loglama middleware'i
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson: any, ...args: any[]) {
    capturedJsonResponse = bodyJson;
    return originalResJson.call(res, bodyJson, ...args);
  } as typeof res.json; // TS derleyicisinin dönüş tipine kızmasını önler

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });
  next();
});

// DASK API Proxy (CORS hatasını önlemek için)
app.post('/api/dask', async (req, res) => {
  try {
    const { step, id } = req.body;
    const formData = new URLSearchParams();
    if (step) formData.append('step', step);
    if (id) formData.append('id', id);

    const daskResponse = await fetch('https://adreskodu.dask.gov.tr/site-element/control/load.ashx', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Referer': 'https://adreskodu.dask.gov.tr/',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: formData.toString()
    });

    const dataText = await daskResponse.text();
    try {
      const dataJson = JSON.parse(dataText);
      res.json(dataJson);
    } catch (e) {
      res.send(dataText);
    }
  } catch (error) {
    console.error('DASK Proxy Hatası:', error);
    res.status(500).json({ error: 'DASK servisi ile iletişim kurulamadı' });
  }
});

(async () => {
  // registerRoutes fonksiyonu Promise dönmez, senkrondur. 'await' kullanımı Type uyarısı verir.
  registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5050", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
