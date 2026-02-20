/**
 * ClawDiscord Onboarding & Welcome Service
 *
 * Sets up Discord's native onboarding flow + welcome messages.
 * When new members join, they see customized prompts to self-assign roles.
 */

import { REST, Routes } from 'discord.js';

export interface OnboardingConfig {
  enabled: boolean;
  prompts: OnboardingPrompt[];
}

export interface OnboardingPrompt {
  title: string;
  options: OnboardingOption[];
  single_select?: boolean;  // Only allow picking one option
  required?: boolean;
}

export interface OnboardingOption {
  title: string;
  emoji?: string;
  description?: string;
  roles?: string[];    // Role names to assign
  channels?: string[];  // Channel names to show
}

export class OnboardingService {
  private rest: REST;
  private guildId: string;

  constructor(guildId: string, token: string) {
    this.rest = new REST({ version: '10' }).setToken(token);
    this.guildId = guildId;
  }

  /**
   * Apply onboarding config to the guild.
   * Maps role/channel NAMES to IDs from the server.
   */
  async apply(
    config: OnboardingConfig,
    roleMap: Map<string, string>,
    channelMap: Map<string, string>,
    defaultChannelIds: string[]
  ): Promise<{ success: boolean; error?: string }> {
    if (!config.enabled) return { success: true };

    try {
      // Build prompts with resolved IDs
      const prompts = config.prompts.map((prompt, pIdx) => ({
        id: `${this.guildId}_prompt_${pIdx}`,
        type: 0, // MULTIPLE_CHOICE
        title: prompt.title,
        single_select: prompt.single_select ?? false,
        required: prompt.required ?? true,
        in_onboarding: true,
        options: prompt.options.map((opt, oIdx) => {
          const roleIds = (opt.roles || [])
            .map(name => roleMap.get(name))
            .filter(Boolean) as string[];

          const channelIds = (opt.channels || [])
            .map(name => channelMap.get(name))
            .filter(Boolean) as string[];

          const option: Record<string, unknown> = {
            id: `${this.guildId}_opt_${pIdx}_${oIdx}`,
            title: opt.title,
            role_ids: roleIds,
            channel_ids: channelIds,
          };

          if (opt.emoji) {
            // Unicode emoji
            option.emoji = { name: opt.emoji };
          }

          if (opt.description) {
            option.description = opt.description;
          }

          return option;
        }),
      }));

      await this.rest.put(`/guilds/${this.guildId}/onboarding` as `/${string}`, {
        body: {
          prompts,
          default_channel_ids: defaultChannelIds,
          enabled: true,
          mode: 0, // ONBOARDING_DEFAULT
        },
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Setup a welcome message system using the first text channel or a designated channel.
   */
  async setupWelcomeMessage(
    channelId: string,
    serverName: string,
    memberCount?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const embed = {
        title: `Welcome to ${serverName}!`,
        description: [
          `Thanks for joining! We're glad to have you here.`,
          ``,
          `**Getting Started:**`,
          `• Check out the rules channel`,
          `• Pick your roles in the onboarding flow`,
          `• Say hi in general chat!`,
          memberCount ? `\nYou're member #${memberCount}!` : '',
        ].join('\n'),
        color: 0x5865f2,
        footer: { text: 'Powered by ClawDiscord' },
        timestamp: new Date().toISOString(),
      };

      await this.rest.post(Routes.channelMessages(channelId), {
        body: {
          embeds: [embed],
          components: [
            {
              type: 1, // ACTION_ROW
              components: [
                {
                  type: 2, // BUTTON
                  style: 5, // LINK
                  label: 'Powered by ClawDiscord',
                  url: 'https://claw-discord.com',
                },
              ],
            },
          ],
        },
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}
