import { Router, Request, Response } from "express";
import AuthRoute from "./auth.js";
import SongRoute from "./song.js";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import fs from "fs";

const MainRoute = Router();

MainRoute.use("/auth", AuthRoute);
MainRoute.use("/song", isAuthenticated, SongRoute);

// Serve static files
MainRoute.use("", async (req: Request, res: Response) => {
  try {
    const baseDirectory = "./src/song/stream";
    const filePath = "." + req.url;

    if (!filePath.startsWith(baseDirectory)) {
      return res
        .status(400)
        .json({ message: "Access to this directory is forbidden" });
    } else {
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
