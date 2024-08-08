import { OAuth2RequestError, generateState } from "arctic";
import express from "express";
import { parseCookies, serializeCookie } from "oslo/cookie";
import { generateId } from "lucia";
import { discord, lucia } from "../../config/auth.config.js";
import { db } from "../../drizzle/db.js";
import dotenv from "dotenv";

import type { DatabaseUser, DiscordUser } from "../../types/index.js";

dotenv.config();

export const AuthRoute = express.Router();

AuthRoute.get("/login/discord", async (_, res) => {
  const state = generateState();
  const url = await discord.createAuthorizationURL(state, {
    scopes: ["identify"],
  });

  res
    .appendHeader(
      "Set-Cookie",
      serializeCookie("discord_oauth_state", state, {
        path: "/",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 60 * 10,
        sameSite: "lax",
      })
    )
    .redirect(url.toString());
});

AuthRoute.get("/discord/callback", async (req, res) => {
  const code = req.query.code?.toString() ?? null;
  const state = req.query.state?.toString() ?? null;
  const storedState =
    parseCookies(req.headers.cookie ?? "").get("discord_oauth_state") ?? null;
  if (!code || !state || !storedState || state !== storedState) {
    console.log(code, state, storedState);
    res.status(400).end();
    return;
  }
  try {
    const tokens = await discord.validateAuthorizationCode(code);
    const discordUserResponse = await fetch(
      "https://discord.com/api/users/@me",
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      }
    );
    const discordUser: DiscordUser = await discordUserResponse.json();
    console.log(discordUser);
    const existingUser = db
      .prepare("SELECT * FROM user WHERE discord_id = ?")
      .get(discordUser.id) as DatabaseUser | undefined;

    if (existingUser) {
      const session = await lucia.createSession(existingUser.id, {});
      return res
        .appendHeader(
          "Set-Cookie",
          lucia.createSessionCookie(session.id).serialize()
        )
        .redirect(process.env.CLIENT_URL + "/dashboard");
    }

    const generatedUserId = generateId(15);

    db.prepare(
      "INSERT INTO user \
      (id, discord_id, username, avatar, accent_color, global_name, banner_color, email) \
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      generatedUserId,
      discordUser.id,
      discordUser.username,
      discordUser.avatar,
      discordUser.accent_color,
      discordUser.global_name,
      discordUser.banner_color,
      discordUser.email
    );

    const session = await lucia.createSession(generatedUserId, {});

    return res
      .appendHeader(
        "Set-Cookie",
        lucia.createSessionCookie(session.id).serialize()
      )
      .redirect(process.env.CLIENT_URL + "dashboard");
  } catch (e) {
    if (
      e instanceof OAuth2RequestError &&
      e.message === "bad_verification_code"
    ) {
      console.log(e);
      // invalid code
      res.status(400).end();
      return;
    }
    console.log(e);
    res.status(500).end();
    return;
  }
});

AuthRoute.post("/logout", async (req, res) => {
  if (!res.locals.session) {
    console.log("No session");
    return res.status(401).end();
  }
  await lucia.invalidateSession(res.locals.session.id);
  return res
    .setHeader("Set-Cookie", lucia.createBlankSessionCookie().serialize())
    .redirect(process.env.CLIENT_URL as string);
});
