import fs, { promises } from "fs";
import ytdl, { videoInfo } from "@distube/ytdl-core";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
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

    const isLive = data.videoDetails.liveBroadcastDetails?.isLiveNow;
    const thumbnailUrl = data.videoDetails.thumbnails[3].url;
    const { lengthSeconds, title } = data.videoDetails;

    const videoDetails = {
      videoUrl,
      videoId,
      title,
      lengthSeconds,
      thumbnailUrl,
      isLive,
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
    await promises.mkdir(`./src/song/${videoId}`);
    const outputFilePath = `./src/song/${videoId}/${videoId}.mp4`;
    const videoSegmentPath = `./src/song/${videoId}/video.mp4`;
    const audioSegmentPath = `./src/song/${videoId}/audio.mp4`;

    console.log("Downloading segments...");
    await downloadSegments(url, videoSegmentPath, audioSegmentPath);
    console.log("Merging segments...");
    await mergeSegments(videoSegmentPath, audioSegmentPath, outputFilePath);
    await convertToHls(outputFilePath, videoId);
  } catch (error: any) {
    if (error.code === "EEXIST") {
      console.log("Directory already exists: ", videoId);
    } else {
      console.error("createHlsStream", error);
      sendNotificationToAll(
        "An error occurred!",
        "Couldn't create HLS stream!",
        "destructive"
      );
    }
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

    const videoItagPreferences = [136, 135, 134, 133];
    let availableItags: number[] = [];

    info.formats.forEach((format) => {
      if (videoItagPreferences.includes(format.itag)) {
        availableItags = [...availableItags, format.itag];
      }
    });

    if (availableItags.length === 0) {
      availableItags = [160];
    }

    console.log("Getting video format...");

    let videoFormat = null;
    for (const itag of availableItags) {
      videoFormat = ytdl.chooseFormat(info.formats, {
        quality: itag,
      });
      if (videoFormat) {
        break;
      }
    }

    if (!videoFormat) {
      throw new Error("No suitable video format found");
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
