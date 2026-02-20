import inquirer from 'inquirer';
import { loadTemplate, listTemplates } from '../core/template.js';
import { ServerBuilder } from '../core/builder.js';
import { logger } from '../utils/logger.js';

interface SetupOptions {
  template?: string;
  guild?: string;
  dryRun?: boolean;
}

export async function setupCommand(options: SetupOptions) {
  logger.banner();

  // Step 1: Select template
  let templateId = options.template;
  if (!templateId) {
    const { selectedTemplate } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedTemplate',
        message: 'Choose a server template:',
        choices: [
          { name: '🎮 Gaming Community — LFG, tournaments, clips, voice lobbies', value: 'gaming' },
          { name: '💼 SaaS Community — Support, feedback, announcements, dev talk', value: 'saas' },
          { name: '🌐 General Community — Social, events, media, voice hangouts', value: 'general' },
        ],
      },
    ]);
    templateId = selectedTemplate;
  }

  const template = loadTemplate(templateId!);
  if (!template) {
    logger.error(`Template "${templateId}" not found.`);
    process.exit(1);
  }

  // Step 2: Customize
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'serverName',
      message: 'Server name:',
      default: template.name,
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
      message: 'Include staff channels?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'includeEngagement',
      message: 'Include engagement features (polls, daily topics)?',
      default: true,
    },
  ]);

  // Step 3: Get guild ID
  let guildId = options.guild;
  if (!guildId) {
    const { inputGuildId } = await inquirer.prompt([
      {
        type: 'input',
        name: 'inputGuildId',
        message: 'Discord Server ID (right-click server → Copy Server ID):',
        validate: (input: string) => /^\d{17,20}$/.test(input) || 'Invalid server ID',
      },
    ]);
    guildId = inputGuildId;
  }

  // Step 4: Confirm
  logger.info(`\nTemplate: ${template.name}`);
  logger.info(`Server ID: ${guildId}`);
  logger.info(`Categories: ${template.categories.length}`);
  logger.info(`Channels: ${template.categories.reduce((acc: number, c: any) => acc + c.channels.length, 0)}`);
  logger.info(`Roles: ${template.roles.length}`);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: options.dryRun ? 'Preview this setup?' : 'Apply this setup to your server?',
      default: true,
    },
  ]);

  if (!confirm) {
    logger.warn('Setup cancelled.');
    return;
  }

  // Step 5: Build
  if (options.dryRun) {
    logger.info('\n📋 Dry run — no changes applied.');
    logger.info(JSON.stringify(template, null, 2));
    return;
  }

  const builder = new ServerBuilder(guildId!, template, {
    languages: answers.languages,
    includeStaff: answers.includeStaff,
    includeEngagement: answers.includeEngagement,
    serverName: answers.serverName,
  });

  await builder.build();
}
