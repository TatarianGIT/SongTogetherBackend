import express, { Application } from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import cookieSession from "cookie-session";
import "./config/passport.config.js";
import morgan from "morgan";
import MainRoute from "./routes/index.js";
import { Server } from "socket.io";
import { createServer } from "http";
import { jwtDecode } from "jwt-decode";
import { IoUserResponse } from "./types/index.js";

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

app.use(MainRoute);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.use((socket, next) => {
  try {
    const cookies = socket.handshake.headers.cookie;
    const sessionCookie = cookies
      .split("; ")
      .find((row) => row.startsWith("session="));
    const sessionValue = sessionCookie ? sessionCookie.split("=")[1] : null;

    const token = sessionValue;

    const decodedToken = jwtDecode<IoUserResponse>(token, { header: true });

    if (decodedToken?.passport?.user !== undefined) {
      socket.data.userData = decodedToken.passport.user;
      return next();
    }
  } catch (error) {
    console.log("invalid token");
  }
});

httpServer.listen(port, () => {
  console.log(
    `============================\nServer is running at http://localhost:${port}`
  );
});
