import passport from "passport";
import { Strategy as DiscordStrategy } from "passport-discord";

import dotenv from "dotenv";
dotenv.config();

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  //@ts-ignore
  done(null, user);
});

passport.use(
  "discord",
  new DiscordStrategy(
    {
      clientID: process.env.AUTH_DISCORD_ID!,
      clientSecret: process.env.AUTH_DISCORD_SECRET!,
      callbackURL: "/auth/discord/callback",
    },
    function (accessToken, refreshToken, profile, done) {
      done(null, profile);
    }
  )
);

export default passport;
