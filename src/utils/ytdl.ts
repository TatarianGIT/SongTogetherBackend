import fs from "fs";
import ytdl, { videoInfo } from "ytdl-core";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { convertToHls, mergeSegments } from "./ffmpeg.js";

ffmpeg.setFfmpegPath(ffmpegPath);

export const getVideoDetails = async (url: string) => {
  const data: videoInfo = await ytdl.getInfo(url);
  const videoId = ytdl.getVideoID(url);

  const { baseUrl } = data;
  const thumbnailUrl = data.videoDetails.thumbnails[3].url;
  const { lengthSeconds, title } = data.videoDetails;

  return {
    url: baseUrl,
    videoId,
    title,
    lengthSeconds,
    thumbnailUrl,
    addedBy: "Tatarian",
  };
};
