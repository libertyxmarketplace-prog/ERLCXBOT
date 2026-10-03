export type DiscordUser = {
  id: string;
  username: string;
  globalName: string;
  avatar: string | null;
};

export type DiscordGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  hasWorkspace: boolean;
};

export type Workspace = {
  id: string;
  guildId: string;
  discordBotId: string | null;
  isInGuild: boolean | null;
  inviteUrl: string | null;
  status: 'online' | 'active' | 'unconfigured' | 'invalid_token' | 'suspended' | string;
  createdAt: string;
  updatedAt: string;
  hasDiscordToken: boolean;
  hasErlcApiKey: boolean;
  hasAiApiKey: boolean;
  customizations: Record<string, unknown>;
};

export type LiveServer = {
  state: 'connected';
  name: string | null;
  joinCode: string | null;
  currentPlayers: number | null;
  maxPlayers: number | null;
  queue: number | null;
  staffCount: number | null;
};

export type AuthState = {
  user: DiscordUser | null;
  guilds: DiscordGuild[];
  loading: boolean;
  csrfToken: string;
};