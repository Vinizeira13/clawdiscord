import { REST, Routes } from 'discord.js';

interface SetupConfig {
  guildId: string;
  templateConfig: any;
  token: string;
}

export class SetupService {
  private rest: REST;
  private guildId: string;
  private config: any;

  constructor({ guildId, templateConfig, token }: SetupConfig) {
    this.rest = new REST({ version: '10' }).setToken(token);
    this.guildId = guildId;
    this.config = templateConfig;
  }

  async execute(): Promise<{ success: boolean; stats: any; errors: string[] }> {
    const errors: string[] = [];
    const stats = {
      roles: 0,
      categories: 0,
      channels: 0,
      embeds: 0,
    };

    try {
      // 1. Create roles
      const roleMap = new Map<string, string>();
      for (const role of this.config.roles || []) {
        try {
          const created = (await this.rest.post(Routes.guildRoles(this.guildId), {
            body: {
              name: role.name,
              color: parseInt(role.color.replace('#', ''), 16),
              hoist: role.hoist ?? false,
              mentionable: role.mentionable ?? false,
            },
          })) as any;
          roleMap.set(role.name, created.id);
          stats.roles++;
          await this.delay(50);
        } catch (e: any) {
          errors.push(`Role ${role.name}: ${e.message}`);
        }
      }

      // 2. Create categories + channels
      for (const category of this.config.categories || []) {
        try {
          const cat = (await this.rest.post(Routes.guildChannels(this.guildId), {
            body: { name: category.name, type: 4 },
          })) as any;
          stats.categories++;

          for (const ch of category.channels || []) {
            const chType = ch.type === 'voice' ? 2 : ch.type === 'announcement' ? 5 : 0;
            try {
              await this.rest.post(Routes.guildChannels(this.guildId), {
                body: {
                  name: ch.name,
                  type: chType,
                  parent_id: cat.id,
                  topic: ch.topic,
                  rate_limit_per_user: ch.slowmode || 0,
                },
              });
              stats.channels++;
              await this.delay(50);
            } catch (e: any) {
              errors.push(`Channel ${ch.name}: ${e.message}`);
            }
          }
        } catch (e: any) {
          errors.push(`Category ${category.name}: ${e.message}`);
        }
      }

      return { success: errors.length === 0, stats, errors };
    } catch (e: any) {
      return { success: false, stats, errors: [...errors, e.message] };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
