import inquirer from 'inquirer';
import { loadTemplate } from '../core/template.js';
import { ServerBuilder } from '../core/builder.js';
import { DiscordClient } from '../core/discord.js';
import { logger } from '../utils/logger.js';

interface SetupOptions {
  template?: string;
  guild?: string;
  dryRun?: boolean;
}

const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1474410305609273598'; // TODO: move to shared config

export async function setupCommand(options: SetupOptions) {
  logger.banner();

  // ─── CHECK TOKEN FIRST ───
  if (!process.env.DISCORD_TOKEN) {
    logger.error('DISCORD_TOKEN not found in environment.\n');
    logger.info('To set it up:');
    logger.info('  1. Go to https://discord.com/developers/applications');
    logger.info('  2. Select your app → Bot → Copy Token');
    logger.info('  3. Run: export DISCORD_TOKEN="your_token_here"');
    logger.info('  4. Or add it to a .env file in the project root\n');
    process.exit(1);
  }

  // ─── STEP 1: Select template ───
  let templateId = options.template;
  if (!templateId) {
    const { selectedTemplate } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedTemplate',
        message: 'Choose a server template:',
        choices: [
          { name: '🎮 Gaming Community — LFG, tournaments, clips, voice lobbies (36ch, 20 roles)', value: 'gaming' },
          { name: '💼 SaaS Community — Support, feedback, dev updates, knowledge base (33ch, 18 roles)', value: 'saas' },
          { name: '🌐 General Community — Social, events, media, voice hangouts (44ch, 31 roles)', value: 'general' },
        ],
      },
    ]);
    templateId = selectedTemplate;
  }

  const template = loadTemplate(templateId!);
  if (!template) {
    logger.error(`Template "${templateId}" not found. Run 'clawdiscord templates' to see available options.`);
    process.exit(1);
  }

  // ─── STEP 2: Customization ───
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'serverName',
      message: 'Server name (leave empty to keep current):',
      default: '',
    },
    {
      type: 'checkbox',
      name: 'languages',
      message: 'Languages for embeds:',
      choices: [
        { name: 'English', value: 'en', checked: true },
        { name: 'Português', value: 'pt' },
        { name: 'Español', value: 'es' },
        { name: 'Français', value: 'fr' },
        { name: 'Deutsch', value: 'de' },
        { name: 'Polski', value: 'pl' },
      ],
    },
    {
      type: 'confirm',
      name: 'includeStaff',
      message: 'Include staff channels? (private mod channels)',
      default: true,
    },
    {
      type: 'confirm',
      name: 'includeEngagement',
      message: 'Include engagement features? (polls, daily questions, giveaways)',
      default: true,
    },
  ]);

  // ─── STEP 3: Get guild ID ───
  let guildId = options.guild;
  if (!guildId) {
    const inviteUrl = DiscordClient.generateInviteUrl(CLIENT_ID);
    logger.info(`\n🔗 Bot invite link (open in browser if bot isn't in your server):`);
    logger.info(`   ${inviteUrl}\n`);

    const { inputGuildId } = await inquirer.prompt([
      {
        type: 'input',
        name: 'inputGuildId',
        message: 'Discord Server ID (right-click server → Copy Server ID):',
        validate: (input: string) => {
          if (!/^\d{17,20}$/.test(input)) return 'Invalid server ID. Must be 17-20 digits.';
          return true;
        },
      },
    ]);
    guildId = inputGuildId;
  }

  // ─── STEP 4: Preview ───
  const totalChannels = template.categories.reduce((acc, c) => acc + c.channels.length, 0);
  const staffRoles = template.roles.filter(r => r.position >= 12).length;

  logger.info(`\n📋 Setup Summary:`);
  logger.info(`   Template:    ${template.name}`);
  logger.info(`   Server ID:   ${guildId}`);
  logger.info(`   Categories:  ${template.categories.length}`);
  logger.info(`   Channels:    ${totalChannels}`);
  logger.info(`   Roles:       ${template.roles.length} (${staffRoles} staff)`);
  logger.info(`   Staff:       ${answers.includeStaff ? '✅' : '❌'}`);
  logger.info(`   Engagement:  ${answers.includeEngagement ? '✅' : '❌'}`);
  logger.info(`   Est. time:   ~${Math.ceil((totalChannels + template.roles.length) * 0.05)}s`);

  // ─── DRY RUN ───
  if (options.dryRun) {
    const builder = new ServerBuilder(guildId!, template, {
      languages: answers.languages,
      includeStaff: answers.includeStaff,
      includeEngagement: answers.includeEngagement,
      serverName: answers.serverName || undefined,
    });
    await builder.dryRun();
    return;
  }

  // ─── STEP 5: Confirm ───
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Apply this setup to your server?',
      default: true,
    },
  ]);

  if (!confirm) {
    logger.warn('Setup cancelled.');
    return;
  }

  // ─── STEP 6: Build ───
  const builder = new ServerBuilder(guildId!, template, {
    languages: answers.languages,
    includeStaff: answers.includeStaff,
    includeEngagement: answers.includeEngagement,
    serverName: answers.serverName || undefined,
  });

  try {
    await builder.build();
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`\n❌ Setup failed: ${err.message}`);
    logger.info('\nTroubleshooting:');
    logger.info('  • Make sure the bot is invited to the server');
    logger.info('  • Check the bot has Administrator or Manage Channels + Manage Roles permissions');
    logger.info('  • Verify the server ID is correct');
    logger.info(`  • Bot invite: ${DiscordClient.generateInviteUrl(CLIENT_ID)}`);
    process.exit(1);
  }
}
