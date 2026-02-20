import {
  REST,
  Routes,
  type RESTPostAPIGuildChannelJSONBody,
  type RESTPostAPIGuildRoleJSONBody,
} from 'discord.js';

export class DiscordClient {
  private rest: REST;

  constructor(token: string) {
    this.rest = new REST({ version: '10' }).setToken(token);
  }

  async getGuild(guildId: string) {
    return this.rest.get(Routes.guild(guildId));
  }

  async getGuildChannels(guildId: string) {
    return this.rest.get(Routes.guildChannels(guildId)) as Promise<any[]>;
  }

  async getGuildRoles(guildId: string) {
    return this.rest.get(Routes.guildRoles(guildId)) as Promise<any[]>;
  }

  async createCategory(guildId: string, name: string, position?: number) {
    return this.rest.post(Routes.guildChannels(guildId), {
      body: {
        name,
        type: 4, // GUILD_CATEGORY
        position,
      },
    });
  }

  async createTextChannel(
    guildId: string,
    name: string,
    parentId: string,
    options: {
      topic?: string;
      slowmode?: number;
      nsfw?: boolean;
      permissionOverwrites?: any[];
    } = {}
  ) {
    return this.rest.post(Routes.guildChannels(guildId), {
      body: {
        name,
        type: 0, // GUILD_TEXT
        parent_id: parentId,
        topic: options.topic,
        rate_limit_per_user: options.slowmode || 0,
        nsfw: options.nsfw || false,
        permission_overwrites: options.permissionOverwrites || [],
      },
    });
  }

  async createVoiceChannel(
    guildId: string,
    name: string,
    parentId: string,
    options: {
      userLimit?: number;
      bitrate?: number;
      permissionOverwrites?: any[];
    } = {}
  ) {
    return this.rest.post(Routes.guildChannels(guildId), {
      body: {
        name,
        type: 2, // GUILD_VOICE
        parent_id: parentId,
        user_limit: options.userLimit || 0,
        bitrate: options.bitrate || 64000,
        permission_overwrites: options.permissionOverwrites || [],
      },
    });
  }

  async createAnnouncementChannel(
    guildId: string,
    name: string,
    parentId: string,
    options: { topic?: string; permissionOverwrites?: any[] } = {}
  ) {
    return this.rest.post(Routes.guildChannels(guildId), {
      body: {
        name,
        type: 5, // GUILD_ANNOUNCEMENT
        parent_id: parentId,
        topic: options.topic,
        permission_overwrites: options.permissionOverwrites || [],
      },
    });
  }

  async createForumChannel(
    guildId: string,
    name: string,
    parentId: string,
    options: { topic?: string; tags?: string[]; permissionOverwrites?: any[] } = {}
  ) {
    return this.rest.post(Routes.guildChannels(guildId), {
      body: {
        name,
        type: 15, // GUILD_FORUM
        parent_id: parentId,
        topic: options.topic,
        available_tags: options.tags?.map((t) => ({ name: t })) || [],
        permission_overwrites: options.permissionOverwrites || [],
      },
    });
  }

  async createRole(guildId: string, data: RESTPostAPIGuildRoleJSONBody) {
    return this.rest.post(Routes.guildRoles(guildId), { body: data });
  }

  async sendMessage(channelId: string, content: string | object) {
    const body = typeof content === 'string' ? { content } : content;
    return this.rest.post(Routes.channelMessages(channelId), { body });
  }

  async sendEmbed(channelId: string, embed: object) {
    return this.rest.post(Routes.channelMessages(channelId), {
      body: { embeds: [embed] },
    });
  }

  async modifyGuild(guildId: string, data: object) {
    return this.rest.patch(Routes.guild(guildId), { body: data });
  }
}
