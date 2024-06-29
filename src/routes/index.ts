import { Router, Request, Response } from "express";
import AuthRoute from "./auth.js";
import SongRoute from "./song.js";
import { isAuthenticated } from "../middleware/isAuthenticated.js";
import fs from "fs";

const MainRoute = Router();

MainRoute.use("/auth", AuthRoute);
MainRoute.use("/song", isAuthenticated, SongRoute);

//stream song
MainRoute.use("", async (req: Request, res: Response) => {
  var filePath = "." + req.url;

  fs.readFile(filePath, function (error, content) {
    if (error) {
      console.log(error);
      if (error.code == "ENOENT") {
        res.json({ message: "File does not exist" }).status(400);
      } else {
        res.json({ message: "Unexpected error occured" }).status(400);
      }
    } else {
      res.writeHead(200, { "Content-Type": "application/vnd.apple.mpegurl" });
      res.end(content, "utf-8");
    }
  });
});

export default MainRoute;
