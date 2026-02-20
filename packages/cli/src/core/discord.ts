import { REST, Routes } from 'discord.js';

// ─── TYPED RESPONSES ───
export interface DiscordGuild {
  id: string;
  name: string;
  owner_id: string;
  permissions?: string;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  parent_id?: string;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
}

export interface DiscordMember {
  user?: { id: string; username: string };
  roles: string[];
  permissions?: string;
}

export interface CreateChannelData {
  name: string;
  type: number;
  parent_id?: string;
  topic?: string;
  rate_limit_per_user?: number;
  nsfw?: boolean;
  user_limit?: number;
  bitrate?: number;
  permission_overwrites?: object[];
  available_tags?: { name: string }[];
}

export interface CreateRoleData {
  name: string;
  color?: number;
  hoist?: boolean;
  mentionable?: boolean;
  permissions?: string;
}

// ─── CUSTOM ERROR ───
export class DiscordApiError extends Error {
  status: number;
  code: number;

  constructor(message: string, status: number, code: number = 0) {
    super(message);
    this.name = 'DiscordApiError';
    this.status = status;
    this.code = code;
  }
}

// ─── CLIENT ───
export class DiscordClient {
  private rest: REST;
  private maxRetries = 3;

  constructor(token: string) {
    this.rest = new REST({ version: '10' }).setToken(token);
  }

  // ─── GUILD ───
  async getGuild(guildId: string): Promise<DiscordGuild> {
    return this.request<DiscordGuild>(() =>
      this.rest.get(Routes.guild(guildId))
    );
  }

  async modifyGuild(guildId: string, data: object): Promise<DiscordGuild> {
    return this.request<DiscordGuild>(() =>
      this.rest.patch(Routes.guild(guildId), { body: data })
    );
  }

  async getBotMember(guildId: string): Promise<DiscordMember | null> {
    try {
      return await this.request<DiscordMember>(() =>
        this.rest.get(Routes.guildMember(guildId, '@me'))
      );
    } catch {
      return null;
    }
  }

  // ─── CHANNELS ───
  async getGuildChannels(guildId: string): Promise<DiscordChannel[]> {
    return this.request<DiscordChannel[]>(() =>
      this.rest.get(Routes.guildChannels(guildId))
    );
  }

  async createCategory(guildId: string, name: string, position?: number): Promise<DiscordChannel> {
    return this.request<DiscordChannel>(() =>
      this.rest.post(Routes.guildChannels(guildId), {
        body: { name, type: 4, position },
      })
    );
  }

  async createChannel(guildId: string, data: CreateChannelData): Promise<DiscordChannel> {
    return this.request<DiscordChannel>(() =>
      this.rest.post(Routes.guildChannels(guildId), { body: data })
    );
  }

  async deleteChannel(channelId: string): Promise<void> {
    await this.request(() =>
      this.rest.delete(Routes.channel(channelId))
    );
  }

  // ─── ROLES ───
  async getGuildRoles(guildId: string): Promise<DiscordRole[]> {
    return this.request<DiscordRole[]>(() =>
      this.rest.get(Routes.guildRoles(guildId))
    );
  }

  async createRole(guildId: string, data: CreateRoleData): Promise<DiscordRole> {
    return this.request<DiscordRole>(() =>
      this.rest.post(Routes.guildRoles(guildId), { body: data })
    );
  }

  async deleteRole(guildId: string, roleId: string): Promise<void> {
    await this.request(() =>
      this.rest.delete(Routes.guildRole(guildId, roleId))
    );
  }

  // ─── MESSAGES ───
  async sendMessage(channelId: string, content: string | object): Promise<unknown> {
    const body = typeof content === 'string' ? { content } : content;
    return this.request(() =>
      this.rest.post(Routes.channelMessages(channelId), { body })
    );
  }

  async sendEmbed(channelId: string, embed: object): Promise<unknown> {
    return this.request(() =>
      this.rest.post(Routes.channelMessages(channelId), {
        body: { embeds: [embed] },
      })
    );
  }

  // ─── EMOJIS ───
  async createEmoji(guildId: string, name: string, imageBase64: string): Promise<unknown> {
    return this.request(() =>
      this.rest.post(Routes.guildEmojis(guildId), {
        body: { name, image: imageBase64 },
      })
    );
  }

  // ─── BOT INVITE LINK ───
  static generateInviteUrl(clientId: string, permissions: bigint = 8n): string {
    return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=bot%20applications.commands`;
  }

  // ─── REQUEST WRAPPER WITH RETRY + RATE LIMIT ───
  private async request<T>(fn: () => Promise<unknown>, retries = 0): Promise<T> {
    try {
      return (await fn()) as T;
    } catch (error: unknown) {
      const err = error as {
        status?: number;
        message?: string;
        rawError?: { code?: number; message?: string };
        retry_after?: number;
      };

      const status = err.status ?? 500;
      const code = err.rawError?.code ?? 0;
      const message = err.rawError?.message ?? err.message ?? 'Unknown error';

      // Rate limited — wait Retry-After and retry
      if (status === 429) {
        const retryAfter = (err.retry_after ?? 1) * 1000;
        if (retries < this.maxRetries) {
          await new Promise((r) => setTimeout(r, retryAfter));
          return this.request<T>(fn, retries + 1);
        }
      }

      // Server error — exponential backoff retry
      if (status >= 500 && retries < this.maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retries), 10000);
        await new Promise((r) => setTimeout(r, delay));
        return this.request<T>(fn, retries + 1);
      }

      throw new DiscordApiError(message, status, code);
    }
  }
}
