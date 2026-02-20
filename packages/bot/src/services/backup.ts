/**
 * ClawDiscord Server Backup & Restore
 *
 * Exports a complete server structure as a ClawDiscord template JSON.
 * Can then be used to restore/clone to another server.
 */

import { REST, Routes } from 'discord.js';
import type { ServerTemplate } from './setup.js';

interface DiscordChannelRaw {
  id: string;
  name: string;
  type: number;
  topic?: string | null;
  nsfw?: boolean;
  rate_limit_per_user?: number;
  user_limit?: number;
  bitrate?: number;
  parent_id?: string | null;
  position: number;
  permission_overwrites?: Array<{
    id: string;
    type: number;
    allow: string;
    deny: string;
  }>;
}

interface DiscordRoleRaw {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  position: number;
  permissions: string;
  managed: boolean;
}

interface DiscordGuildRaw {
  id: string;
  name: string;
  description?: string;
  verification_level: number;
  default_message_notifications: number;
  explicit_content_filter: number;
}

const TypeMap: Record<number, string> = {
  0: 'text', 2: 'voice', 4: 'category', 5: 'announcement', 13: 'stage', 15: 'forum',
};

const PermissionNames: Record<string, bigint> = {
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_MESSAGES: 1n << 13n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADD_REACTIONS: 1n << 6n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  MANAGE_THREADS: 1n << 34n,
  CREATE_PUBLIC_THREADS: 1n << 35n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
};

export class BackupService {
  private rest: REST;
  private guildId: string;

  constructor(guildId: string, token: string) {
    this.rest = new REST({ version: '10' }).setToken(token);
    this.guildId = guildId;
  }

  /**
   * Create a full backup of the server as a ClawDiscord template
   */
  async backup(): Promise<{ template: ServerTemplate; stats: { categories: number; channels: number; roles: number } }> {
    // Fetch all data in parallel
    const [guild, channels, roles] = await Promise.all([
      this.rest.get(Routes.guild(this.guildId)) as Promise<DiscordGuildRaw>,
      this.rest.get(Routes.guildChannels(this.guildId)) as Promise<DiscordChannelRaw[]>,
      this.rest.get(Routes.guildRoles(this.guildId)) as Promise<DiscordRoleRaw[]>,
    ]);

    // Build role map for permission resolution
    const roleMap = new Map<string, string>();
    for (const r of roles) {
      roleMap.set(r.id, r.name);
    }

    // Group channels by category
    const categories = channels.filter(c => c.type === 4).sort((a, b) => a.position - b.position);
    const nonCatChannels = channels.filter(c => c.type !== 4);

    // Map channels to their parent category
    const categoryChannels = new Map<string, DiscordChannelRaw[]>();
    const orphanChannels: DiscordChannelRaw[] = [];

    for (const ch of nonCatChannels) {
      if (ch.parent_id) {
        const existing = categoryChannels.get(ch.parent_id) || [];
        existing.push(ch);
        categoryChannels.set(ch.parent_id, existing);
      } else {
        orphanChannels.push(ch);
      }
    }

    // Build template categories
    const templateCategories = categories.map(cat => ({
      name: cat.name.toUpperCase(),
      channels: (categoryChannels.get(cat.id) || [])
        .sort((a, b) => a.position - b.position)
        .map(ch => this.mapChannel(ch, roleMap)),
    }));

    // Add orphan channels as "UNCATEGORIZED"
    if (orphanChannels.length > 0) {
      templateCategories.unshift({
        name: 'GENERAL',
        channels: orphanChannels
          .sort((a, b) => a.position - b.position)
          .map(ch => this.mapChannel(ch, roleMap)),
      });
    }

    // Build roles (skip @everyone and managed)
    const templateRoles = roles
      .filter(r => r.id !== this.guildId && !r.managed)
      .sort((a, b) => a.position - b.position)
      .map(r => ({
        name: r.name,
        color: `#${r.color.toString(16).padStart(6, '0')}`,
        hoist: r.hoist,
        mentionable: r.mentionable,
        position: r.position,
        permissions: this.resolvePermissionNames(BigInt(r.permissions)),
      }));

    const template: ServerTemplate = {
      id: `backup-${guild.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}`,
      name: `${guild.name} (Backup)`,
      description: guild.description || `Backup of ${guild.name} server`,
      categories: templateCategories as unknown as ServerTemplate['categories'],
      roles: templateRoles as unknown as ServerTemplate['roles'],
      settings: {
        verification_level: guild.verification_level,
        default_notifications: guild.default_message_notifications,
        explicit_content_filter: guild.explicit_content_filter,
      },
    };

    const totalChannels = templateCategories.reduce((acc, c) => acc + c.channels.length, 0);

    return {
      template,
      stats: {
        categories: templateCategories.length,
        channels: totalChannels,
        roles: templateRoles.length,
      },
    };
  }

  private mapChannel(ch: DiscordChannelRaw, roleMap: Map<string, string>): Record<string, unknown> {
    const type = TypeMap[ch.type] || 'text';
    const result: Record<string, unknown> = {
      name: ch.name,
      type,
    };

    if (ch.topic) result.topic = ch.topic;
    if (ch.nsfw) result.nsfw = true;
    if (ch.rate_limit_per_user && ch.rate_limit_per_user > 0) result.slowmode = ch.rate_limit_per_user;
    if (type === 'voice' || type === 'stage') {
      if (ch.user_limit) result.user_limit = ch.user_limit;
      if (ch.bitrate) result.bitrate = ch.bitrate;
    }

    // Map permission overwrites
    if (ch.permission_overwrites && ch.permission_overwrites.length > 0) {
      const perms: Record<string, unknown> = {};

      for (const ow of ch.permission_overwrites) {
        const deny = BigInt(ow.deny);
        const roleName = roleMap.get(ow.id);

        if (ow.id === this.guildId) {
          // @everyone overwrites
          const everyone: Record<string, boolean> = {};
          if (deny & (1n << 11n)) everyone.send_messages = false;
          if (deny & (1n << 10n)) everyone.view_channel = false;
          if (Object.keys(everyone).length > 0) perms.everyone = everyone;
        } else if (roleName) {
          const allow = BigInt(ow.allow);
          if ((deny & (1n << 10n)) && !perms.staff_only) {
            // Channel hidden from this role — could be staff_only pattern
          }
          if (allow & (1n << 10n)) {
            perms.role_locked = roleName;
          }
        }
      }

      if (Object.keys(perms).length > 0) result.permissions = perms;
    }

    return result;
  }

  private resolvePermissionNames(bits: bigint): string[] {
    const names: string[] = [];
    for (const [name, bit] of Object.entries(PermissionNames)) {
      if (bits & bit) names.push(name);
    }
    return names;
  }
}
