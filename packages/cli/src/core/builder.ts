import { DiscordClient } from './discord.js';
import type { ServerTemplate, CategoryConfig, ChannelConfig, RoleConfig } from './template.js';
import { logger } from '../utils/logger.js';
import ora from 'ora';

interface BuildOptions {
  serverName?: string;
  languages: string[];
  includeStaff: boolean;
  includeEngagement: boolean;
}

interface BuildResult {
  categoriesCreated: number;
  channelsCreated: number;
  rolesCreated: number;
  embedsSent: number;
  errors: string[];
}

export class ServerBuilder {
  private client: DiscordClient;
  private guildId: string;
  private template: ServerTemplate;
  private options: BuildOptions;
  private roleMap: Map<string, string> = new Map(); // roleName -> roleId
  private result: BuildResult = {
    categoriesCreated: 0,
    channelsCreated: 0,
    rolesCreated: 0,
    embedsSent: 0,
    errors: [],
  };

  constructor(guildId: string, template: ServerTemplate, options: BuildOptions) {
    const token = process.env.DISCORD_TOKEN;
    if (!token) throw new Error('DISCORD_TOKEN not set');
    this.client = new DiscordClient(token);
    this.guildId = guildId;
    this.template = template;
    this.options = options;
  }

  async build(): Promise<BuildResult> {
    const spinner = ora('Starting server setup...').start();

    try {
      // Phase 1: Roles
      spinner.text = '👥 Creating roles...';
      await this.createRoles();

      // Phase 2: Categories + Channels
      spinner.text = '📁 Creating categories and channels...';
      await this.createCategories();

      // Phase 3: Embeds
      spinner.text = '📝 Sending embeds...';
      await this.sendEmbeds();

      // Phase 4: Server settings
      if (this.template.settings) {
        spinner.text = '⚙️ Applying server settings...';
        await this.applySettings();
      }

      spinner.succeed('Server setup complete!');

      // Summary
      logger.success(`\n✅ Setup Complete!`);
      logger.info(`   Categories: ${this.result.categoriesCreated}`);
      logger.info(`   Channels: ${this.result.channelsCreated}`);
      logger.info(`   Roles: ${this.result.rolesCreated}`);
      logger.info(`   Embeds: ${this.result.embedsSent}`);

      if (this.result.errors.length > 0) {
        logger.warn(`\n⚠️ ${this.result.errors.length} errors:`);
        this.result.errors.forEach((e) => logger.error(`   ${e}`));
      }

      return this.result;
    } catch (error: any) {
      spinner.fail('Setup failed');
      logger.error(error.message);
      throw error;
    }
  }

  private async createRoles(): Promise<void> {
    // Create roles in reverse order (lowest position first)
    const sortedRoles = [...this.template.roles].sort((a, b) => a.position - b.position);

    for (const role of sortedRoles) {
      try {
        const permissions = this.resolvePermissions(role.permissions || []);
        const result = (await this.client.createRole(this.guildId, {
          name: role.name,
          color: parseInt(role.color.replace('#', ''), 16),
          hoist: role.hoist,
          mentionable: role.mentionable ?? false,
          permissions: permissions.toString(),
        })) as any;

        this.roleMap.set(role.name, result.id);
        this.result.rolesCreated++;
        await this.rateLimit();
      } catch (error: any) {
        this.result.errors.push(`Role "${role.name}": ${error.message}`);
      }
    }
  }

  private async createCategories(): Promise<void> {
    let position = 0;

    for (const category of this.template.categories) {
      // Skip staff if not included
      if (!this.options.includeStaff && category.name.toLowerCase().includes('staff')) {
        continue;
      }

      try {
        const cat = (await this.client.createCategory(
          this.guildId,
          category.name,
          position++
        )) as any;
        this.result.categoriesCreated++;

        // Create channels in this category
        for (const channel of category.channels) {
          await this.createChannel(channel, cat.id, category);
          await this.rateLimit();
        }
      } catch (error: any) {
        this.result.errors.push(`Category "${category.name}": ${error.message}`);
      }
    }
  }

  private async createChannel(
    channel: ChannelConfig,
    categoryId: string,
    _category: CategoryConfig
  ): Promise<void> {
    try {
      const overwrites = this.buildPermissionOverwrites(channel);

      let result: any;

      switch (channel.type) {
        case 'voice':
          result = await this.client.createVoiceChannel(this.guildId, channel.name, categoryId, {
            userLimit: channel.user_limit,
            bitrate: channel.bitrate,
            permissionOverwrites: overwrites,
          });
          break;
        case 'announcement':
          result = await this.client.createAnnouncementChannel(this.guildId, channel.name, categoryId, {
            topic: channel.topic,
            permissionOverwrites: overwrites,
          });
          break;
        case 'forum':
          result = await this.client.createForumChannel(this.guildId, channel.name, categoryId, {
            topic: channel.topic,
            tags: channel.tags,
            permissionOverwrites: overwrites,
          });
          break;
        default:
          result = await this.client.createTextChannel(this.guildId, channel.name, categoryId, {
            topic: channel.topic,
            slowmode: channel.slowmode,
            nsfw: channel.nsfw,
            permissionOverwrites: overwrites,
          });
      }

      this.result.channelsCreated++;

      // Store channel ID for embed sending
      if (channel.embed) {
        (channel as any)._createdId = result.id;
      }
    } catch (error: any) {
      this.result.errors.push(`Channel "${channel.name}": ${error.message}`);
    }
  }

  private async sendEmbeds(): Promise<void> {
    for (const category of this.template.categories) {
      for (const channel of category.channels) {
        if (channel.embed && (channel as any)._createdId) {
          try {
            const embed = {
              title: channel.embed.title,
              description: channel.embed.description,
              color: channel.embed.color
                ? parseInt(channel.embed.color.replace('#', ''), 16)
                : 0x5865f2,
              fields: channel.embed.fields,
              footer: channel.embed.footer ? { text: channel.embed.footer } : undefined,
            };

            await this.client.sendEmbed((channel as any)._createdId, embed);
            this.result.embedsSent++;
            await this.rateLimit();
          } catch (error: any) {
            this.result.errors.push(`Embed "${channel.name}": ${error.message}`);
          }
        }
      }
    }
  }

  private async applySettings(): Promise<void> {
    try {
      const settings: any = {};
      if (this.template.settings?.verification_level !== undefined) {
        settings.verification_level = this.template.settings.verification_level;
      }
      if (this.template.settings?.default_notifications !== undefined) {
        settings.default_message_notifications = this.template.settings.default_notifications;
      }
      if (this.template.settings?.explicit_content_filter !== undefined) {
        settings.explicit_content_filter = this.template.settings.explicit_content_filter;
      }
      await this.client.modifyGuild(this.guildId, settings);
    } catch (error: any) {
      this.result.errors.push(`Settings: ${error.message}`);
    }
  }

  private buildPermissionOverwrites(channel: ChannelConfig): any[] {
    const overwrites: any[] = [];
    const everyoneId = this.guildId; // @everyone role ID = guild ID

    if (channel.permissions?.everyone?.send_messages === false) {
      overwrites.push({
        id: everyoneId,
        type: 0, // role
        deny: (1n << 11n).toString(), // SEND_MESSAGES
      });
    }

    if (channel.permissions?.staff_only) {
      // Deny everyone view
      overwrites.push({
        id: everyoneId,
        type: 0,
        deny: (1n << 10n).toString(), // VIEW_CHANNEL
      });

      // Allow staff roles
      for (const roleName of ['Owner', 'Admin', 'Moderator']) {
        const roleId = this.roleMap.get(roleName);
        if (roleId) {
          overwrites.push({
            id: roleId,
            type: 0,
            allow: (1n << 10n).toString(), // VIEW_CHANNEL
          });
        }
      }
    }

    return overwrites;
  }

  private resolvePermissions(perms: string[]): bigint {
    const permMap: Record<string, bigint> = {
      ADMINISTRATOR: 1n << 3n,
      MANAGE_GUILD: 1n << 5n,
      MANAGE_ROLES: 1n << 28n,
      MANAGE_CHANNELS: 1n << 4n,
      BAN_MEMBERS: 1n << 2n,
      KICK_MEMBERS: 1n << 1n,
      MANAGE_MESSAGES: 1n << 13n,
      MUTE_MEMBERS: 1n << 22n,
      SEND_MESSAGES: 1n << 11n,
      VIEW_CHANNEL: 1n << 10n,
      SPEAK: 1n << 21n,
      CONNECT: 1n << 20n,
    };

    return perms.reduce((acc, p) => acc | (permMap[p] || 0n), 0n);
  }

  private rateLimit(): Promise<void> {
    // Discord rate limit: ~50 req/s, we go conservative at 25/s
    return new Promise((resolve) => setTimeout(resolve, 40));
  }
}
