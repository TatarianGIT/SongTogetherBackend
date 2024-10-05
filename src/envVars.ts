import dotenv from "dotenv";

dotenv.config();

const DISCORD_CLIENT_ID =
  process.env.NODE_ENV === "production"
    ? process.env.DISCORD_CLIENT_ID_PROD
    : process.env.NODE_ENV === "development"
    ? process.env.DISCORD_CLIENT_ID_DEV
    : undefined;

export const envVars =
  process.env.NODE_ENV === "production"
    ? {
        PORT: process.env.PORT_PROD,
        CLIENT_URL: process.env.CLIENT_URL_PROD,
        YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY_PROD,
        DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID_PROD,
        DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET_PROD,
        COOKIE_KEY: process.env.COOKIE_KEY_PROD,
      }
    : process.env.NODE_ENV === "development"
    ? {
        PORT: process.env.PORT_DEV,
        CLIENT_URL: process.env.CLIENT_URL_DEV,
        YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY_DEV,
        DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID_DEV,
        DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET_DEV,
        COOKIE_KEY: process.env.COOKIE_KEY_DEV,
      }
    : undefined;
