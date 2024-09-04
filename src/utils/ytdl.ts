import fs from "fs";
import ytdl, { videoInfo } from "@distube/ytdl-core";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { clearDirectory } from "./helpers.js";
import { promisify } from "util";
import { pipeline as streamPipeline } from "stream";
import { convertToHls, mergeSegments } from "./ffmpeg.js";
import {
  sendNotificationToAll,
  sendNotificationToUser,
} from "../socketio/helpers.js";
import { Socket } from "socket.io";

const pipeline = promisify(streamPipeline);

ffmpeg.setFfmpegPath(ffmpegPath!);

export const maxVideoDuration = 1800; // 30 mins
export const bannedWords = ["blacha", "2115", "chivas"];

export const getVideoDetailsFromYt = async (
  videoUrl: string,
  socket: Socket
) => {
  try {
    const data: videoInfo = await ytdl.getInfo(videoUrl);
    const videoId = ytdl.getVideoID(videoUrl);

    const thumbnailUrl = data.videoDetails.thumbnails[3].url;
    const { lengthSeconds, title } = data.videoDetails;

    const videoDetails = {
      videoUrl,
      videoId,
      title,
      lengthSeconds,
      thumbnailUrl,
    };

    return videoDetails;
  } catch (error) {
    console.error("getVideoDetails:", error);
    sendNotificationToUser(
      socket,
      "An error occurred!",
      "Couldn't get video details!",
      "destructive"
    );
    return null;
  }
};

let isProcessing = false;

export const createHlsStream = async (url: string, videoId: string) => {
  if (isProcessing) {
    console.log("Processing already in progress. Skipping this call.");
    return;
  }

  isProcessing = true;

  try {
    console.log(`Creation of HLS stream for ${videoId} started.`);
    await clearDirectory("./src/song/stream");
    const outputFilePath = `./src/song/${videoId}.mp4`;
    const videoSegmentPath = "./src/song/video.mp4";
    const audioSegmentPath = "./src/song/audio.mp4";

    console.log("Downloading segments...");
    await downloadSegments(url, videoSegmentPath, audioSegmentPath);
    console.log("Merging segments...");
    await mergeSegments(videoSegmentPath, audioSegmentPath, outputFilePath);
    await convertToHls(outputFilePath, videoId);
  } catch (error) {
    console.error("createHlsStream", error);
    sendNotificationToAll(
      "An error occurred!",
      "Couldn't create HLS stream!",
      "destructive"
    );
  } finally {
    isProcessing = false;
  }
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
  } catch (err: any) {
    console.error("downloadSegments Error:", err.message);
  }
};
