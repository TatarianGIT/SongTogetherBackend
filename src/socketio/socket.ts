import { Server } from "socket.io";
import { Server as HttpsServer } from "https";
import type {
  AuthRole,
  CurrentSong,
  DatabaseUser,
  NewVideo,
  SocketUser,
  SongQueue,
  VideoDetails,
} from "../types/index.js";
import {
  addUserToList,
  isUserOnSkipList,
  removeFromSkipList,
  removeUserFromList,
  sendNotificationToAll,
  sendNotificationToUser,
  updateSkipThreshold,
} from "./helpers.js";
import { createHlsStream, getVideoDetailsFromYt } from "../utils/ytdl.js";
import {
  deleteDirectoryWithContent,
  findFilesWithExtension,
  getStreamPath,
  isVideoSupported,
  listDirectories,
} from "../utils/helpers.js";
import {
  getAllUsers,
  getUser,
  getUserFromSession,
  updateUserRole,
} from "../sqlite3/userServieces.js";
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
import { hasRequiredRole } from "../middleware/auth.js";
import {
  changeSongLimit,
  getSongLimit,
  insertDefaultLimit,
} from "../sqlite3/songLimitServieces.js";

dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

let io: Server;

let userList: SocketUser[] = [];

let skipCount: number = 0;
let skipList: SocketUser[] = [];
let skipThreshold: number = 0;
let toSkip: boolean = false;

let prevQueue: SongQueue = await getQueue({ queueType: "prev", limit: 30 });
let nextQueue: SongQueue = await getQueue({ queueType: "next" });
let currentSong: CurrentSong = await getCurrentSong();

let nextQueueLimit = await getSongLimit();

let fullFilePath: string = "";

let isQueueRunning: boolean = false;
let currentTimestamp = 0;

let isDownloading: boolean = false;

let nextSongHlsPromise: Promise<void> | null = null;

const configureSocketIO = (httpsServer: HttpsServer) => {
  io = new Server(httpsServer, {
    cors: {
      origin: process.env.CLIENT_URL as string,
      methods: ["GET", "POST"],
      credentials: true,
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
          if (user.role === null) {
            return;
          }
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

    const {
      discord_id,
      avatar,
      banner_color,
      global_name,
      id,
      username,
      role,
    } = userData;

    const user: SocketUser = {
      discord_id,
      avatar,
      banner_color,
      username,
      global_name: global_name ?? username,
      id,
      role,
    };

    if (
      !hasRequiredRole({
        userRole: user.role,
        requiredRole: ["basic", "moderator", "admin"],
      })
    )
      return;

    socket.join("mainRoom");

    userList = await addUserToList(user, userList);
    io.emit("updateUserList", userList);

    skipCount = skipList.length;
    skipThreshold = updateSkipThreshold(userList);
    io.emit("updateSkipThreshold", skipThreshold);

    mainFunction();

    socket.on("getUserList", async () => {
      try {
        io.emit("updateUserList", userList);
      } catch (error) {
        console.error("socket getUserList", error);
      }
    });

    socket.on("disconnect", async () => {
      try {
        userList = await removeUserFromList(user, userList);
        io.emit("updateUserList", userList);

        skipList = removeFromSkipList(user, skipList);
        skipThreshold = updateSkipThreshold(userList);
        skipCount = skipList.length;
        io.emit("updateSkipThreshold", skipThreshold);
        io.emit("updateSkipCount", skipCount);
      } catch (error) {
        console.error("socket disconnect", error);
      }
    });

    // Adding new song
    socket.on("addSong", async (body: { videoUrl: string }) => {
      try {
        if (
          nextQueue &&
          nextQueueLimit !== null &&
          nextQueue.length >= nextQueueLimit
        ) {
          await sendNotificationToUser(
            socket,
            "Queue is full!",
            `Sorry, only ${nextQueueLimit} songs are allowed in the queue.`,
            "destructive"
          );
          return;
        }

        const videoDetails = await getVideoDetailsFromYt(body.videoUrl, socket);
        if (!videoDetails) return;

        if (!(await isVideoSupported(videoDetails, nextQueue, socket))) return;

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

            if (nextQueue && nextQueue[0]) {
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

    // Sending isDownloading state
    socket.on("getIsDownloading", () => {
      try {
        io.emit("updateDownloadingState", isDownloading);
      } catch (error) {
        console.error("socket getIsDownloading", error);
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
        if (await isAlreadyFavourite(videoId, user.id)) {
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
        console.error("socket addToFavs", error);
      }
    });

    // Removing song from user's favs
    socket.on("removeFromFavs", async (videoId: string) => {
      try {
        if (!(await isAlreadyFavourite(videoId, user.id))) {
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
        console.error("socket removeFromFavs", error);
      }
    });

    socket.on("getAllUsers", async () => {
      try {
        if (
          !(await hasRequiredRole({
            userRole: user.role,
            requiredRole: ["admin"],
          }))
        )
          return;

        const allUsers = await getAllUsers();

        socket.emit("updateAllUsers", allUsers);
      } catch (error) {
        console.error("socket getAllUsers", error);
      }
    });

    socket.on("updateUserRole", async (username: string, role: AuthRole) => {
      try {
        if (
          !(await hasRequiredRole({
            userRole: user.role,
            requiredRole: ["admin"],
          }))
        )
          return;

        if (username === user.username) {
          sendNotificationToUser(
            socket,
            "Whoops!",
            "You can't change your role",
            "destructive"
          );
          return;
        }
        if (username === process.env.OWNER_DISCORD_USERNAME) {
          return;
        }

        const singleUser: DatabaseUser = await getUser({ username });

        if (!singleUser) {
          sendNotificationToUser(
            socket,
            "No user found!",
            `User ${username} was not found in database.`,
            "destructive"
          );
          return;
        }

        const result = await updateUserRole(username, role);

        if (result?.changes === 0)
          sendNotificationToUser(
            socket,
            "Nothing happend!",
            "User's role wasn't updated",
            "destructive"
          );

        sendNotificationToAll(
          "Success!",
          `User ${username} just received the ${
            role === null ? "none" : role
          } role.`,
          "default"
        );

        const allUsers = await getAllUsers();
        socket.emit("updateAllUsers", allUsers);

        socket.to("mainRoom").to(singleUser.discord_id).emit("updateUser");
      } catch (error) {
        console.log("socket updateUserRole", error);
      }
    });

    socket.on("getSkipCount", async () => {
      try {
        socket.emit("updateSkipCount", skipCount);
      } catch (error) {
        console.log("socket getSkipCount", error);
      }
    });

    socket.on("getSkipThreshold", async () => {
      try {
        skipThreshold = updateSkipThreshold(userList);

        io.emit("updateSkipThreshold", skipThreshold);
      } catch (error) {
        console.log("socket getSkipThreshold", error);
      }
    });

    socket.on("handleSkip", async () => {
      try {
        if (isUserOnSkipList(user, skipList)) {
          sendNotificationToUser(
            socket,
            "Vote skip failed!",
            "You have already voted to skip this song.",
            "destructive"
          );
          return;
        }

        sendNotificationToUser(
          socket,
          "Success!",
          "You voted to skip the song..",
          "default"
        );

        skipList.push(user);
        skipCount = skipList.length;
        skipThreshold = updateSkipThreshold(userList);

        io.emit("updateSkipCount", skipCount);
        io.emit("updateSkipThreshold", skipThreshold);

        if (skipCount === skipThreshold) {
          sendNotificationToAll(
            "Skipped!",
            `Song: ${currentSong?.title} has just been skipped.`,
            "default"
          );

          skipCount = 0;
          skipList = [];
          skipThreshold = updateSkipThreshold(userList);

          toSkip = true;
        }

        return;
      } catch (error) {
        console.log("socket handleSkip", error);
      }
    });

    socket.on("getSongLimit", async () => {
      try {
        const limit = await getSongLimit();

        socket.emit("updateSongLimit", limit);
      } catch (error) {
        console.log("socket getSongLimit");
      }
    });

    socket.on("setNewLimit", async (newLimit: number) => {
      try {
        if (
          !(await hasRequiredRole({
            userRole: user.role,
            requiredRole: ["admin"],
          }))
        )
          return;

        if (newLimit < 0 || newLimit > 100)
          return sendNotificationToUser(
            socket,
            "Wrong limit value!",
            "Limit shuld be in range of 0 to 100.",
            "destructive"
          );

        const limit = await getSongLimit();

        if (limit === newLimit) {
          sendNotificationToUser(
            socket,
            "Error!",
            "Limit must be different from the current one.",
            "destructive"
          );
        }

        const info = await changeSongLimit(newLimit);

        if (info && info.changes === 1) {
          nextQueueLimit = newLimit;

          sendNotificationToUser(
            socket,
            "Success!",
            `Limit is now ${newLimit}`,
            "default"
          );
        } else {
          sendNotificationToUser(
            socket,
            "Error!",
            "Unexprected error occurred while changing song limit",
            "destructive"
          );
        }

        return io.emit("updateSongLimit", newLimit);
      } catch (error) {
        console.log("socket setNewLimit");
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

  toSkip = false;
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
    isDownloading = true;
    io.emit("updateDownloadingState", isDownloading);
    console.log("Waiting for next song HLS stream creation to complete...");
    await nextSongHlsPromise;
    isDownloading = false;
    io.emit("updateDownloadingState", isDownloading);
  }

  // get all directories and current song's .m3u8 file
  let directories = await listDirectories(`${mainDirectory}/song`);
  let filteredFiles = await findFilesWithExtension(
    `${mainDirectory}/song/${currentSong.videoId}`,
    ".m3u8"
  );

  // create stream of current song if stream doesn't exist
  if (!directories?.includes(currentSong.videoId) && !filteredFiles) {
    isDownloading = true;
    io.emit("updateDownloadingState", isDownloading);
    await createHlsStream(currentSong.videoUrl, currentSong.videoId);
    isDownloading = false;
    io.emit("updateDownloadingState", isDownloading);
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

    fullFilePath = `https://${process.env.HOST_URL}:${process.env.PORT}${streamPath}`;
    io.emit("updateStreamPath", fullFilePath);
  }

  skipCount = skipList.length;
  skipThreshold = updateSkipThreshold(userList);

  io.emit("updateSkipCount", skipCount);
  io.emit("updateSkipThreshold", skipThreshold);

  // if there is next song, create hls stream
  if (nextSong && nextQueue && nextQueue[0]) {
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
      if (prevQueue.length > 30) {
        prevQueue.pop();
      }
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
        if (currentTimestamp === length || toSkip === true) {
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
