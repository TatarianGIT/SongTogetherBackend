import { Router } from "express";
import passport from "passport";
import dotenv from "dotenv";

const AuthRoute = Router();

dotenv.config();

// Workaround of an error caused by PassportJS
AuthRoute.use(function (request, response, next) {
  if (request.session && !request.session.regenerate) {
    request.session.regenerate = (cb: any) => {
      cb();
    };
  }
  if (request.session && !request.session.save) {
    request.session.save = (cb: any) => {
      cb();
    };
  }
  next();
});

AuthRoute.get("/me", (req, res) => {
  if (req.user) {
    res.status(200).json({
      user: req.user,
    });
  } else {
    res.status(400).json({});
  }
});

AuthRoute.get("/cookies", (req, res) => {
  if (req.user) {
    res.status(200).json({
      cookies: req.cookies,
    });
  } else {
    res.status(400).json({});
  }
});

AuthRoute.get("/login/failed", (req, res) => {
  res.status(401).json({
    success: false,
    message: "failure",
  });
});

AuthRoute.get("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect(process.env.CLIENT_URL as string);
  });
});

AuthRoute.get(
  "/discord",
  passport.authenticate("discord", { scope: ["identify"] })
);

AuthRoute.get(
  "/discord/callback",
  passport.authenticate("discord", {
    successRedirect: process.env.CLIENT_URL,
    failureRedirect: "/login/failed",
  })
);

export default AuthRoute;
