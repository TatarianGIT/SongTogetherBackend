export type User = {
  user: {
    id: string;
    username: string;
    avatar: string;
    banner: boolean;
    accent_color: number;
    global_name: string;
    banner_color: string;
    email: string;
    accessToken: string;
    fetchedAt: string;
  };
};

export type IoUserResponse = {
  passport: {
    user: {
      id: string;
      username: string;
      avatar: string;
      discriminator: string;
      public_flags: number;
      flags: number;
      banner: null | any;
      accent_color: number;
      global_name: string;
      avatar_decoration_data: null | any;
      banner_color: string;
      clan: null | any;
      mfa_enabled: boolean;
      locale: string;
      premium_type: number;
      email: string;
      verified: boolean;
      provider: string;
      accessToken: string;
      fetchedAt: string;
    };
  };
};

export type SocketUser = {
  id: string;
  global_name: string;
  avatar: string;
  banner_color: string;
};

export type SongQueue = {
  videoUrl: string;
  videoId: string;
  title: string;
  lengthSeconds: string;
  thumbnailUrl: string;
  addedBy: SocketUser;
} | null;
