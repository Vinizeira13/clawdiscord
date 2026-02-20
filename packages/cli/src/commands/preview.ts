import { loadTemplate } from '../core/template.js';
import { logger } from '../utils/logger.js';

export async function previewCommand(templateId: string) {
  const template = loadTemplate(templateId);
  if (!template) {
    logger.error(`Template "${templateId}" not found.`);
    process.exit(1);
  }

  logger.banner();
  logger.info(`\n📋 Template: ${template.name}`);
  logger.info(`📝 ${template.description}\n`);

  for (const category of template.categories) {
    logger.info(`\n📁 ${category.name}`);
    for (const channel of category.channels) {
      const icon = channel.type === 'voice' ? '🔊' : '#';
      const extras = [];
      if (channel.slowmode) extras.push(`slowmode: ${channel.slowmode}s`);
      if (channel.user_limit) extras.push(`limit: ${channel.user_limit}`);
      if (channel.permissions?.staff_only) extras.push('🔒 staff');
      if (channel.permissions?.everyone?.send_messages === false) extras.push('📖 read-only');
      const extStr = extras.length ? ` (${extras.join(', ')})` : '';
      logger.info(`  ${icon} ${channel.name}${extStr}`);
      if (channel.topic) logger.dim(`     ${channel.topic}`);
    }
  }

  logger.info(`\n👥 Roles:`);
  for (const role of template.roles) {
    const badge = role.hoist ? '🏷️' : '  ';
    logger.info(`  ${badge} ${role.name} — ${role.color}`);
  }

  const totalChannels = template.categories.reduce(
    (acc: number, c: any) => acc + c.channels.length, 0
  );
  logger.info(`\n📊 Total: ${template.categories.length} categories, ${totalChannels} channels, ${template.roles.length} roles`);
}
