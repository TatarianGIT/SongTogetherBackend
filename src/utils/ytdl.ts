import fs from "fs";
import ytdl, { videoInfo } from "@distube/ytdl-core";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { convertToHls, mergeSegments } from "./ffmpeg.js";
import { promisify } from "util";
import { pipeline as streamPipeline } from "stream";

const pipeline = promisify(streamPipeline);

ffmpeg.setFfmpegPath(ffmpegPath);

export const getVideoDetails = async (url: string) => {
  const data: videoInfo = await ytdl.getInfo(url);
  const videoId = ytdl.getVideoID(url);

  const { baseUrl } = data;
  const thumbnailUrl = data.videoDetails.thumbnails[3].url;
  const { lengthSeconds, title } = data.videoDetails;

  await createHlsStream(url, videoId);

  return {
    url: baseUrl,
    videoId,
    title,
    lengthSeconds,
    thumbnailUrl,
    addedBy: "Tatarian",
  };
};

export const createHlsStream = async (url: string, videoId: string) => {
  const outputFilePath = `./src/song/${videoId}.mp4`;
  const videoSegmentPath = "./src/song/video.mp4";
  const audioSegmentPath = "./src/song/audio.mp4";

  await downloadSegments(url, videoSegmentPath, audioSegmentPath);
  await mergeSegments(videoSegmentPath, audioSegmentPath, outputFilePath);
  await convertToHls(outputFilePath, videoId);
};

const downloadSegments = async (
  url: string,
  videoSegmentPath: string,
  audioSegmentPath: string,
  videoId?: string
) => {
  try {
    const info = await ytdl.getInfo(url);
    let videoFormat = ytdl.chooseFormat(info.formats, { quality: "134" }); // 134 corresponds to 720p video-only
    if (!videoFormat) {
      throw new Error("Video format not found");
    }

    const audioFormat = ytdl.chooseFormat(info.formats, {
      quality: "highestaudio",
    });
    if (!audioFormat) {
      throw new Error("Audio format not found");
    }

    const videoStream = ytdl(url, { format: videoFormat });
    const audioStream = ytdl(url, { format: audioFormat });

    const videoPromise = pipeline(
      videoStream,
      fs.createWriteStream(videoSegmentPath)
    )
      .catch((err) => {
        console.error("Error in video stream:", err);
        throw err;
      });

    const audioPromise = pipeline(
      audioStream,
      fs.createWriteStream(audioSegmentPath)
    )
      .catch((err) => {
        console.error("Error in audio stream:", err);
        throw err;
      });

    await Promise.all([videoPromise, audioPromise]);
  } catch (err) {
    console.error("downloadSegments Error:", err.message);
  }
};
