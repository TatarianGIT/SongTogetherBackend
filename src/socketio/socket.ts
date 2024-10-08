import { Server } from "socket.io";
import { Server as HttpsServer } from "https";
import type {
  CurrentSong,
  DatabaseUser,
  NewVideo,
  SocketUser,
  SongQueue,
  VideoDetails,
} from "../types/index.js";
import {
  addUserToList,
  removeUserFromList,
  sendNotificationToUser,
} from "./helpers.js";
import { createHlsStream, getVideoDetailsFromYt } from "../utils/ytdl.js";
import {
  deleteDirectoryWithContent,
  findFilesWithExtension,
  getStreamPath,
  isVideoSupported,
  listDirectories,
} from "../utils/helpers.js";
import { getUserFromSession } from "../sqlite3/userServieces.js";
import dotenv from "dotenv";
import {
  addVideo,
  changeSongStatus,
  getCurrentSong,
  getNextVideo,
  getQueue,
  getVideoDetails,
} from "../sqlite3/videoServieces.js";
import { updateStaticPath } from "../routes/index.js";
import {
  addNewFavourite,
  isAlreadyFavourite,
  removeFromFavourites,
} from "../sqlite3/favouriteServieces.js";
import { mainDirectory } from "../envVars.js";

dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

let io: Server;

let userList: SocketUser[] = [];

let prevQueue: SongQueue = await getQueue({ queueType: "prev", limit: 20 });
let nextQueue: SongQueue = await getQueue({ queueType: "next" });
let currentSong: CurrentSong = await getCurrentSong();

let fullFilePath: string = "";

let isQueueRunning: boolean = false;
let currentTimestamp = 0;

let nextSongHlsPromise: Promise<void> | null = null;

const configureSocketIO = (httpsServer: HttpsServer) => {
  io = new Server(httpsServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ["GET", "POST"],
      credentials: true
    },
  });

  io.use(async (socket, next) => {
    try {
      const cookies = socket.handshake.headers.cookie;

      const sessionCookie = cookies!
        .split("; ")
        .find((row) => row.startsWith("auth_session="));
      const sessionId = sessionCookie ? sessionCookie.split("=")[1] : null;

      if (sessionId) {
        const user: DatabaseUser | null = await getUserFromSession(sessionId);
        if (user) {
          socket.data.userData = user;
          return next();
        }
      }
    } catch (error) {
      console.log("invalid session");
    }
  });

  io.on("connection", async (socket) => {
    const userData: DatabaseUser = socket.data.userData;

    const { discord_id, avatar, banner_color, global_name, id } = userData;
    const user: SocketUser = {
      discord_id,
      avatar,
      banner_color,
      global_name,
      id,
    };

    userList = await addUserToList(user, userList);
    io.emit("updateUserList", userList);

    mainFunction();

    socket.on("getUserList", async () => {
      io.emit("updateUserList", userList);
    });

    socket.on("disconnect", async () => {
      userList = await removeUserFromList(user, userList);
      io.emit("updateUserList", userList);
    });

    // Adding new song
    socket.on("addSong", async (body: { videoUrl: string }) => {
      try {
        const videoDetails = await getVideoDetailsFromYt(body.videoUrl, socket);
        if (!videoDetails) return;

        if (!isVideoSupported(videoDetails, socket)) return;

        const newVideo: NewVideo = {
          ...videoDetails,
          userId: user.id,
        };
        const nextVideoId = await getNextVideo();

        // when next queue is empty
        if (!nextVideoId && !currentSong) {
          const newVideoId = await addVideo(newVideo, { current: true });
          if (newVideoId) {
            const addedVideo: VideoDetails = await getVideoDetails(newVideoId);
            currentSong = addedVideo;
            io.emit("updateCurrentSong", currentSong);
          }
        } else {
          // when next queue is not empty
          const newVideoId = await addVideo(newVideo, { current: false });
          if (newVideoId) {
            const addedVideo: VideoDetails = await getVideoDetails(newVideoId);

            if (addedVideo) {
              if (nextQueue) {
                nextQueue?.push(addedVideo);
              } else {
                nextQueue = [addedVideo];
              }
              io.emit("updateNextQueue", nextQueue);
            }

            if (nextQueue?.length === 1) {
              let directories = await listDirectories(`${mainDirectory}/song`);
              let filteredFiles = await findFilesWithExtension(
                `${mainDirectory}/song/${nextQueue[0].videoId}`,
                ".m3u8"
              );
              if (
                !directories?.includes(nextQueue[0].videoId) &&
                !filteredFiles
              ) {
                nextSongHlsPromise = createHlsStream(
                  nextQueue[0].videoUrl,
                  nextQueue[0].videoId
                );
              } else {
                nextSongHlsPromise = null;
              }
            }
          }
        }
        await mainFunction();
      } catch (error) {
        console.error("socket addSong", error);
      }
    });

    // Send path to .m3u8 file
    socket.on("requestFile", async (filePath) => {
      try {
        if (fullFilePath) io.emit("updateStreamPath", fullFilePath);
        return;
      } catch (error) {
        console.error("socket requestFile", error);
      }
    });

    // Sending previous song queue to frontend
    socket.on("getPrevQueue", () => {
      try {
        io.emit("updatePrevQueue", prevQueue);
      } catch (error) {
        console.error("socket getPrevQueue", error);
      }
    });

    // Sending current song to frontend
    socket.on("getCurrentSong", () => {
      try {
        io.emit("updateCurrentSong", currentSong);
      } catch (error) {
        console.error("socket getCurrentSong", error);
      }
    });

    // Sending current timestamp to frontend
    socket.on("getCurrentTimestamp", () => {
      try {
        io.emit("updateCurrentTimestamp", currentTimestamp);
      } catch (error) {
        console.error("socket getCurrentTimestamp", error);
      }
    });

    // Sending next song queue to frontend
    socket.on("getNextQueue", () => {
      try {
        io.emit("updateNextQueue", nextQueue);
      } catch (error) {
        console.error("socket getNextQueue", error);
      }
    });

    // Adding song to user's favs
    socket.on("addToFavs", async (videoId) => {
      try {
        const isAlreadyFav = await isAlreadyFavourite(videoId, user.id);

        if (isAlreadyFav) {
          sendNotificationToUser(
            socket,
            "Woops!",
            "This song is already in favourites!",
            "destructive"
          );

          return;
        }

        const video = await getVideoDetailsFromYt(videoId, socket);

        if (video) {
          const result = await addNewFavourite(
            video.videoId,
            video.title,
            video.thumbnailUrl,
            user.id
          );

          if (result) {
            sendNotificationToUser(
              socket,
              "Success!",
              "The song has been added to favorites!",
              "default"
            );
          }

          return;
        }
      } catch (error) {
        console.error("socket getNextQueue", error);
      }
    });

    // Removing song from user's favs
    socket.on("removeFromFavs", async (videoId: string) => {
      try {
        const isAlreadyFav = await isAlreadyFavourite(videoId, user.id);

        if (!isAlreadyFav) {
          sendNotificationToUser(
            socket,
            "Woops!",
            "This song is not your favourite.",
            "destructive"
          );

          return;
        }

        const result = await removeFromFavourites(videoId, user.id);

        if (!result) {
          sendNotificationToUser(
            socket,
            "Error!",
            "An error occurred while removing song from favourites.",
            "destructive"
          );
          return;
        }

        sendNotificationToUser(
          socket,
          "Success!",
          "Song was removed from favourites.",
          "default"
        );

        return;
      } catch (error) {
        console.error("socket getNextQueue", error);
      }
    });
  });
};

const mainFunction = async () => {
  if (isQueueRunning) {
    return;
  }

  await deleteDirectoryWithContent({
    directoryPath: `${mainDirectory}/song`,
    deleteDirectory: false,
  });

  await startQueue();
  isQueueRunning = false;
};

const startQueue = async (): Promise<void> => {
  isQueueRunning = true;

  if (userList.length === 0) {
    console.log("No users!");
    return;
  }

  fullFilePath = "";

  const currentSongInDb = await getCurrentSong();
  const nextSong = await getNextVideo();

  // exit if no current song
  if (!currentSongInDb || !currentSong) {
    console.log("No current song");

    // if no current song but next song exists
    if (nextSong && nextQueue && nextQueue.length > 0) {
      await changeSongStatus(nextSong.id, { action: "nextToCurrent" });
      nextQueue?.shift();
      io.emit("updateNextQueue", nextQueue);

      currentSong = nextSong;
      io.emit("updateCurrentSong", currentSong);

      return startQueue();
    }

    return;
  }

  // update static path to current songs's id
  updateStaticPath(currentSong.videoId);

  // wait if hls creation of next video is pending
  if (nextSongHlsPromise) {
    console.log("Waiting for next song HLS stream creation to complete...");
    await nextSongHlsPromise;
  }

  // get all directories and current song's .m3u8 file
  let directories = await listDirectories(`${mainDirectory}/song`);
  let filteredFiles = await findFilesWithExtension(
    `${mainDirectory}/song/${currentSong.videoId}`,
    ".m3u8"
  );

  // create stream of current song if stream doesn't exist
  if (!directories?.includes(currentSong.videoId) && !filteredFiles) {
    io.emit("updateDownloadingState", true);
    await createHlsStream(currentSong.videoUrl, currentSong.videoId);
    io.emit("updateDownloadingState", false);
  }

  // get .m3u8 file
  filteredFiles = await findFilesWithExtension(
    `${mainDirectory}/song/${currentSong.videoId}`,
    ".m3u8"
  );

  // check if .m3u8 file exists
  if (filteredFiles) {
    const streamPath = await getStreamPath(
      `${mainDirectory}/song/${currentSong.videoId}/${currentSong.videoId}.m3u8`
    );

    fullFilePath = `https://${process.env.HOST}:${process.env.PORT}${streamPath}`;
    io.emit("updateStreamPath", fullFilePath);
  }

  // if there is next song, create hls stream
  if (nextSong && nextQueue && nextQueue.length > 0) {
    nextSongHlsPromise = createHlsStream(
      nextQueue[0].videoUrl,
      nextQueue[0].videoId
    );
  } else {
    nextSongHlsPromise = null;
  }

  // wait for video end
  await songInterval(parseInt(currentSongInDb.lengthSeconds));

  // remove directory of a video and its stream files if next video isn't duplicate
  if (!nextQueue || currentSong.videoId !== nextQueue[0]?.videoId) {
    await deleteDirectoryWithContent({
      directoryPath: `${mainDirectory}/song/${currentSong.videoId}`,
      deleteDirectory: true,
    });
  }

  // next song
  await handleNextSong(currentSongInDb.id);

  // set current song's path to undefined
  updateStaticPath(undefined);

  // run recursively
  return startQueue();
};

const handleNextSong = async (currentSongId: string) => {
  try {
    await changeSongStatus(currentSongId, { action: "currentToPrev" });

    if (prevQueue && currentSong) {
      prevQueue.unshift(currentSong);
    } else if (currentSong) {
      prevQueue = [currentSong];
    }

    io.emit("updatePrevQueue", prevQueue);

    const nextSong = await getNextVideo();
    if (!nextSong || nextQueue?.length === 0 || nextQueue === null) {
      currentSong = null;
      io.emit("updateCurrentSong", currentSong);

      return;
    }

    await changeSongStatus(nextSong.id, { action: "nextToCurrent" });
    nextQueue?.shift();
    io.emit("updateNextQueue", nextQueue);

    currentSong = nextSong;
    io.emit("updateCurrentSong", currentSong);

    return;
  } catch (error: any) {
    console.log("Error handleNextSong:", error);
  }
};

const songInterval = async (length: number) => {
  return new Promise<void>((resolve, reject) => {
    try {
      currentTimestamp = 0;
      const intervalId = setInterval(() => {
        currentTimestamp += 1;
        if (currentTimestamp === length) {
          clearInterval(intervalId);
          currentTimestamp = 0;
          return resolve();
        }
      }, 1000);
    } catch (error: any) {
      currentTimestamp = 0;
      console.log("songInterval", error);
      return reject();
    }
  });
};

export { configureSocketIO, io };
