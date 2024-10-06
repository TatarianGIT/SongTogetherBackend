import { Router, Request, Response } from "express";
import dotenv from "dotenv";
import { User } from "lucia";
import { getAllUserFavs } from "../sqlite3/favouriteServieces.js";
import axios from "axios";
import { envVars } from "../envVars.js";

dotenv.config();

const SongRoute = Router();

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
    key: envVars!.YOUTUBE_API_KEY,
    type: "video",
    maxResults: 10,
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

SongRoute.get("/favourites", async (req: Request, res: Response) => {
  try {
    const user: User = res.locals.user;
    const favList = await getAllUserFavs(user.id);

    if (favList) {
      return res.status(200).send(JSON.stringify(favList));
    }

    return res.status(200).send([]);
  } catch (error: any) {
    res.status(400).send({ message: "Failed to fetch YouTube links" });
    console.log(`Error SongRoute get favourites: ${error}`);
  }
});

export default SongRoute;
