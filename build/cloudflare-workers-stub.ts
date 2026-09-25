// Local Windows ARM64 preview only. Hosted builds resolve the real Cloudflare runtime.
//
// Cloudflare D1 has no local runtime for win32/arm64 (see vite.config.ts), so on this
// platform we swap in a tiny SQLite database (via sql.js, pure WASM, no native build step)
// that speaks the same `prepare().bind().run()/.all()/.first()` shape as a real D1Database.
// Both the Drizzle client (db/index.ts) and the raw D1 calls in the suppliers route work
// against it unmodified. Data persists to `.local-data/dev.sqlite` between restarts.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { Database, SqlJsStatic, Statement } from "sql.js";

// Loaded via Node's own CJS `require`, bypassing Vite's SSR module transform —
// sql.js's UMD bundle does not survive that transform (reassigns a `const`).
const require = createRequire(import.meta.url);
const initSqlJs = require("sql.js") as (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;
const DB_FILE = path.join(process.cwd(), ".local-data", "dev.sqlite");
const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

function toBindValue(value: unknown): string | number | Uint8Array | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" || typeof value === "number" || value instanceof Uint8Array) return value;
  return String(value);
}

function applyMigrationsIfNew(sqlite: Database, isNew: boolean) {
  if (!isNew || !fs.existsSync(MIGRATIONS_DIR)) return;
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql")).sort();
  for (const file of files) {
    const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    for (const statement of content.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) sqlite.run(trimmed);
    }
  }
}

async function createLocalSqlite() {
  const SQL = await initSqlJs({ locateFile: (file: string) => path.join(path.dirname(require.resolve("sql.js")), file) });
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const isNew = !fs.existsSync(DB_FILE);
  const sqlite: Database = isNew ? new SQL.Database() : new SQL.Database(fs.readFileSync(DB_FILE));
  applyMigrationsIfNew(sqlite, isNew);
  if (isNew) persist(sqlite);
  return sqlite;
}

function persist(sqlite: Database) {
  fs.writeFileSync(DB_FILE, Buffer.from(sqlite.export()));
}

function lastInsertRowId(sqlite: Database) {
  const result = sqlite.exec("SELECT last_insert_rowid() AS id");
  return Number(result[0]?.values?.[0]?.[0] ?? 0);
}

function bindStatement(stmt: Statement, params: unknown[]) {
  if (params.length) stmt.bind(params.map(toBindValue));
}

// Mirrors the subset of Cloudflare's D1PreparedStatement that this app actually uses
// (see drizzle-orm/d1/session.js for the exact `.bind().run()/.all()/.raw()` contract,
// and app/api/suppliers/route.ts for the direct `.bind().run()/.all()/.first()` usage).
function makeStatement(sqlite: Database, sql: string, params: unknown[] = []) {
  return {
    bind: (...newParams: unknown[]) => makeStatement(sqlite, sql, newParams),
    async run() {
      const stmt = sqlite.prepare(sql);
      try {
        bindStatement(stmt, params);
        stmt.step();
      } finally {
        stmt.free();
      }
      const meta = { last_row_id: lastInsertRowId(sqlite), changes: sqlite.getRowsModified() };
      persist(sqlite);
      return { success: true, results: [], meta };
    },
    async all<T = Record<string, unknown>>() {
      const stmt = sqlite.prepare(sql);
      const results: T[] = [];
      try {
        bindStatement(stmt, params);
        while (stmt.step()) results.push(stmt.getAsObject() as T);
      } finally {
        stmt.free();
      }
      persist(sqlite);
      return { success: true, results };
    },
    async raw<T = unknown[]>() {
      const stmt = sqlite.prepare(sql);
      const rows: T[] = [];
      try {
        bindStatement(stmt, params);
        while (stmt.step()) rows.push(stmt.get() as T);
      } finally {
        stmt.free();
      }
      persist(sqlite);
      return rows;
    },
    async first<T = Record<string, unknown>>() {
      const stmt = sqlite.prepare(sql);
      try {
        bindStatement(stmt, params);
        const hasRow = stmt.step();
        return hasRow ? (stmt.getAsObject() as T) : null;
      } finally {
        stmt.free();
      }
    },
  };
}

type LocalStatement = ReturnType<typeof makeStatement>;

function makeD1Shim(sqlite: Database) {
  return {
    prepare: (sql: string) => makeStatement(sqlite, sql),
    batch: async (statements: LocalStatement[]) => {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    },
  };
}

// Kho R2 giả lập cục bộ: lưu file xuống .local-data/r2/ (chỉ dùng khi dev trên máy
// không có runtime Cloudflare thật). Mô phỏng đủ put/get/delete mà route documents dùng.
const R2_DIR = path.join(process.cwd(), ".local-data", "r2");
function r2PathFor(key: string) {
  return path.join(R2_DIR, key.replace(/[^a-zA-Z0-9._-]/g, "_"));
}
function makeR2Shim() {
  fs.mkdirSync(R2_DIR, { recursive: true });
  return {
    async put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string } }) {
      const filePath = r2PathFor(key);
      const buffer = Buffer.from(value as ArrayBuffer);
      fs.writeFileSync(filePath, buffer);
      fs.writeFileSync(filePath + ".meta", JSON.stringify({ contentType: options?.httpMetadata?.contentType ?? "", size: buffer.length }));
      return { key, size: buffer.length };
    },
    async get(key: string) {
      const filePath = r2PathFor(key);
      if (!fs.existsSync(filePath)) return null;
      const buffer = fs.readFileSync(filePath);
      let meta: { contentType?: string } = {};
      try { meta = JSON.parse(fs.readFileSync(filePath + ".meta", "utf-8")); } catch { /* không có meta */ }
      return {
        body: new Uint8Array(buffer),
        httpMetadata: { contentType: meta.contentType ?? "" },
        size: buffer.length,
        async arrayBuffer() { return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength); },
      };
    },
    async delete(key: string) {
      const filePath = r2PathFor(key);
      try { fs.unlinkSync(filePath); } catch { /* đã xoá */ }
      try { fs.unlinkSync(filePath + ".meta"); } catch { /* đã xoá */ }
    },
  };
}

const sqlite = await createLocalSqlite();

export const env = { DB: makeD1Shim(sqlite), FILES: makeR2Shim() };
