import { Router } from "express";
import passport from "passport";
import dotenv from "dotenv";

export const authRoute = Router();

dotenv.config();

authRoute.get("/me", (req, res) => {
  if (req.user) {
    res.status(200).json({
      user: req.user,
    });
  } else {
    res.status(400).json({});
  }
});

authRoute.get("/cookies", (req, res) => {
  if (req.user) {
    res.status(200).json({
      cookies: req.cookies,
    });
  } else {
    res.status(400).json({});
  }
});

authRoute.get("/login/failed", (req, res) => {
  res.status(401).json({
    success: false,
    message: "failure",
  });
});

authRoute.get("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      console.log("LOGOUT ERROR ");
      return next(err);
    }
    console.log("LOGOUT SUCCESS ");
    res.redirect(process.env.CLIENT_URL);
  });
});

authRoute.get(
  "/discord",
  passport.authenticate("discord", { scope: ["identify"] })
);

authRoute.get(
  "/discord/callback",
  passport.authenticate("discord", {
    successRedirect: process.env.CLIENT_URL,
    failureRedirect: "/login/failed",
  })
);
