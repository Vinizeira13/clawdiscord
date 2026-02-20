import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

export interface ChannelPermissions {
  everyone?: { send_messages?: boolean; view_channel?: boolean };
  staff_only?: boolean;
  role_locked?: string;
}

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface ChannelEmbed {
  title: string;
  description?: string;
  color?: string;
  fields?: EmbedField[];
  footer?: string;
  thumbnail?: string;
  image?: string;
}

export interface ChannelConfig {
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

export interface CategoryConfig {
  name: string;
  channels: ChannelConfig[];
  permissions?: ChannelPermissions;
}

export interface RoleConfig {
  name: string;
  color: string;
  hoist: boolean;
  mentionable?: boolean;
  position: number;
  permissions?: string[];
  permissions_deny?: string[];
  icon?: string;
}

export interface ServerTemplate {
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

function getTemplatesDir(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));

  // Try multiple paths: monorepo dev → npm published → fallback
  const candidates = [
    join(currentDir, '..', '..', '..', 'templates'),      // monorepo: packages/cli/dist/core → packages/templates
    join(currentDir, '..', 'templates'),                    // npm published: dist/core → templates (bundled)
    join(currentDir, '..', '..', 'templates'),              // alt structure
  ];

  for (const dir of candidates) {
    try {
      readdirSync(dir);
      return dir;
    } catch {
      // try next
    }
  }

  // Fallback to first (will error naturally if missing)
  return candidates[0];
}

export function loadTemplate(id: string): ServerTemplate | null {
  try {
    const templatesDir = getTemplatesDir();
    const filePath = join(templatesDir, `${id}.json`);
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as ServerTemplate;
  } catch {
    return null;
  }
}

export function listTemplates(): void {
  try {
    const templatesDir = getTemplatesDir();
    const files = readdirSync(templatesDir).filter(
      (f) => f.endsWith('.json') && !f.startsWith('_') && f !== 'package.json'
    );

    logger.banner();
    logger.info('\n📦 Available Templates:\n');

    for (const file of files) {
      const raw = readFileSync(join(templatesDir, file), 'utf-8');
      const template = JSON.parse(raw) as ServerTemplate;
      const totalChannels = template.categories.reduce(
        (acc, c) => acc + c.channels.length, 0
      );
      logger.info(`  ${template.id.padEnd(12)} — ${template.name}`);
      logger.dim(`${''.padEnd(15)}${template.categories.length} categories, ${totalChannels} channels, ${template.roles.length} roles`);
      logger.dim(`${''.padEnd(15)}${template.description}\n`);
    }
  } catch (e) {
    logger.error('Failed to load templates directory.');
  }
}
