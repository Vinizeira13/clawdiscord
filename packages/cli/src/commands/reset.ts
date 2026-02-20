import inquirer from 'inquirer';
import ora from 'ora';
import { DiscordClient } from '../core/discord.js';
import { logger } from '../utils/logger.js';

interface ResetOptions {
  guild?: string;
}

const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1474410305609273598';

export async function resetCommand(options: ResetOptions) {
  logger.banner();

  if (!process.env.DISCORD_TOKEN) {
    logger.error('DISCORD_TOKEN not found in environment.\n');
    logger.info('Run: export DISCORD_TOKEN="your_token_here"');
    process.exit(1);
  }

  // Get guild ID
  let guildId = options.guild;
  if (!guildId) {
    const { inputGuildId } = await inquirer.prompt([
      {
        type: 'input',
        name: 'inputGuildId',
        message: 'Discord Server ID to reset:',
        validate: (input: string) => /^\d{17,20}$/.test(input) || 'Invalid server ID.',
      },
    ]);
    guildId = inputGuildId;
  }

  const discord = new DiscordClient(process.env.DISCORD_TOKEN);

  // Verify guild
  let guild;
  try {
    guild = await discord.getGuild(guildId!);
  } catch {
    logger.error(`Cannot access server ${guildId}.`);
    logger.info(`Make sure the bot is invited: ${DiscordClient.generateInviteUrl(CLIENT_ID)}`);
    process.exit(1);
  }

  // Get current stats
  const channels = await discord.getGuildChannels(guildId!);
  const roles = await discord.getGuildRoles(guildId!);
  const nonDefaultRoles = roles.filter(r => r.id !== guildId && !r.managed && !r.name.startsWith('@'));

  logger.warn(`\n⚠️  This will delete from "${guild.name}":`);
  logger.info(`   ${channels.length} channels`);
  logger.info(`   ${nonDefaultRoles.length} roles (excluding @everyone and managed)\n`);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'This action is IRREVERSIBLE. Continue?',
      default: false,
    },
  ]);

  if (!confirm) {
    logger.warn('Reset cancelled.');
    return;
  }

  const spinner = ora('Deleting channels...').start();
  let deletedChannels = 0;
  let deletedRoles = 0;
  const errors: string[] = [];

  // Delete channels (non-categories first)
  const nonCats = channels.filter(c => c.type !== 4);
  const cats = channels.filter(c => c.type === 4);

  for (const ch of nonCats) {
    try {
      await discord.deleteChannel(ch.id);
      deletedChannels++;
      spinner.text = `Deleting channels... (${deletedChannels}/${channels.length})`;
    } catch (e: unknown) {
      errors.push(`Channel "${ch.name}": ${(e as Error).message}`);
    }
  }

  for (const ch of cats) {
    try {
      await discord.deleteChannel(ch.id);
      deletedChannels++;
      spinner.text = `Deleting channels... (${deletedChannels}/${channels.length})`;
    } catch (e: unknown) {
      errors.push(`Category "${ch.name}": ${(e as Error).message}`);
    }
  }

  spinner.text = 'Deleting roles...';

  for (const role of nonDefaultRoles) {
    try {
      await discord.deleteRole(guildId!, role.id);
      deletedRoles++;
      spinner.text = `Deleting roles... (${deletedRoles}/${nonDefaultRoles.length})`;
    } catch (e: unknown) {
      errors.push(`Role "${role.name}": ${(e as Error).message}`);
    }
  }

  spinner.succeed('Reset complete!');

  logger.success(`\n✅ Deleted ${deletedChannels} channels and ${deletedRoles} roles.`);

  if (errors.length > 0) {
    logger.warn(`\n${errors.length} errors (some items may be system-protected):`);
    errors.slice(0, 5).forEach(e => logger.dim(`  • ${e}`));
  }

  logger.info('\nRun `clawdiscord setup` to apply a fresh template.');
}
