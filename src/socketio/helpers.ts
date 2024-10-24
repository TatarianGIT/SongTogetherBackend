import { Socket } from "socket.io";
import { SocketUser } from "../types";
import { io } from "./socket.js";

const sortUserList = async ({
  userList,
}: {
  userList: SocketUser[];
}): Promise<SocketUser[]> => {
  return userList.sort((a, b) => {
    if (a.global_name.toLowerCase() < b.global_name.toLowerCase()) {
      return -1;
    }
    if (a.global_name.toLowerCase() > b.global_name.toLowerCase()) {
      return 1;
    }
    return 0;
  });
};

export const userExistsInRoom = async (
  userData: SocketUser,
  userList: SocketUser[]
) => {
  return userList.some((user) => user.id === userData.id);
};

export const addUserToList = async (
  userData: SocketUser,
  userList: SocketUser[]
) => {
  const isUserOnList = await userExistsInRoom(userData, userList);

  if (!isUserOnList) {
    userList.push(userData);
  }

  return sortUserList({ userList });
};

export const removeUserFromList = async (
  userData: SocketUser,
  userList: SocketUser[]
) => {
  const isUserOnList = await userExistsInRoom(userData, userList);

  if (isUserOnList) {
    userList = userList.filter((user) => user.id !== userData.id);
  }

  return sortUserList({ userList });
};

export const sendNotificationToUser = (
  socket: Socket,
  title: string,
  description: string,
  type: "default" | "destructive"
) => {
  io.to(socket.id).emit("toastNotification", title, description, type);
};

export const sendNotificationToAll = (
  title: string,
  description: string,
  type: "default" | "destructive"
) => {
  io.emit("toastNotification", title, description, type);
};

export const updateSkipThreshold = (skipList: SocketUser[]): number => {
  return Math.ceil(skipList.length / 2);
};

export const isUserOnSkipList = (
  newUser: SocketUser,
  skipList: SocketUser[]
): boolean => {
  return skipList.some((user) => user.id === newUser.id);
};

export const removeFromSkipList = (
  userToRemove: SocketUser,
  skipList: SocketUser[]
) => {
  if (isUserOnSkipList(userToRemove, skipList)) {
    const newSkipList = skipList.filter((user) => user.id !== userToRemove.id);
    return newSkipList;
  }

  return skipList;
};
