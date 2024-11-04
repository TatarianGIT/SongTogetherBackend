import sqlite from "better-sqlite3";
import { mainDirectory } from "../envVars.js";

export const db = sqlite(`${mainDirectory}/database.db`);

db.exec(`CREATE TABLE IF NOT EXISTS user (
    id TEXT NOT NULL PRIMARY KEY,
    discord_id TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    avatar TEXT,
    accent_color INTEGER,
    global_name TEXT,
    banner_color TEXT,
    email TEXT UNIQUE,
    role TEXT DEFAULT null CHECK (role IN (null, 'basic', 'moderator', 'admin'))
)`);

db.exec(`CREATE TABLE IF NOT EXISTS session (
    id TEXT NOT NULL PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS video (
    id TEXT NOT NULL PRIMARY KEY,
    video_url TEXT NOT NULL,
    video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    queue_status TEXT CHECK(queue_status IN ('prev', 'current', 'next')) NOT NULL,
    length_seconds TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id)
    )`);

db.exec(`CREATE TABLE IF NOT EXISTS favourite (
    id TEXT NOT NULL PRIMARY KEY,
    video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id)
)`);

db.exec(`
    CREATE TABLE IF NOT EXISTS songLimit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      limit_value INTEGER NOT NULL
    );
  `);

db.exec(`
    CREATE TABLE IF NOT EXISTS bannedWord (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL
    );
  `);
