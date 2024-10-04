import { Router, Request, Response } from "express";
import dotenv from "dotenv";
import { findFilesWithExtension } from "../utils/helpers.js";
import { getVideoDetailsFromYt } from "../utils/ytdl.js";
import axios from "axios";

dotenv.config();

const SongRoute = Router();

SongRoute.get("/get", async (req: Request, res: Response) => {
  const m3u8Path = "./src/song/stream";
  const extension = ".m3u8";

  const filteredFiles = await findFilesWithExtension(m3u8Path, extension);
  if (filteredFiles) {
    res
      .status(200)
      .send(`http://localhost:3000/src/song/stream/${filteredFiles}`);
  } else {
    res.status(404).send("No files found");
  }
});

SongRoute.post("/add", async (req: Request, res: Response) => {
  const { query } = req.body.data;
  const songInfo = await getVideoDetailsFromYt(query);
  res.json(songInfo).status(200);
});

SongRoute.post("/search", async (req: Request, res: Response) => {
  const keywords = req.body.data.keywords;
  if (!keywords || keywords.trim() === "") {
    return res
      .send({
        message: "Please provide YouTube search keywords",
        keywords: keywords,
      })
      .status(400);
  }

  const url = `https://www.googleapis.com/youtube/v3/search`;
  const params = {
    part: "snippet",
    q: keywords,
    key: process.env.YOUTUBE_API_KEY,
    type: "video",
    maxResults: 4,
  };

  try {
    const response = await axios.get(url, { params });
    const items = response.data.items;
    res.status(200).send(items);
  } catch (error) {
    console.error("Error fetching YouTube data:", error);
    return res.status(400).send({ message: "Failed to fetch YouTube links" });
  }
});

export default SongRoute;
