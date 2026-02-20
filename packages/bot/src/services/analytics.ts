/**
 * ClawDiscord Analytics Service
 *
 * Provides server health metrics and insights.
 * Can analyze channel activity, role distribution, and member engagement.
 */

import { REST, Routes } from 'discord.js';

interface ServerAnalytics {
  server: {
    name: string;
    memberCount: number;
    onlineCount?: number;
    boostLevel: number;
    boostCount: number;
    createdAt: string;
    ageInDays: number;
  };
  channels: {
    total: number;
    text: number;
    voice: number;
    forum: number;
    announcement: number;
    stage: number;
    categories: number;
    emptyCategories: string[];
  };
  roles: {
    total: number;
    managed: number;  // bot roles
    hoisted: number;
    coloredCount: number;
    withPermissions: { admin: number; moderator: number; basic: number };
  };
  health: {
    score: number;  // 0-100
    issues: string[];
    recommendations: string[];
  };
}

export class AnalyticsService {
  private rest: REST;
  private guildId: string;

  constructor(guildId: string, token: string) {
    this.rest = new REST({ version: '10' }).setToken(token);
    this.guildId = guildId;
  }

  async analyze(): Promise<ServerAnalytics> {
    const [guild, channels, roles] = await Promise.all([
      this.rest.get(`/guilds/${this.guildId}?with_counts=true` as `/${string}`) as Promise<{
        name: string;
        approximate_member_count: number;
        approximate_presence_count: number;
        premium_tier: number;
        premium_subscription_count: number;
        id: string;
      }>,
      this.rest.get(Routes.guildChannels(this.guildId)) as Promise<Array<{
        id: string;
        name: string;
        type: number;
        parent_id?: string;
      }>>,
      this.rest.get(Routes.guildRoles(this.guildId)) as Promise<Array<{
        id: string;
        name: string;
        color: number;
        hoist: boolean;
        managed: boolean;
        permissions: string;
      }>>,
    ]);

    // Channel analysis
    const categories = channels.filter(c => c.type === 4);
    const textChannels = channels.filter(c => c.type === 0);
    const voiceChannels = channels.filter(c => c.type === 2);
    const forumChannels = channels.filter(c => c.type === 15);
    const announcements = channels.filter(c => c.type === 5);
    const stages = channels.filter(c => c.type === 13);

    // Find empty categories
    const catWithChildren = new Set(channels.filter(c => c.parent_id).map(c => c.parent_id));
    const emptyCategories = categories.filter(c => !catWithChildren.has(c.id)).map(c => c.name);

    // Role analysis
    const managedRoles = roles.filter(r => r.managed);
    const hoistedRoles = roles.filter(r => r.hoist);
    const coloredRoles = roles.filter(r => r.color > 0);
    const ADMIN_BIT = 1n << 3n;
    const MOD_BITS = (1n << 1n) | (1n << 2n) | (1n << 13n); // kick, ban, manage messages
    const adminRoles = roles.filter(r => BigInt(r.permissions) & ADMIN_BIT);
    const modRoles = roles.filter(r => !r.managed && !(BigInt(r.permissions) & ADMIN_BIT) && (BigInt(r.permissions) & MOD_BITS));

    // Health score
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Check for common issues
    if (emptyCategories.length > 0) {
      issues.push(`${emptyCategories.length} empty categories: ${emptyCategories.join(', ')}`);
      score -= emptyCategories.length * 3;
    }

    if (categories.length === 0) {
      issues.push('No categories — channels are unorganized');
      score -= 20;
    }

    if (announcements.length === 0) {
      recommendations.push('Add an announcement channel for important updates');
      score -= 5;
    }

    if (forumChannels.length === 0 && guild.approximate_member_count > 50) {
      recommendations.push('Add forum channels for organized discussions (great for support/feedback)');
      score -= 5;
    }

    if (voiceChannels.length === 0) {
      recommendations.push('Add voice channels for real-time community interaction');
      score -= 10;
    }

    if (adminRoles.length > 3) {
      issues.push(`${adminRoles.length} roles with Administrator — too many admin roles increases security risk`);
      score -= 10;
    }

    if (hoistedRoles.length > 10) {
      issues.push(`${hoistedRoles.length} hoisted roles — sidebar might look cluttered`);
      score -= 5;
    }

    if (textChannels.length > 50) {
      issues.push(`${textChannels.length} text channels — too many channels can overwhelm members`);
      score -= 10;
    }

    if (textChannels.length < 3) {
      issues.push('Very few text channels — members need places to talk');
      score -= 15;
    }

    if (!channels.some(c => c.name.includes('rules') || c.name.includes('info') || c.name.includes('welcome'))) {
      issues.push('No rules/welcome/info channel found');
      score -= 15;
      recommendations.push('Add a rules channel — required for Community servers');
    }

    if (!channels.some(c => c.name.includes('staff') || c.name.includes('admin') || c.name.includes('mod'))) {
      recommendations.push('Add a staff-only channel for moderation coordination');
      score -= 5;
    }

    // Guild age
    const guildSnowflake = BigInt(guild.id);
    const createdTimestamp = Number((guildSnowflake >> 22n) + 1420070400000n);
    const createdAt = new Date(createdTimestamp);
    const ageInDays = Math.floor((Date.now() - createdTimestamp) / 86400000);

    return {
      server: {
        name: guild.name,
        memberCount: guild.approximate_member_count,
        onlineCount: guild.approximate_presence_count,
        boostLevel: guild.premium_tier,
        boostCount: guild.premium_subscription_count,
        createdAt: createdAt.toISOString().split('T')[0],
        ageInDays,
      },
      channels: {
        total: channels.length,
        text: textChannels.length,
        voice: voiceChannels.length,
        forum: forumChannels.length,
        announcement: announcements.length,
        stage: stages.length,
        categories: categories.length,
        emptyCategories,
      },
      roles: {
        total: roles.length,
        managed: managedRoles.length,
        hoisted: hoistedRoles.length,
        coloredCount: coloredRoles.length,
        withPermissions: {
          admin: adminRoles.length,
          moderator: modRoles.length,
          basic: roles.length - adminRoles.length - modRoles.length - managedRoles.length,
        },
      },
      health: {
        score: Math.max(0, Math.min(100, score)),
        issues,
        recommendations,
      },
    };
  }
}
