import { SocketUser } from "src/types";

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
