import { Router, Request, Response } from "express";
import dotenv from "dotenv";
import { findFilesWithExtension } from "../utils/helpers";
import { getVideoDetails } from "../utils/ytdl";

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
  const songInfo = await getVideoDetails(query);
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
    // const response = await axios.get(url, { params });
    // const items = response.data.items;
    // res.status(200).send(items);
    res.status(200).send(exampleData);
  } catch (error) {
    console.error("Error fetching YouTube data:", error);
    return res.status(400).send({ message: "Failed to fetch YouTube links" });
  }
});

export default SongRoute;

const exampleData = [
  {
    kind: "youtube#searchResult",
    etag: "VHjvg_bG2lU1ltHR1cYHtPq5zx0",
    id: { kind: "youtube#video", videoId: "Kbj2Zss-5GY" },
    snippet: {
      publishedAt: "2018-06-05T22:00:01Z",
      channelId: "UCHE7rAi1Fw1CBmQXFtvJmrw",
      title:
        "A$AP Rocky - Praise The Lord (Da Shine) (Official Video) ft. Skepta",
      description:
        "Official Video for ”Praise The Lord (Da Shine)” by A$AP Rocky feat. Skepta Listen to A$AP Rocky: ...",
      thumbnails: {
        default: {
          url: "https://i.ytimg.com/vi/Kbj2Zss-5GY/default.jpg",
          width: 120,
          height: 90,
        },
        medium: {
          url: "https://i.ytimg.com/vi/Kbj2Zss-5GY/mqdefault.jpg",
          width: 320,
          height: 180,
        },
        high: {
          url: "https://i.ytimg.com/vi/Kbj2Zss-5GY/hqdefault.jpg",
          width: 480,
          height: 360,
        },
      },
      channelTitle: "LIVELOVEASAPVEVO",
      liveBroadcastContent: "none",
      publishTime: "2018-06-05T22:00:01Z",
    },
  },
  {
    kind: "youtube#searchResult",
    etag: "q9Bzuh4JMwMxuqXDyQZW0NBDpns",
    id: { kind: "youtube#video", videoId: "pM5XogpX1JA" },
    snippet: {
      publishedAt: "2018-11-02T17:58:38Z",
      channelId: "UCHE7rAi1Fw1CBmQXFtvJmrw",
      title: "A$AP Rocky - Fukk Sleep (Official Video) ft. FKA twigs",
      description:
        "Official Video for ”Fukk Sleep” by A$AP Rocky feat. FKA twigs Listen to A$AP Rocky: https://AsapRocky.lnk.to/listenYD Watch more ...",
      thumbnails: {
        default: {
          url: "https://i.ytimg.com/vi/pM5XogpX1JA/default.jpg",
          width: 120,
          height: 90,
        },
        medium: {
          url: "https://i.ytimg.com/vi/pM5XogpX1JA/mqdefault.jpg",
          width: 320,
          height: 180,
        },
        high: {
          url: "https://i.ytimg.com/vi/pM5XogpX1JA/hqdefault.jpg",
          width: 480,
          height: 360,
        },
      },
      channelTitle: "LIVELOVEASAPVEVO",
      liveBroadcastContent: "none",
      publishTime: "2018-11-02T17:58:38Z",
    },
  },
  {
    kind: "youtube#searchResult",
    etag: "gRizeF2eqeGda9MBCWh8vG9MNE8",
    id: { kind: "youtube#video", videoId: "F6VfsJ7LAlE" },
    snippet: {
      publishedAt: "2013-09-26T14:00:04Z",
      channelId: "UCHE7rAi1Fw1CBmQXFtvJmrw",
      title: "A$AP Rocky - Fashion Killa (Explicit - Official Video)",
      description:
        "Official Video for ”Fashion Killa (Explicit)” by A$AP Rocky Listen to A$AP Rocky: https://AsapRocky.lnk.to/listenYD Watch more ...",
      thumbnails: {
        default: {
          url: "https://i.ytimg.com/vi/F6VfsJ7LAlE/default.jpg",
          width: 120,
          height: 90,
        },
        medium: {
          url: "https://i.ytimg.com/vi/F6VfsJ7LAlE/mqdefault.jpg",
          width: 320,
          height: 180,
        },
        high: {
          url: "https://i.ytimg.com/vi/F6VfsJ7LAlE/hqdefault.jpg",
          width: 480,
          height: 360,
        },
      },
      channelTitle: "LIVELOVEASAPVEVO",
      liveBroadcastContent: "none",
      publishTime: "2013-09-26T14:00:04Z",
    },
  },
  {
    kind: "youtube#searchResult",
    etag: "CBxn5e0Ii2RMXYOiqUn6Z3r66yg",
    id: { kind: "youtube#video", videoId: "Ec3LoKpGJxY" },
    snippet: {
      publishedAt: "2018-11-20T17:00:00Z",
      channelId: "UCHE7rAi1Fw1CBmQXFtvJmrw",
      title: "A$AP Rocky - Sundress (Official Video)",
      description:
        "Official Video for ”Sundress” by A$AP Rocky Listen to A$AP Rocky: https://AsapRocky.lnk.to/listenYD Watch more videos by A$AP ...",
      thumbnails: {
        default: {
          url: "https://i.ytimg.com/vi/AT9JoIv2kss/default.jpg",
          width: 120,
          height: 90,
        },
        medium: {
          url: "https://i.ytimg.com/vi/AT9JoIv2kss/mqdefault.jpg",
          width: 320,
          height: 180,
        },
        high: {
          url: "https://i.ytimg.com/vi/AT9JoIv2kss/hqdefault.jpg",
          width: 480,
          height: 360,
        },
      },
      channelTitle: "LIVELOVEASAPVEVO",
      liveBroadcastContent: "none",
      publishTime: "2018-11-20T17:00:00Z",
    },
  },
  {
    kind: "youtube#searchResult",
    etag: "u0_g1_r-AmUMTzdv669hHt27AZs",
    id: { kind: "youtube#video", videoId: "BNzc6hG3yN4" },
    snippet: {
      publishedAt: "2018-04-05T17:00:00Z",
      channelId: "UCHE7rAi1Fw1CBmQXFtvJmrw",
      title: "A$AP Rocky - A$AP Forever (Official Video) ft. Moby",
      description:
        "Official Video for ”A$AP Forever” by A$AP Rocky feat. Moby Listen to A$AP Rocky: https://AsapRocky.lnk.to/listenYD Watch more ...",
      thumbnails: {
        default: {
          url: "https://i.ytimg.com/vi/Ec3LoKpGJxY/default.jpg",
          width: 120,
          height: 90,
        },
        medium: {
          url: "https://i.ytimg.com/vi/Ec3LoKpGJxY/mqdefault.jpg",
          width: 320,
          height: 180,
        },
        high: {
          url: "https://i.ytimg.com/vi/Ec3LoKpGJxY/hqdefault.jpg",
          width: 480,
          height: 360,
        },
      },
      channelTitle: "LIVELOVEASAPVEVO",
      liveBroadcastContent: "none",
      publishTime: "2018-04-05T17:00:00Z",
    },
  },
];
