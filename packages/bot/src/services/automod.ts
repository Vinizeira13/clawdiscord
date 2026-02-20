/**
 * ClawDiscord AutoMod Service
 *
 * Creates Discord AutoModeration rules based on template config.
 * Supports: spam filter, keyword filter, mention spam, invite filter, link filter.
 */

import { REST, Routes } from 'discord.js';

export interface AutoModConfig {
  spam_filter?: boolean;
  mention_limit?: number;
  keyword_filter?: string[];
  link_filter?: boolean;
  invite_filter?: boolean;
}

// Discord AutoMod enums
const TriggerType = {
  KEYWORD: 1,
  SPAM: 3,
  KEYWORD_PRESET: 4,
  MENTION_SPAM: 5,
} as const;

const ActionType = {
  BLOCK_MESSAGE: 1,
  SEND_ALERT_MESSAGE: 2,
  TIMEOUT: 3,
} as const;

const EventType = {
  MESSAGE_SEND: 1,
} as const;

const KeywordPresetType = {
  PROFANITY: 1,
  SEXUAL_CONTENT: 2,
  SLURS: 3,
} as const;

export class AutoModService {
  private rest: REST;
  private guildId: string;

  constructor(guildId: string, token: string) {
    this.rest = new REST({ version: '10' }).setToken(token);
    this.guildId = guildId;
  }

  async apply(config: AutoModConfig, alertChannelId?: string): Promise<{
    created: number;
    errors: string[];
  }> {
    let created = 0;
    const errors: string[] = [];

    const alertAction = alertChannelId
      ? { type: ActionType.SEND_ALERT_MESSAGE, metadata: { channel_id: alertChannelId } }
      : null;

    // 1. Spam filter
    if (config.spam_filter) {
      try {
        const actions: object[] = [{ type: ActionType.BLOCK_MESSAGE }];
        if (alertAction) actions.push(alertAction);

        await this.rest.post(Routes.guildAutoModerationRules(this.guildId), {
          body: {
            name: '🐾 ClawDiscord — Anti-Spam',
            event_type: EventType.MESSAGE_SEND,
            trigger_type: TriggerType.SPAM,
            actions,
            enabled: true,
          },
        });
        created++;
      } catch (e: unknown) {
        errors.push(`Spam filter: ${(e as Error).message}`);
      }
    }

    // 2. Keyword filter (custom words)
    if (config.keyword_filter && config.keyword_filter.length > 0) {
      try {
        const actions: object[] = [{ type: ActionType.BLOCK_MESSAGE }];
        if (alertAction) actions.push(alertAction);

        await this.rest.post(Routes.guildAutoModerationRules(this.guildId), {
          body: {
            name: '🐾 ClawDiscord — Keyword Filter',
            event_type: EventType.MESSAGE_SEND,
            trigger_type: TriggerType.KEYWORD,
            trigger_metadata: {
              keyword_filter: config.keyword_filter,
            },
            actions,
            enabled: true,
          },
        });
        created++;
      } catch (e: unknown) {
        errors.push(`Keyword filter: ${(e as Error).message}`);
      }
    }

    // 3. Profanity/slurs preset filter
    if (config.keyword_filter || config.spam_filter) {
      try {
        const actions: object[] = [{ type: ActionType.BLOCK_MESSAGE }];
        if (alertAction) actions.push(alertAction);

        await this.rest.post(Routes.guildAutoModerationRules(this.guildId), {
          body: {
            name: '🐾 ClawDiscord — Content Filter',
            event_type: EventType.MESSAGE_SEND,
            trigger_type: TriggerType.KEYWORD_PRESET,
            trigger_metadata: {
              presets: [KeywordPresetType.PROFANITY, KeywordPresetType.SLURS],
            },
            actions,
            enabled: true,
          },
        });
        created++;
      } catch (e: unknown) {
        errors.push(`Content filter: ${(e as Error).message}`);
      }
    }

    // 4. Mention spam limit
    if (config.mention_limit && config.mention_limit > 0) {
      try {
        const actions: object[] = [
          { type: ActionType.BLOCK_MESSAGE },
          { type: ActionType.TIMEOUT, metadata: { duration_seconds: 300 } },  // 5min timeout
        ];
        if (alertAction) actions.push(alertAction);

        await this.rest.post(Routes.guildAutoModerationRules(this.guildId), {
          body: {
            name: '🐾 ClawDiscord — Anti-Mention Spam',
            event_type: EventType.MESSAGE_SEND,
            trigger_type: TriggerType.MENTION_SPAM,
            trigger_metadata: {
              mention_total_limit: config.mention_limit,
            },
            actions,
            enabled: true,
          },
        });
        created++;
      } catch (e: unknown) {
        errors.push(`Mention limit: ${(e as Error).message}`);
      }
    }

    // 5. Invite filter (block Discord invites)
    if (config.invite_filter) {
      try {
        const actions: object[] = [{ type: ActionType.BLOCK_MESSAGE }];
        if (alertAction) actions.push(alertAction);

        await this.rest.post(Routes.guildAutoModerationRules(this.guildId), {
          body: {
            name: '🐾 ClawDiscord — Anti-Invite Links',
            event_type: EventType.MESSAGE_SEND,
            trigger_type: TriggerType.KEYWORD,
            trigger_metadata: {
              regex_patterns: ['discord\\.gg\\/\\w+', 'discord\\.com\\/invite\\/\\w+'],
            },
            actions,
            enabled: true,
          },
        });
        created++;
      } catch (e: unknown) {
        errors.push(`Invite filter: ${(e as Error).message}`);
      }
    }

    return { created, errors };
  }

  /**
   * Remove all ClawDiscord automod rules from a server
   */
  async removeAll(): Promise<number> {
    let removed = 0;
    try {
      const rules = (await this.rest.get(Routes.guildAutoModerationRules(this.guildId))) as Array<{
        id: string;
        name: string;
      }>;

      for (const rule of rules) {
        if (rule.name.startsWith('🐾 ClawDiscord')) {
          await this.rest.delete(Routes.guildAutoModerationRule(this.guildId, rule.id));
          removed++;
          await new Promise(r => setTimeout(r, 100));
        }
      }
    } catch { /* ignore */ }
    return removed;
  }
}
