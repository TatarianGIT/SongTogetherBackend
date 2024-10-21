import { Router, Request, Response } from "express";
import { AuthRoute } from "./auth/auth.js";
import { isAuthenticated } from "../middleware/auth.js";
import SongRoute from "./song.js";
import SessionRoute from "./auth/session.js";
import fs from "fs";
import { mainDirectory } from "../envVars.js";
import { dirname } from "path";

const MainRoute = Router();

// Public routes
MainRoute.use(SessionRoute);

// Handle auth operations
MainRoute.use("/auth", AuthRoute);

// Protected routes

// Handle song operations
MainRoute.use("/song", isAuthenticated, SongRoute);

// Serve static files

export let currentSongStaticPath: string | undefined;

export const updateStaticPath = (currentSongId: string | undefined) => {
  currentSongStaticPath = `${currentSongId}`;
};

MainRoute.use("", async (req: Request, res: Response) => {
  try {
    const streamFile = `${currentSongStaticPath}`;
    const requestFile = req.url;
    const fullFilePath = dirname(mainDirectory) + requestFile;

    if (!currentSongStaticPath) {
      return res.status(404).json({ message: "No song available" });
    }

    if (!requestFile.includes(streamFile)) {
      return res
        .status(403)
        .json({ message: "Access to this directory is forbidden" });
    }

    fs.readFile(fullFilePath, (error, content) => {
      if (error) {
        console.log(error);
        return res.status(400).json({ message: "Unexpected error occurred" });
      } else {
        res.writeHead(200, { "Content-Type": "application/vnd.apple.mpegurl" });
        res.end(content, "utf-8");
      }
    });
  } catch (error) {
    console.error("mainRoute file request:", error);
  }
});

export default MainRoute;
