import "dotenv/config";
import cloudinary from "cloudinary";
import { readdirSync, existsSync } from "fs";
import { join, extname } from "path";
import pg from "pg";

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const pools = []; // no re-run script, manually updated below