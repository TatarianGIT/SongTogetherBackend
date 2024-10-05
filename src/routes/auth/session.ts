import { Router } from "express";
import { verifyRequestOrigin } from "lucia";
import { lucia } from "../../config/auth.config.js";
import dotenv from "dotenv";
import { envVars } from "../../envVars.js";

dotenv.config();

const SessionRoute = Router();

SessionRoute.use((req, res, next) => {
  if (req.method === "GET") {
    return next();
  }
  const originHeader = req.headers.origin ?? null;
  const hostHeader = req.headers.host ?? null;

  if (
    !originHeader ||
    !hostHeader ||
    !verifyRequestOrigin(originHeader, [
      hostHeader,
      envVars!.CLIENT_URL as string,
    ])
  ) {
    return res.status(403).end();
  }
  return next();
});

SessionRoute.use(async (req, res, next) => {
  const sessionId = lucia.readSessionCookie(req.headers.cookie ?? "");
  if (!sessionId) {
    res.locals.user = null;
    res.locals.session = null;
    return next();
  }

  const { session, user } = await lucia.validateSession(sessionId);
  if (session && session.fresh) {
    res.appendHeader(
      "Set-Cookie",
      lucia.createSessionCookie(session.id).serialize()
    );
  }
  if (!session) {
    res.appendHeader(
      "Set-Cookie",
      lucia.createBlankSessionCookie().serialize()
    );
  }
  res.locals.session = session;
  res.locals.user = user;
  return next();
});

export default SessionRoute;
