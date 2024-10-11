import { Lucia } from "lucia";
import { Discord } from "arctic";
import dotenv from "dotenv";
import { db } from "../sqlite3/db.js";
import { BetterSqlite3Adapter } from "@lucia-auth/adapter-sqlite";

import type { DatabaseUser } from "../types/index.js";

dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

const adapter = new BetterSqlite3Adapter(db, {
  user: "user",
  session: "session",
});

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV === "production",
    },
  },
  getUserAttributes: (attributes) => {
    return {
      discordId: attributes.discord_id,
      username: attributes.username,
    };
  },
});

export const discord = new Discord(
  process.env.DISCORD_CLIENT_ID!,
  process.env.DISCORD_CLIENT_SECRET!,
  `https://${process.env.HOST_URL}:${process.env.PORT}/auth/discord/callback`
);

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: Omit<DatabaseUser, "id">;
  }
}
