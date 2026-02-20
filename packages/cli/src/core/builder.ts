import { DiscordClient, DiscordApiError } from './discord.js';
import type { ServerTemplate, CategoryConfig, ChannelConfig } from './template.js';
import { logger } from '../utils/logger.js';
import ora from 'ora';

// Discord Permission Flags (bigint)
const PermissionFlags = {
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  ADD_REACTIONS: 1n << 6n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  MENTION_EVERYONE: 1n << 17n,
  USE_EXTERNAL_EMOJIS: 1n << 18n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_THREADS: 1n << 34n,
  CREATE_PUBLIC_THREADS: 1n << 35n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
} as const;

// Discord Channel Types
const ChannelTypes = {
  text: 0,
  voice: 2,
  category: 4,
  announcement: 5,
  stage: 13,
  forum: 15,
} as const;

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
  duration: number;
}

interface ChannelCreated {
  channelId: string;
  channelConfig: ChannelConfig;
}

export class ServerBuilder {
  private client: DiscordClient;
  private guildId: string;
  private template: ServerTemplate;
  private options: BuildOptions;
  private roleMap: Map<string, string> = new Map();
  private channelsWithEmbeds: ChannelCreated[] = [];
  private result: BuildResult = {
    categoriesCreated: 0,
    channelsCreated: 0,
    rolesCreated: 0,
    embedsSent: 0,
    errors: [],
    duration: 0,
  };

  constructor(guildId: string, template: ServerTemplate, options: BuildOptions) {
    const token = process.env.DISCORD_TOKEN;
    if (!token) {
      throw new Error('DISCORD_TOKEN not set. Export it or add to .env file.');
    }
    this.client = new DiscordClient(token);
    this.guildId = guildId;
    this.template = template;
    this.options = options;
  }

  // ─── PREFLIGHT: verify everything before touching Discord ───
  async preflight(): Promise<{ ok: boolean; errors: string[] }> {
    const errors: string[] = [];

    // 1. Verify guild exists and bot has access
    try {
      const guild = await this.client.getGuild(this.guildId);
      if (!guild) {
        errors.push('Guild not found. Check the server ID and make sure the bot is invited.');
      }
    } catch (e: unknown) {
      if (e instanceof DiscordApiError) {
        if (e.status === 403) {
          errors.push('Bot does not have access to this guild. Invite the bot first.');
        } else if (e.status === 404) {
          errors.push('Guild not found. Check the server ID.');
        } else {
          errors.push(`Cannot reach guild: ${e.message}`);
        }
      } else {
        errors.push(`Cannot reach guild: ${(e as Error).message}`);
      }
    }

    // 2. Verify bot permissions
    try {
      const botMember = await this.client.getBotMember(this.guildId);
      if (botMember) {
        const perms = BigInt(botMember.permissions || '0');
        const required = PermissionFlags.MANAGE_CHANNELS | PermissionFlags.MANAGE_ROLES | PermissionFlags.MANAGE_GUILD;
        if ((perms & required) !== required && (perms & PermissionFlags.ADMINISTRATOR) === 0n) {
          errors.push('Bot needs MANAGE_CHANNELS, MANAGE_ROLES, and MANAGE_GUILD permissions.');
        }
      }
    } catch {
      // Non-fatal — some bots can't read their own member
    }

    // 3. Validate template
    if (!this.template.categories || this.template.categories.length === 0) {
      errors.push('Template has no categories.');
    }
    if (!this.template.roles || this.template.roles.length === 0) {
      errors.push('Template has no roles.');
    }

    // 4. Check staff roles exist in template if staff channels enabled
    if (this.options.includeStaff) {
      const staffRoleNames = this.getStaffRoleNames();
      if (staffRoleNames.length === 0) {
        errors.push('Template has staff channels but no staff roles (position >= 12).');
      }
    }

    return { ok: errors.length === 0, errors };
  }

  // ─── MAIN BUILD ───
  async build(): Promise<BuildResult> {
    const startTime = Date.now();
    const spinner = ora('Running preflight checks...').start();

    // Preflight
    const preflight = await this.preflight();
    if (!preflight.ok) {
      spinner.fail('Preflight failed');
      for (const err of preflight.errors) {
        logger.error(`  ✗ ${err}`);
      }
      throw new Error('Preflight checks failed. Fix the issues above and retry.');
    }
    spinner.succeed('Preflight passed');

    // Phase 1: Roles
    const roleSpinner = ora(`Creating ${this.template.roles.length} roles...`).start();
    await this.createRoles();
    roleSpinner.succeed(`Created ${this.result.rolesCreated} roles`);

    // Phase 2: Categories + Channels
    const totalChannels = this.template.categories.reduce(
      (acc, c) => acc + c.channels.length, 0
    );
    const channelSpinner = ora(`Creating ${this.template.categories.length} categories, ${totalChannels} channels...`).start();
    await this.createCategories();
    channelSpinner.succeed(`Created ${this.result.categoriesCreated} categories, ${this.result.channelsCreated} channels`);

    // Phase 3: Embeds
    if (this.channelsWithEmbeds.length > 0) {
      const embedSpinner = ora(`Sending ${this.channelsWithEmbeds.length} embeds...`).start();
      await this.sendEmbeds();
      embedSpinner.succeed(`Sent ${this.result.embedsSent} embeds`);
    }

    // Phase 4: Server settings
    if (this.template.settings) {
      const settingsSpinner = ora('Applying server settings...').start();
      await this.applySettings();
      settingsSpinner.succeed('Server settings applied');
    }

    this.result.duration = Date.now() - startTime;

    // Summary
    logger.success(`\n✅ Setup Complete in ${(this.result.duration / 1000).toFixed(1)}s!`);
    logger.info(`   📁 Categories: ${this.result.categoriesCreated}`);
    logger.info(`   💬 Channels:   ${this.result.channelsCreated}`);
    logger.info(`   👥 Roles:      ${this.result.rolesCreated}`);
    logger.info(`   📝 Embeds:     ${this.result.embedsSent}`);

    if (this.result.errors.length > 0) {
      logger.warn(`\n⚠️ ${this.result.errors.length} non-fatal errors:`);
      for (const e of this.result.errors) {
        logger.error(`   • ${e}`);
      }
    }

    return this.result;
  }

  // ─── DRY RUN ───
  dryRun(): void {
    logger.info('\n📋 Dry Run — Preview of changes:\n');

    // Categories + Channels
    let totalChannels = 0;
    for (const category of this.template.categories) {
      if (!this.options.includeStaff && this.isStaffCategory(category)) {
        logger.dim(`  📁 ${category.name} (skipped — staff disabled)`);
        continue;
      }
      if (!this.options.includeEngagement && this.isEngagementCategory(category)) {
        logger.dim(`  📁 ${category.name} (skipped — engagement disabled)`);
        continue;
      }

      logger.info(`  📁 ${category.name}`);
      for (const ch of category.channels) {
        totalChannels++;
        const icon = ch.type === 'voice' ? '🔊' : ch.type === 'forum' ? '💬' : ch.type === 'announcement' ? '📢' : '#';
        const flags: string[] = [];
        if (ch.slowmode) flags.push(`slowmode:${ch.slowmode}s`);
        if (ch.user_limit) flags.push(`limit:${ch.user_limit}`);
        if (ch.permissions?.staff_only) flags.push('🔒staff');
        if (ch.permissions?.everyone?.send_messages === false) flags.push('📖read-only');
        if (ch.permissions?.role_locked) flags.push(`🔐${ch.permissions.role_locked}`);
        if (ch.embed) flags.push('📝embed');
        const flagStr = flags.length ? ` (${flags.join(', ')})` : '';
        logger.info(`    ${icon} ${ch.name}${flagStr}`);
      }
    }

    // Roles
    logger.info(`\n  👥 Roles (${this.template.roles.length}):`);
    for (const role of this.template.roles.sort((a, b) => b.position - a.position)) {
      const perms = role.permissions?.join(', ') || 'none';
      logger.info(`    ${role.hoist ? '🏷️' : '  '} ${role.name} — ${role.color} [${perms}]`);
    }

    // Summary
    const activeCategories = this.template.categories.filter(
      (c) => (this.options.includeStaff || !this.isStaffCategory(c)) &&
             (this.options.includeEngagement || !this.isEngagementCategory(c))
    );
    logger.info(`\n  📊 Will create: ${activeCategories.length} categories, ${totalChannels} channels, ${this.template.roles.length} roles`);
    logger.info(`  ⏱️  Estimated time: ~${Math.ceil((totalChannels + this.template.roles.length) * 0.05)}s`);
    logger.info(`  🔌 API calls: ~${totalChannels + this.template.roles.length + activeCategories.length + this.template.categories.reduce((a, c) => a + c.channels.filter(ch => ch.embed).length, 0)}`);
  }

  // ─── ROLES ───
  private async createRoles(): Promise<void> {
    const sortedRoles = [...this.template.roles].sort((a, b) => a.position - b.position);

    for (const role of sortedRoles) {
      try {
        const permissions = this.resolvePermissions(role.permissions || []);
        const colorInt = this.parseColor(role.color);

        const result = await this.client.createRole(this.guildId, {
          name: role.name,
          color: colorInt,
          hoist: role.hoist ?? false,
          mentionable: role.mentionable ?? false,
          permissions: permissions.toString(),
        });

        this.roleMap.set(role.name, result.id);
        this.result.rolesCreated++;
        await this.smartDelay();
      } catch (error: unknown) {
        const err = error as Error;
        if (this.isFatalError(err)) throw err;
        this.result.errors.push(`Role "${role.name}": ${err.message}`);
      }
    }
  }

  // ─── CATEGORIES + CHANNELS ───
  private async createCategories(): Promise<void> {
    let position = 0;

    for (const category of this.template.categories) {
      if (!this.options.includeStaff && this.isStaffCategory(category)) continue;
      if (!this.options.includeEngagement && this.isEngagementCategory(category)) continue;

      try {
        const cat = await this.client.createCategory(this.guildId, category.name, position++);
        this.result.categoriesCreated++;

        for (const channel of category.channels) {
          await this.createChannel(channel, cat.id, category);
          await this.smartDelay();
        }
      } catch (error: unknown) {
        const err = error as Error;
        if (this.isFatalError(err)) throw err;
        this.result.errors.push(`Category "${category.name}": ${err.message}`);
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
      const channelType = ChannelTypes[channel.type] ?? ChannelTypes.text;

      let result: { id: string };

      if (channel.type === 'voice' || channel.type === 'stage') {
        result = await this.client.createChannel(this.guildId, {
          name: channel.name,
          type: channelType,
          parent_id: categoryId,
          user_limit: channel.user_limit ?? 0,
          bitrate: channel.bitrate ?? 64000,
          permission_overwrites: overwrites,
        });
      } else if (channel.type === 'forum') {
        result = await this.client.createChannel(this.guildId, {
          name: channel.name,
          type: channelType,
          parent_id: categoryId,
          topic: channel.topic,
          available_tags: channel.tags?.map((t) => ({ name: t })) || [],
          permission_overwrites: overwrites,
        });
      } else {
        result = await this.client.createChannel(this.guildId, {
          name: channel.name,
          type: channelType,
          parent_id: categoryId,
          topic: channel.topic,
          rate_limit_per_user: channel.slowmode ?? 0,
          nsfw: channel.nsfw ?? false,
          permission_overwrites: overwrites,
        });
      }

      this.result.channelsCreated++;

      if (channel.embed) {
        this.channelsWithEmbeds.push({ channelId: result.id, channelConfig: channel });
      }
    } catch (error: unknown) {
      const err = error as Error;
      if (this.isFatalError(err)) throw err;
      this.result.errors.push(`Channel "${channel.name}": ${err.message}`);
    }
  }

  // ─── EMBEDS ───
  private async sendEmbeds(): Promise<void> {
    for (const { channelId, channelConfig } of this.channelsWithEmbeds) {
      if (!channelConfig.embed) continue;
      try {
        const embed: Record<string, unknown> = {
          title: this.applyVariables(channelConfig.embed.title),
          color: channelConfig.embed.color
            ? this.parseColor(channelConfig.embed.color)
            : 0x5865f2,
        };

        if (channelConfig.embed.description) {
          embed.description = this.applyVariables(channelConfig.embed.description);
        }
        if (channelConfig.embed.fields) {
          embed.fields = channelConfig.embed.fields.map((f) => ({
            name: this.applyVariables(f.name),
            value: this.applyVariables(f.value),
            inline: f.inline ?? false,
          }));
        }
        if (channelConfig.embed.footer) {
          embed.footer = { text: this.applyVariables(channelConfig.embed.footer) };
        }
        if (channelConfig.embed.thumbnail) {
          embed.thumbnail = { url: channelConfig.embed.thumbnail };
        }
        if (channelConfig.embed.image) {
          embed.image = { url: channelConfig.embed.image };
        }

        await this.client.sendEmbed(channelId, embed);
        this.result.embedsSent++;
        await this.smartDelay();
      } catch (error: unknown) {
        this.result.errors.push(`Embed in "${channelConfig.name}": ${(error as Error).message}`);
      }
    }
  }

  // ─── SETTINGS ───
  private async applySettings(): Promise<void> {
    try {
      const settings: Record<string, unknown> = {};
      if (this.template.settings?.verification_level !== undefined) {
        settings.verification_level = this.template.settings.verification_level;
      }
      if (this.template.settings?.default_notifications !== undefined) {
        settings.default_message_notifications = this.template.settings.default_notifications;
      }
      if (this.template.settings?.explicit_content_filter !== undefined) {
        settings.explicit_content_filter = this.template.settings.explicit_content_filter;
      }
      if (this.options.serverName) {
        settings.name = this.options.serverName;
      }
      await this.client.modifyGuild(this.guildId, settings);
    } catch (error: unknown) {
      this.result.errors.push(`Settings: ${(error as Error).message}`);
    }
  }

  // ─── PERMISSION OVERWRITES (DYNAMIC) ───
  private buildPermissionOverwrites(channel: ChannelConfig): object[] {
    const overwrites: object[] = [];
    const everyoneId = this.guildId;

    if (channel.permissions?.everyone?.send_messages === false) {
      overwrites.push({
        id: everyoneId,
        type: 0,
        deny: PermissionFlags.SEND_MESSAGES.toString(),
      });
    }

    if (channel.permissions?.everyone?.view_channel === false) {
      overwrites.push({
        id: everyoneId,
        type: 0,
        deny: PermissionFlags.VIEW_CHANNEL.toString(),
      });
    }

    if (channel.permissions?.staff_only) {
      overwrites.push({
        id: everyoneId,
        type: 0,
        deny: PermissionFlags.VIEW_CHANNEL.toString(),
      });

      const staffRoleNames = this.getStaffRoleNames();
      for (const roleName of staffRoleNames) {
        const roleId = this.roleMap.get(roleName);
        if (roleId) {
          overwrites.push({
            id: roleId,
            type: 0,
            allow: (PermissionFlags.VIEW_CHANNEL | PermissionFlags.SEND_MESSAGES).toString(),
          });
        }
      }
    }

    if (channel.permissions?.role_locked) {
      const roleName = channel.permissions.role_locked;
      const roleId = this.roleMap.get(roleName);

      overwrites.push({
        id: everyoneId,
        type: 0,
        deny: PermissionFlags.VIEW_CHANNEL.toString(),
      });

      if (roleId) {
        overwrites.push({
          id: roleId,
          type: 0,
          allow: PermissionFlags.VIEW_CHANNEL.toString(),
        });
      }

      // Staff also gets access to role-locked channels
      for (const staffName of this.getStaffRoleNames()) {
        const staffId = this.roleMap.get(staffName);
        if (staffId) {
          overwrites.push({
            id: staffId,
            type: 0,
            allow: PermissionFlags.VIEW_CHANNEL.toString(),
          });
        }
      }
    }

    return overwrites;
  }

  // ─── HELPERS ───

  /** Staff roles = position >= 12 OR has ADMINISTRATOR/MANAGE_GUILD */
  private getStaffRoleNames(): string[] {
    return this.template.roles
      .filter((r) => {
        const isHighPosition = r.position >= 12;
        const isAdmin = r.permissions?.includes('ADMINISTRATOR') || r.permissions?.includes('MANAGE_GUILD');
        return isHighPosition || isAdmin;
      })
      .map((r) => r.name);
  }

  private isStaffCategory(category: CategoryConfig): boolean {
    const name = category.name.toLowerCase();
    return name.includes('staff') || name.includes('admin') || name.includes('mod-only');
  }

  private isEngagementCategory(category: CategoryConfig): boolean {
    const name = category.name.toLowerCase();
    return name.includes('engagement') || name.includes('fun') || name.includes('activity');
  }

  private parseColor(color: string): number {
    return parseInt(color.replace('#', ''), 16);
  }

  private applyVariables(text: string): string {
    return text
      .replace(/\{\{server_name\}\}/g, this.options.serverName || this.template.name)
      .replace(/\{\{template_name\}\}/g, this.template.name);
  }

  private resolvePermissions(perms: string[]): bigint {
    return perms.reduce((acc, p) => {
      const flag = PermissionFlags[p as keyof typeof PermissionFlags];
      return flag ? acc | flag : acc;
    }, 0n);
  }

  private isFatalError(err: unknown): boolean {
    if (err instanceof DiscordApiError) {
      if (err.status === 401) return true;
      if (err.status === 403 && err.message.includes('Missing Access')) return true;
    }
    return false;
  }

  private lastRequestTime = 0;
  private requestCount = 0;
  private async smartDelay(): Promise<void> {
    this.requestCount++;
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const minDelay = 35;

    if (this.requestCount % 40 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } else if (elapsed < minDelay) {
      await new Promise((resolve) => setTimeout(resolve, minDelay - elapsed));
    }

    this.lastRequestTime = Date.now();
  }
}
