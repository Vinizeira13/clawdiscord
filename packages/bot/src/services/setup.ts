import { REST, Routes } from 'discord.js';

// ─── TYPES ───
interface ChannelPermissions {
  everyone?: { send_messages?: boolean; view_channel?: boolean };
  staff_only?: boolean;
  role_locked?: string;
}

interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface ChannelEmbed {
  title: string;
  description?: string;
  color?: string;
  fields?: EmbedField[];
  footer?: string;
}

interface ChannelConfig {
  name: string;
  type: 'text' | 'voice' | 'stage' | 'forum' | 'announcement';
  topic?: string;
  slowmode?: number;
  nsfw?: boolean;
  user_limit?: number;
  bitrate?: number;
  permissions?: ChannelPermissions;
  embed?: ChannelEmbed;
  tags?: string[];
}

interface CategoryConfig {
  name: string;
  channels: ChannelConfig[];
}

interface RoleConfig {
  name: string;
  color: string;
  hoist: boolean;
  mentionable?: boolean;
  position: number;
  permissions?: string[];
  permissions_deny?: string[];
}

interface ServerTemplate {
  id: string;
  name: string;
  description: string;
  categories: CategoryConfig[];
  roles: RoleConfig[];
  settings?: {
    verification_level?: number;
    default_notifications?: number;
    explicit_content_filter?: number;
  };
}

// Channel type map
const ChannelTypes: Record<string, number> = {
  text: 0, voice: 2, category: 4, announcement: 5, stage: 13, forum: 15,
};

// Permission bits
const P = {
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_MESSAGES: 1n << 13n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MUTE_MEMBERS: 1n << 22n,
  ADD_REACTIONS: 1n << 6n,
  SPEAK: 1n << 21n,
  CONNECT: 1n << 20n,
  MANAGE_THREADS: 1n << 34n,
  CREATE_PUBLIC_THREADS: 1n << 35n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
} as const;

const PermMap: Record<string, bigint> = P;

interface SetupResult {
  success: boolean;
  stats: { roles: number; categories: number; channels: number; embeds: number };
  errors: string[];
  duration: number;
}

type ProgressCallback = (phase: string, current: number, total: number) => void;

export class SetupService {
  private rest: REST;
  private guildId: string;
  private template: ServerTemplate;
  private roleMap = new Map<string, string>();
  private onProgress: ProgressCallback;

  constructor(guildId: string, template: ServerTemplate, token: string, onProgress?: ProgressCallback) {
    this.rest = new REST({ version: '10' }).setToken(token);
    this.guildId = guildId;
    this.template = template;
    this.onProgress = onProgress || (() => {});
  }

  async execute(): Promise<SetupResult> {
    const start = Date.now();
    const errors: string[] = [];
    const stats = { roles: 0, categories: 0, channels: 0, embeds: 0 };
    const channelsWithEmbeds: { id: string; config: ChannelConfig }[] = [];

    // Phase 1: Roles
    const sortedRoles = [...this.template.roles].sort((a, b) => a.position - b.position);
    for (let i = 0; i < sortedRoles.length; i++) {
      const role = sortedRoles[i];
      this.onProgress('roles', i + 1, sortedRoles.length);
      try {
        const perms = this.resolvePermissions(role.permissions || []);
        const created = await this.apiPost(Routes.guildRoles(this.guildId), {
          name: role.name,
          color: parseInt(role.color.replace('#', ''), 16),
          hoist: role.hoist ?? false,
          mentionable: role.mentionable ?? false,
          permissions: perms.toString(),
        });
        this.roleMap.set(role.name, created.id);
        stats.roles++;
      } catch (e: unknown) {
        errors.push(`Role "${role.name}": ${(e as Error).message}`);
      }
    }

    // Phase 2: Categories + Channels
    let catIndex = 0;
    for (const category of this.template.categories) {
      catIndex++;
      this.onProgress('channels', catIndex, this.template.categories.length);
      try {
        const cat = await this.apiPost(Routes.guildChannels(this.guildId), {
          name: category.name,
          type: 4,
          position: catIndex - 1,
        });
        stats.categories++;

        for (const ch of category.channels) {
          try {
            const overwrites = this.buildOverwrites(ch);
            const chType = ChannelTypes[ch.type] ?? 0;
            const body: Record<string, unknown> = {
              name: ch.name,
              type: chType,
              parent_id: cat.id,
              permission_overwrites: overwrites,
            };

            if (ch.type === 'voice' || ch.type === 'stage') {
              body.user_limit = ch.user_limit ?? 0;
              body.bitrate = ch.bitrate ?? 64000;
            } else if (ch.type === 'forum') {
              body.topic = ch.topic;
              body.available_tags = ch.tags?.map(t => ({ name: t })) || [];
            } else {
              body.topic = ch.topic;
              body.rate_limit_per_user = ch.slowmode ?? 0;
              body.nsfw = ch.nsfw ?? false;
            }

            const created = await this.apiPost(Routes.guildChannels(this.guildId), body);
            stats.channels++;

            if (ch.embed) {
              channelsWithEmbeds.push({ id: created.id, config: ch });
            }
          } catch (e: unknown) {
            errors.push(`Channel "${ch.name}": ${(e as Error).message}`);
          }
        }
      } catch (e: unknown) {
        errors.push(`Category "${category.name}": ${(e as Error).message}`);
      }
    }

    // Phase 3: Embeds
    for (let i = 0; i < channelsWithEmbeds.length; i++) {
      const { id, config } = channelsWithEmbeds[i];
      this.onProgress('embeds', i + 1, channelsWithEmbeds.length);
      if (!config.embed) continue;
      try {
        const embed: Record<string, unknown> = {
          title: config.embed.title,
          color: config.embed.color ? parseInt(config.embed.color.replace('#', ''), 16) : 0x5865f2,
        };
        if (config.embed.description) embed.description = config.embed.description;
        if (config.embed.fields) embed.fields = config.embed.fields;
        if (config.embed.footer) embed.footer = { text: config.embed.footer };

        await this.apiPost(Routes.channelMessages(id), { embeds: [embed] });
        stats.embeds++;
      } catch (e: unknown) {
        errors.push(`Embed in "${config.name}": ${(e as Error).message}`);
      }
    }

    // Phase 4: Server settings
    if (this.template.settings) {
      try {
        const settings: Record<string, unknown> = {};
        if (this.template.settings.verification_level !== undefined)
          settings.verification_level = this.template.settings.verification_level;
        if (this.template.settings.default_notifications !== undefined)
          settings.default_message_notifications = this.template.settings.default_notifications;
        if (this.template.settings.explicit_content_filter !== undefined)
          settings.explicit_content_filter = this.template.settings.explicit_content_filter;
        await this.rest.patch(Routes.guild(this.guildId), { body: settings });
      } catch (e: unknown) {
        errors.push(`Settings: ${(e as Error).message}`);
      }
    }

    return {
      success: errors.length === 0,
      stats,
      errors,
      duration: Date.now() - start,
    };
  }

  // ─── PERMISSION OVERWRITES ───
  private buildOverwrites(channel: ChannelConfig): object[] {
    const overwrites: object[] = [];
    const everyoneId = this.guildId; // @everyone role ID = guild ID

    if (channel.permissions?.everyone?.send_messages === false) {
      overwrites.push({ id: everyoneId, type: 0, deny: P.SEND_MESSAGES.toString() });
    }

    if (channel.permissions?.everyone?.view_channel === false) {
      overwrites.push({ id: everyoneId, type: 0, deny: P.VIEW_CHANNEL.toString() });
    }

    if (channel.permissions?.staff_only) {
      overwrites.push({ id: everyoneId, type: 0, deny: P.VIEW_CHANNEL.toString() });
      for (const roleName of this.getStaffRoleNames()) {
        const roleId = this.roleMap.get(roleName);
        if (roleId) {
          overwrites.push({
            id: roleId, type: 0,
            allow: (P.VIEW_CHANNEL | P.SEND_MESSAGES).toString(),
          });
        }
      }
    }

    if (channel.permissions?.role_locked) {
      overwrites.push({ id: everyoneId, type: 0, deny: P.VIEW_CHANNEL.toString() });
      const roleId = this.roleMap.get(channel.permissions.role_locked);
      if (roleId) {
        overwrites.push({ id: roleId, type: 0, allow: P.VIEW_CHANNEL.toString() });
      }
      for (const staffName of this.getStaffRoleNames()) {
        const staffId = this.roleMap.get(staffName);
        if (staffId) {
          overwrites.push({ id: staffId, type: 0, allow: P.VIEW_CHANNEL.toString() });
        }
      }
    }

    return overwrites;
  }

  private getStaffRoleNames(): string[] {
    return this.template.roles
      .filter(r => r.position >= 12 || r.permissions?.includes('ADMINISTRATOR') || r.permissions?.includes('MANAGE_GUILD'))
      .map(r => r.name);
  }

  private resolvePermissions(perms: string[]): bigint {
    return perms.reduce((acc, p) => acc | (PermMap[p] || 0n), 0n);
  }

  // ─── API WRAPPER WITH RATE LIMIT HANDLING ───
  private requestCount = 0;
  private async apiPost(route: `/${string}`, body: unknown): Promise<{ id: string; [key: string]: unknown }> {
    this.requestCount++;

    // Pause every 40 requests to respect rate limits
    if (this.requestCount % 40 === 0) {
      await new Promise(r => setTimeout(r, 1000));
    } else {
      await new Promise(r => setTimeout(r, 35));
    }

    try {
      return (await this.rest.post(route, { body })) as { id: string };
    } catch (error: unknown) {
      const err = error as { status?: number; retry_after?: number; message?: string; rawError?: { message?: string } };

      // Rate limited — wait and retry once
      if (err.status === 429) {
        const wait = (err.retry_after ?? 2) * 1000;
        await new Promise(r => setTimeout(r, wait));
        return (await this.rest.post(route, { body })) as { id: string };
      }

      throw new Error(err.rawError?.message || err.message || 'Discord API error');
    }
  }
}
