import sqlite from "better-sqlite3";

export const db = sqlite("database.db");

db.exec(`CREATE TABLE IF NOT EXISTS user (
    id TEXT NOT NULL PRIMARY KEY,
    discord_id TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    avatar TEXT,
    accent_color INTEGER,
    global_name TEXT,
    banner_color TEXT,
    email TEXT UNIQUE
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
    queue_status TEXT CHECK(queue_status IN ('prev', 'current', 'next')) NOT NULL,
    length_seconds TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id)
)`);
