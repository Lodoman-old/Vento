import pg from "pg";
import { parse } from "pg-connection-string";

const conn = parse(process.env.DATABASE_URL);
const ssl = conn.ssl || process.env.DATABASE_URL?.includes("sslmode=require");

const pool = new pg.Pool({
  host: conn.host,
  port: conn.port,
  database: conn.database,
  user: conn.user,
  password: conn.password,
  ssl: ssl ? { rejectUnauthorized: false } : false,
  max: 20,
});

pool.on("connect", (client) => {
  client.query("SET timezone = 'America/Mexico_City'");
});

export async function connectDb() {
  const client = await pool.connect();
  console.log("[db] conectado a PostgreSQL (America/Mexico_City)");
  client.release();
}

export async function query(text, params) {
  return pool.query(text, params);
}

export function getPool() {
  return pool;
}
