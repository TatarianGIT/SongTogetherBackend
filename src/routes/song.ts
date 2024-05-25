import { Router, Request, Response } from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const SongRoute = Router();

SongRoute.post("", async (req: Request, res: Response) => {
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
    maxResults: 5,
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
