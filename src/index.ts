import express, { Application } from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import cookieSession from "cookie-session";
import morgan from "morgan";
import { createServer } from "https";
import fs from "fs";
import { configureSocketIO } from "./socketio/socket.js";
import MainRoute from "./routes/index.js";

dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

const app: Application = express();
const PORT = process.env.PORT;
const HOST_URL = process.env.HOST_URL;
const NODE_ENV = process.env.NODE_ENV;

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
    `Running ${NODE_ENV} build of SongTogether\n
    Server is running at https://${HOST_URL}:${PORT}\n\n`
  );
});
