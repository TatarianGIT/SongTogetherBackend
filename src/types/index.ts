export type AuthRole = null | "basic" | "moderator" | "admin";

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
  role: AuthRole;
};

export type DatabaseVideo = {
  id: string;
  video_url: string;
  video_id: string;
  title: string;
  queue_status: string;
  length_seconds: string;
  thumbnail_url: string;
  created_at: string;
  user_id: string;
};

export type NewVideo = {
  userId: string;
  videoUrl: string;
  videoId: string;
  title: string;
  lengthSeconds: string;
  thumbnailUrl: string;
};

export type SocketUser = {
  id: string;
  discord_id: string;
  avatar: string;
  username: string;
  global_name: string;
  banner_color: string;
  role: AuthRole;
};

export type VideoDetails = {
  id: string;
  videoUrl: string;
  videoId: string;
  title: string;
  lengthSeconds: string;
  thumbnailUrl: string;
  discord_id: string;
  avatar: string;
  global_name: string;
  banner_color: string;
  createdAt: string;
} | null;

export type SongQueue =
  | {
      videoUrl: string;
      videoId: string;
      title: string;
      lengthSeconds: string;
      thumbnailUrl: string;
      discord_id: string;
      avatar: string;
      global_name: string;
      banner_color: string;
      createdAt: string;
    }[]
  | null;

export type CurrentSong = VideoDetails;
