import express, { Application } from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import cookieSession from "cookie-session";
import "./config/passport.config";
import morgan from "morgan";
import MainRoute from "./routes/index";
import { createServer } from "http";
import configureSocketIO from "./socketio/socket";

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
    keys: [process.env.COOKIE_KEY!],
    maxAge: 3 * 24 * 60 * 60 * 1000, // 3days
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    methods: "GET,POST,PUT,DELETE",
    credentials: true,
  })
);

app.use(MainRoute);

const httpServer = createServer(app);

configureSocketIO(httpServer);

httpServer.listen(port, () => {
  console.log(
    `============================\nServer is running at http://localhost:${port}`
  );
});
