import express, { Application } from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import cookieSession from "cookie-session";
import morgan from "morgan";
import { createServer } from "http";
import { configureSocketIO } from "./socketio/socket.js";
import MainRoute from "./routes/index.js";

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
