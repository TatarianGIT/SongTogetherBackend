import express, { Application } from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import cookieSession from "cookie-session";
import morgan from "morgan";
import { createServer } from "https";
import fs from 'fs';
import { configureSocketIO } from "./socketio/socket.js";
import MainRoute from "./routes/index.js";

dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

const app: Application = express();
const PORT = process.env.PORT;
const HOST = process.env.HOST;

const sslKey = fs.readFileSync("/home/luke/selfsigned.key", "utf8");
const sslCert = fs.readFileSync("/home/luke/selfsigned.crt", "utf8");

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
    origin: process.env.CLIENT_URL!,
    methods: "GET,POST,PUT,DELETE",
    credentials: true,
  })
);

app.use(MainRoute);

const httpsServer = createServer({ key: sslKey, cert: sslCert }, app);

configureSocketIO(httpsServer);

httpsServer.listen(PORT, () => {
  console.log(
    `Running ${process.env.NODE_ENV} build of SongTogether\nServer is running at http://${HOST}:${PORT}\n\n`
  );
});
