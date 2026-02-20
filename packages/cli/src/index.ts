#!/usr/bin/env node

import { Command } from 'commander';
import { setupCommand } from './commands/setup.js';
import { previewCommand } from './commands/preview.js';
import { authCommand } from './commands/auth.js';

const program = new Command();

program
  .name('clawdiscord')
  .description('🐾 Automate professional Discord server setup in seconds')
  .version('0.1.0');

program
  .command('setup')
  .description('Setup a new Discord server with a professional template')
  .option('-t, --template <template>', 'Template to use (gaming, saas, general)')
  .option('-g, --guild <guildId>', 'Discord server ID to setup')
  .option('--dry-run', 'Preview changes without applying')
  .action(setupCommand);

program
  .command('preview')
  .description('Preview a template before applying')
  .argument('<template>', 'Template name to preview')
  .action(previewCommand);

program
  .command('auth')
  .description('Authenticate with ClawDiscord')
  .option('--token <token>', 'API token')
  .action(authCommand);

program
  .command('templates')
  .description('List available templates')
  .action(async () => {
    const { listTemplates } = await import('./core/template.js');
    listTemplates();
  });

program
  .command('invite')
  .description('Get the bot invite link')
  .action(async () => {
    const { logger } = await import('./utils/logger.js');
    const { DiscordClient } = await import('./core/discord.js');
    const clientId = process.env.DISCORD_CLIENT_ID || '1474410305609273598';
    const url = DiscordClient.generateInviteUrl(clientId);
    logger.banner();
    logger.info('🔗 Bot Invite Link:');
    logger.info(`   ${url}\n`);
    logger.dim('Open in browser → Select your server → Authorize');
  });

program
  .command('reset')
  .description('Remove all channels and roles from a server (cleanup)')
  .option('-g, --guild <guildId>', 'Discord server ID to reset')
  .action(async (options: { guild?: string }) => {
    const { resetCommand } = await import('./commands/reset.js');
    await resetCommand(options);
  });

program.parse();
