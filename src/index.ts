import express, { Application, NextFunction } from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRoute } from "./routes/auth.js";
import passport from "passport";
import cookieSession from "cookie-session";
import "./config/passport.config.js";
import { Request, Response } from "express";
import { User } from "./types/index.js";
import { isAuthenticated } from "./middleware/isAuthenticated.js";
import morgan from "morgan";

//For env File
dotenv.config();

const app: Application = express();
const port = process.env.PORT || 8000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));
app.use(
  cookieSession({
    name: "session",
    keys: [process.env.COOKIE_KEY],
    maxAge: 3 * 24 * 60 * 60 * 1000, // 3days
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: "GET,POST,PUT,DELETE",
    credentials: true,
  })
);

app.use(function (request, response, next) {
  if (request.session && !request.session.regenerate) {
    request.session.regenerate = (cb) => {
      cb();
    };
  }
  if (request.session && !request.session.save) {
    request.session.save = (cb) => {
      cb();
    };
  }
  next();
});

app.use("/auth", authRoute);
app.get("/protected", isAuthenticated, (req: Request & User, res: Response) => {
  res.status(200).json({ message: "secret data" });
});

app.listen(port, () => {
  console.log(
    `============================\nServer is running at http://localhost:${port}`
  );
});
