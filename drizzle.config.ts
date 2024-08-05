import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dbCredentials: {
    url: "sqlite.db",
  },
  schema: "./src/drizzle/schema.ts",
  dialect: "sqlite",
  out: "./src/drizzle/migrations",
  migrations: {
    prefix: "index",
  },
  verbose: true,
  strict: true,
});
