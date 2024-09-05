import { Router, Request, Response } from "express";
import { AuthRoute } from "./auth/auth.js";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import SongRoute from "./song.js";
import SessionRoute from "./auth/session.js";
import fs from "fs";

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
  currentSongStaticPath = currentSongId;
};

MainRoute.use("", async (req: Request, res: Response) => {
  try {
    const baseDirectory = `./src/song/${currentSongStaticPath}`;
    const filePath = "." + req.url;

    if (!currentSongStaticPath) {
      return res.status(400).json({ message: "No song available" });
    }

    if (!filePath.startsWith(baseDirectory)) {
      return res
        .status(400)
        .json({ message: "Access to this directory is forbidden" });
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
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
