import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;

let __dirname: string;
if (typeof __dirname === "undefined" || typeof import.meta === "undefined") {
  // CommonJS fallback or when __dirname is not available
  __dirname = process.cwd();
} else {
  const __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
}

dotenv.config({ path: path.resolve(__dirname, ".env") });

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
