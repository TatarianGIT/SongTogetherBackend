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
  audioSegmentPath: string
) => {
  try {
    console.log("Getting info...");
    const info = await ytdl.getInfo(url);

    console.log("Getting video format...");
    let videoFormat = ytdl.chooseFormat(info.formats, { quality: "134" }); // 134 corresponds to 720p video-only
    if (!videoFormat) {
      throw new Error("Video format not found");
    }

    console.log("Getting audio format...");
    const audioFormat = ytdl.chooseFormat(info.formats, {
      quality: "highestaudio",
    });
    if (!audioFormat) {
      throw new Error("Audio format not found");
    }

    const videoStream = ytdl(url, { format: videoFormat });
    const audioStream = ytdl(url, { format: audioFormat });

    console.log("Getting video...");
    const videoPromise = pipeline(
      videoStream,
      fs.createWriteStream(videoSegmentPath)
    )
      .then(() => {
        console.log("Video segment finished");
      })
      .catch((err) => {
        console.error("Error in video stream:", err);
        throw err;
      });

    console.log("Getting audio...");
    const audioPromise = pipeline(
      audioStream,
      fs.createWriteStream(audioSegmentPath)
    )
      .then(() => {
        console.log("Audio segment finished");
      })
      .catch((err) => {
        console.error("Error in audio stream:", err);
        throw err;
      });

    await Promise.all([videoPromise, audioPromise]);

    console.log("Both video and audio segments finished");
  } catch (err) {
    console.error("downloadSegments Error:", err.message);
  }
};
