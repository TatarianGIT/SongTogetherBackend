export type SongQueue = {
  videoUrl: string;
  videoId: string;
  title: string;
  lengthSeconds: string;
  thumbnailUrl: string;
  addedBy: SocketUser;
} | null;

export type DiscordUser = {
  id: string;
  username: string;
  avatar: string;
  accent_color: number;
  global_name: string;
  banner_color: string;
  email: string;
};

export type DatabaseUser = {
  id: string;
  discord_id: string;
  username: string;
  avatar: string;
  accent_color: number;
  global_name: string;
  banner_color: string;
  email: string;
};

export type SocketUser = {
  discord_id: string;
  avatar: string;
  global_name: string;
  banner_color: string;
};
