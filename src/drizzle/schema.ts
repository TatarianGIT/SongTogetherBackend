import { sql } from "drizzle-orm";
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const VideoList = sqliteTable("video", {
  id: integer("id").primaryKey().notNull(),
  type: text("type", { enum: ["prev", "next", "current"] }).notNull(),
  videoUrl: text("videoUrl").notNull(),
  videoId: text("videoId").notNull(),
  title: text("title").notNull(),
  lengthSeconds: text("lengthSeconds").notNull(),
  thumbnailUrl: text("thumbnailUrl").notNull(),
  addedBy: text("addedBy").notNull(),
  timestamp: text("timestamp")
    .default(sql`(current_timestamp)`)
    .notNull(),
});
