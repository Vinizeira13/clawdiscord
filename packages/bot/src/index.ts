import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
} from 'discord.js';
import { config } from 'dotenv';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ActivityType } from 'discord.js';
import { handleGuildCreate } from './events/guildCreate.js';
import { SetupService } from './services/setup.js';
import { AutoModService, type AutoModConfig } from './services/automod.js';
import { BackupService } from './services/backup.js';
import { AnalyticsService } from './services/analytics.js';
import { AIAgent } from './services/ai-agent.js';
import { OnboardingService } from './services/onboarding.js';
import { validateEnv } from './env.js';

config();
const env = validateEnv();

const CLIENT_ID = env.DISCORD_CLIENT_ID;

// ─── SLASH COMMANDS ───
const commands = [
  new SlashCommandBuilder()
    .setName('clawdiscord')
    .setDescription('ClawDiscord server setup commands')
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Show bot status and server info')
    )
    .addSubcommand((sub) =>
      sub
        .setName('preview')
        .setDescription('Preview a template')
        .addStringOption((opt) =>
          opt
            .setName('template')
            .setDescription('Template to preview')
            .setRequired(true)
            .addChoices(
              { name: 'Gaming Community', value: 'gaming' },
              { name: 'SaaS Community', value: 'saas' },
              { name: 'General Community', value: 'general' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName('invite').setDescription('Get the bot invite link')
    )
    .addSubcommand((sub) =>
      sub.setName('templates').setDescription('List all available templates')
    )
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Setup this server with a professional template')
        .addStringOption((opt) =>
          opt
            .setName('template')
            .setDescription('Template to apply')
            .setRequired(true)
            .addChoices(
              { name: 'Gaming Community', value: 'gaming' },
              { name: 'SaaS Community', value: 'saas' },
              { name: 'General Community', value: 'general' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset')
        .setDescription('Remove all channels and roles created by ClawDiscord')
    )
    .addSubcommand((sub) =>
      sub
        .setName('backup')
        .setDescription('Export this server as a reusable template')
    )
    .addSubcommand((sub) =>
      sub
        .setName('analytics')
        .setDescription('Server health report with score and recommendations')
    )
    .addSubcommand((sub) =>
      sub
        .setName('automod')
        .setDescription('Setup AI-powered auto-moderation rules')
        .addStringOption((opt) =>
          opt
            .setName('preset')
            .setDescription('AutoMod preset to apply')
            .setRequired(true)
            .addChoices(
              { name: 'Light — Spam only', value: 'light' },
              { name: 'Standard — Spam + profanity + mentions', value: 'standard' },
              { name: 'Strict — All filters enabled', value: 'strict' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('ai')
        .setDescription('Generate a custom server with AI (describe your community)')
        .addStringOption((opt) =>
          opt
            .setName('description')
            .setDescription('Describe your community (e.g. "crypto trading group with 500 members")')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('style')
            .setDescription('Server complexity')
            .addChoices(
              { name: 'Minimal (20 channels)', value: 'minimal' },
              { name: 'Standard (35 channels)', value: 'standard' },
              { name: 'Maximal (60 channels)', value: 'maximal' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('clone')
        .setDescription('Clone this server structure to another server')
        .addStringOption((opt) =>
          opt
            .setName('target')
            .setDescription('Target server ID to clone to')
            .setRequired(true)
        )
    )
    .toJSON(),
];

// ─── CLIENT ───
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.AutoModerationConfiguration,
    GatewayIntentBits.AutoModerationExecution,
  ],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`🐾 ClawDiscord Bot ready! Logged in as ${c.user.tag}`);
  console.log(`   Serving ${c.guilds.cache.size} guilds`);

  // Start status rotation
  startStatusRotation(client);

  // Register slash commands
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('   ✅ Slash commands registered');
  } catch (err) {
    console.error('   ❌ Failed to register slash commands:', err);
  }
});

client.on(Events.GuildCreate, handleGuildCreate);

// ─── COMMAND HANDLER ───
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'clawdiscord') return;

  const sub = interaction.options.getSubcommand();

  try {
    switch (sub) {
      case 'status':
        await handleStatus(interaction);
        break;
      case 'preview':
        await handlePreview(interaction);
        break;
      case 'invite':
        await handleInvite(interaction);
        break;
      case 'templates':
        await handleTemplates(interaction);
        break;
      case 'setup':
        await handleSetup(interaction);
        break;
      case 'reset':
        await handleReset(interaction);
        break;
      case 'backup':
        await handleBackup(interaction);
        break;
      case 'analytics':
        await handleAnalytics(interaction);
        break;
      case 'automod':
        await handleAutoMod(interaction);
        break;
      case 'ai':
        await handleAI(interaction);
        break;
      case 'clone':
        await handleClone(interaction);
        break;
    }
  } catch (err) {
    console.error(`Command error (${sub}):`, err);
    const content = '❌ An error occurred. Please try again.';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, ephemeral: true });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  }
});

// ─── /clawdiscord status ───
async function handleStatus(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'This command only works in a server.', ephemeral: true });

  const embed = new EmbedBuilder()
    .setTitle('🐾 ClawDiscord Status')
    .setColor(0x5865f2)
    .addFields(
      { name: 'Server', value: guild.name, inline: true },
      { name: 'Members', value: guild.memberCount.toString(), inline: true },
      { name: 'Channels', value: guild.channels.cache.size.toString(), inline: true },
      { name: 'Roles', value: guild.roles.cache.size.toString(), inline: true },
      { name: 'Bot Version', value: '0.1.0', inline: true },
      { name: 'Uptime', value: `${Math.floor((client.uptime || 0) / 60000)}m`, inline: true }
    )
    .setFooter({ text: 'ClawDiscord — Automate your Discord in seconds' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// ─── /clawdiscord preview <template> ───
async function handlePreview(interaction: ChatInputCommandInteraction) {
  const templateId = interaction.options.getString('template', true);

  // Template stats (hardcoded for now — will be dynamic with DB)
  const templates: Record<string, { name: string; desc: string; cats: number; chs: number; roles: number; color: number }> = {
    gaming: { name: '🎮 Gaming Community', desc: 'LFG, tournaments, clips, voice lobbies, engagement features', cats: 7, chs: 36, roles: 20, color: 0xe74c3c },
    saas: { name: '💼 SaaS Community', desc: 'Support, feedback, dev updates, knowledge base, forums', cats: 8, chs: 33, roles: 18, color: 0x3498db },
    general: { name: '🌐 General Community', desc: 'Social, events, media, interests, voice hangouts', cats: 8, chs: 44, roles: 31, color: 0x2ecc71 },
  };

  const t = templates[templateId];
  if (!t) return interaction.reply({ content: 'Template not found.', ephemeral: true });

  const embed = new EmbedBuilder()
    .setTitle(t.name)
    .setDescription(t.desc)
    .setColor(t.color)
    .addFields(
      { name: '📁 Categories', value: t.cats.toString(), inline: true },
      { name: '💬 Channels', value: t.chs.toString(), inline: true },
      { name: '👥 Roles', value: t.roles.toString(), inline: true },
      { name: '⏱️ Setup Time', value: `~${Math.ceil((t.chs + t.roles) * 0.05)}s`, inline: true },
      { name: '📦 Includes', value: 'Categories, channels with topics, roles with hierarchy & permissions, embeds (rules, FAQ, LFG format), slowmode, staff channels' }
    )
    .addFields({
      name: '🚀 How to Apply',
      value: '```\nnpm install -g @clawdiscord/cli\nclawdiscord setup\n```\nOr visit **claw-discord.com** for a web-based setup.',
    })
    .setFooter({ text: 'ClawDiscord — Automate your Discord in seconds' });

  await interaction.reply({ embeds: [embed] });
}

// ─── /clawdiscord invite ───
async function handleInvite(interaction: ChatInputCommandInteraction) {
  const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands`;

  const embed = new EmbedBuilder()
    .setTitle('🔗 Invite ClawDiscord')
    .setDescription(`[Click here to invite the bot](${inviteUrl})`)
    .setColor(0x5865f2)
    .addFields({
      name: 'Required Permissions',
      value: 'Administrator (or Manage Channels + Manage Roles + Manage Guild)',
    })
    .setFooter({ text: 'ClawDiscord — Automate your Discord in seconds' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ─── /clawdiscord templates ───
async function handleTemplates(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('📦 Available Templates')
    .setColor(0x5865f2)
    .addFields(
      {
        name: '🎮 Gaming Community',
        value: '7 categories • 36 channels • 20 roles\nLFG, tournaments, clips, voice lobbies, engagement features',
      },
      {
        name: '💼 SaaS Community',
        value: '8 categories • 33 channels • 18 roles\nSupport, feedback, dev updates, knowledge base, forums',
      },
      {
        name: '🌐 General Community',
        value: '8 categories • 44 channels • 31 roles\nSocial, events, media, interests, voice hangouts',
      }
    )
    .addFields({
      name: '🚀 Get Started',
      value: '```\nnpm install -g @clawdiscord/cli\nclawdiscord setup\n```',
    })
    .setFooter({ text: 'ClawDiscord — Automate your Discord in seconds' });

  await interaction.reply({ embeds: [embed] });
}

// ─── TEMPLATE LOADER ───
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getTemplatesDir(): string {
  const candidates = [
    join(__dirname, '..', '..', '..', 'templates'),
    join(__dirname, '..', '..', 'templates'),
    join(__dirname, '..', 'templates'),
  ];
  for (const dir of candidates) {
    try {
      const files = readdirSync(dir);
      if (files.some(f => f.endsWith('.json') && !f.startsWith('_') && f !== 'package.json')) return dir;
    } catch { /* skip */ }
  }
  return candidates[0];
}

function loadTemplate(id: string): Record<string, unknown> | null {
  try {
    const dir = getTemplatesDir();
    const raw = readFileSync(join(dir, `${id}.json`), 'utf-8');
    const parsed = JSON.parse(raw);
    // Validate required fields
    if (!parsed.name || !Array.isArray(parsed.categories) || !Array.isArray(parsed.roles)) {
      console.error(`Template "${id}" missing required fields (name, categories, roles)`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// ─── ACTIVE SETUPS TRACKER ───
const activeSetups = new Set<string>();

// ─── /clawdiscord setup <template> ───
async function handleSetup(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'This command only works in a server.', ephemeral: true });

  // Check permissions
  const member = interaction.member;
  if (!member || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need **Administrator** permission to run setup.', ephemeral: true });
  }

  // Check if setup already running
  if (activeSetups.has(guild.id)) {
    return interaction.reply({ content: '⏳ A setup is already running on this server. Please wait.', ephemeral: true });
  }

  const templateId = interaction.options.getString('template', true);
  const template = loadTemplate(templateId);

  if (!template) {
    return interaction.reply({ content: `❌ Template "${templateId}" not found.`, ephemeral: true });
  }

  // Confirmation embed
  const categories = (template.categories as Array<{ channels: unknown[] }>);
  const roles = template.roles as unknown[];
  const totalChannels = categories.reduce((acc, c) => acc + c.channels.length, 0);
  const estTime = Math.ceil((totalChannels + roles.length) * 0.05);

  const confirmEmbed = new EmbedBuilder()
    .setTitle(`⚠️ Confirm Setup: ${template.name}`)
    .setColor(0xf39c12)
    .setDescription('This will create new categories, channels, roles, and embeds in your server.\n\n**Existing channels/roles will NOT be deleted.**')
    .addFields(
      { name: '📁 Categories', value: categories.length.toString(), inline: true },
      { name: '💬 Channels', value: totalChannels.toString(), inline: true },
      { name: '👥 Roles', value: roles.length.toString(), inline: true },
      { name: '⏱️ Estimated Time', value: `~${estTime}s`, inline: true },
    )
    .setFooter({ text: 'This action cannot be easily undone. Use /clawdiscord reset to remove created items.' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('setup_confirm').setLabel('✅ Apply Setup').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('setup_cancel').setLabel('❌ Cancel').setStyle(ButtonStyle.Danger),
  );

  const response = await interaction.reply({ embeds: [confirmEmbed], components: [row], fetchReply: true });

  // Wait for button click
  try {
    const btnInteraction = await response.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i: ButtonInteraction) => i.user.id === interaction.user.id,
      time: 30_000,
    });

    if (btnInteraction.customId === 'setup_cancel') {
      await btnInteraction.update({ content: '❌ Setup cancelled.', embeds: [], components: [] });
      return;
    }

    // Start setup
    activeSetups.add(guild.id);

    const progressEmbed = new EmbedBuilder()
      .setTitle('🔧 Setting up your server...')
      .setColor(0x5865f2)
      .setDescription('Phase 1/4: Creating roles...')
      .setFooter({ text: 'Please wait, this may take a moment.' });

    await btnInteraction.update({ embeds: [progressEmbed], components: [] });

    const setupService = new SetupService(
      guild.id,
      template as unknown as import('./services/setup.js').ServerTemplate,
      process.env.DISCORD_TOKEN!,
      async (phase, current, total) => {
        const phaseNames: Record<string, string> = {
          roles: '👥 Creating roles',
          channels: '📁 Creating categories & channels',
          embeds: '📝 Sending embeds',
        };
        const phaseName = phaseNames[phase] || phase;
        const phaseNum = phase === 'roles' ? 1 : phase === 'channels' ? 2 : phase === 'embeds' ? 3 : 4;

        // Update progress every 3 items to avoid rate limits
        if (current % 3 === 0 || current === total) {
          try {
            progressEmbed.setDescription(`Phase ${phaseNum}/4: ${phaseName}... (${current}/${total})`);
            await interaction.editReply({ embeds: [progressEmbed] });
          } catch { /* ignore edit failures */ }
        }
      }
    );

    const result = await setupService.execute();
    activeSetups.delete(guild.id);

    const resultEmbed = new EmbedBuilder()
      .setTitle(result.success ? '✅ Setup Complete!' : '⚠️ Setup Completed with Errors')
      .setColor(result.success ? 0x2ecc71 : 0xf39c12)
      .addFields(
        { name: '👥 Roles Created', value: result.stats.roles.toString(), inline: true },
        { name: '📁 Categories', value: result.stats.categories.toString(), inline: true },
        { name: '💬 Channels', value: result.stats.channels.toString(), inline: true },
        { name: '📝 Embeds Sent', value: result.stats.embeds.toString(), inline: true },
        { name: '⏱️ Duration', value: `${(result.duration / 1000).toFixed(1)}s`, inline: true },
      )
      .setFooter({ text: 'ClawDiscord — Automate your Discord in seconds' })
      .setTimestamp();

    if (result.errors.length > 0) {
      const errorText = result.errors.slice(0, 5).join('\n');
      resultEmbed.addFields({ name: '❌ Errors', value: `\`\`\`\n${errorText}\n\`\`\`` });
    }

    await interaction.editReply({ embeds: [resultEmbed] });
  } catch (error) {
    activeSetups.delete(guild.id);
    const errMsg = (error as Error).message || String(error);
    if (errMsg.includes('time')) {
      await interaction.editReply({ content: '⏰ Setup timed out. Run the command again.', embeds: [], components: [] });
    } else if (errMsg.includes('Missing Access') || errMsg.includes('Missing Permissions')) {
      await interaction.editReply({ content: '❌ Bot is missing permissions. Make sure it has **Administrator** or **Manage Server + Manage Roles + Manage Channels** permissions.', embeds: [], components: [] });
    } else {
      console.error('Setup error:', error);
      await interaction.editReply({ content: `❌ Setup failed: ${errMsg.slice(0, 200)}`, embeds: [], components: [] }).catch(() => {});
    }
  }
}

// ─── /clawdiscord reset ───
async function handleReset(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'This command only works in a server.', ephemeral: true });

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need **Administrator** permission to reset.', ephemeral: true });
  }

  const warnEmbed = new EmbedBuilder()
    .setTitle('⚠️ Reset Server — Are you sure?')
    .setColor(0xe74c3c)
    .setDescription(
      'This will **delete ALL non-default channels and roles** from this server.\n\n' +
      '**This action is irreversible!**\n\n' +
      'Only the @everyone role and system channels will be preserved.'
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('reset_confirm').setLabel('🗑️ Yes, Reset Everything').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('reset_cancel').setLabel('❌ Cancel').setStyle(ButtonStyle.Secondary),
  );

  const response = await interaction.reply({ embeds: [warnEmbed], components: [row], fetchReply: true });

  try {
    const btnInteraction = await response.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i: ButtonInteraction) => i.user.id === interaction.user.id,
      time: 15_000,
    });

    if (btnInteraction.customId === 'reset_cancel') {
      await btnInteraction.update({ content: '❌ Reset cancelled.', embeds: [], components: [] });
      return;
    }

    await btnInteraction.update({ content: '🗑️ Resetting server... This may take a moment.', embeds: [], components: [] });

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    let deletedChannels = 0;
    let deletedRoles = 0;
    const errors: string[] = [];

    // Delete all non-category channels, then categories (skip Discord system channels like rules/community-updates)
    const allChannels = (await rest.get(Routes.guildChannels(guild.id))) as Array<{ id: string; name: string; type: number; flags?: number }>;
    const channels = allChannels.filter(c => !(c.flags && (c.flags & (1 << 0))));  // Skip system/undeletable channels

    // Delete channels first (non-categories)
    for (const ch of channels.filter(c => c.type !== 4)) {
      try {
        await rest.delete(Routes.channel(ch.id));
        deletedChannels++;
        await new Promise(r => setTimeout(r, 50));
      } catch (e: unknown) {
        errors.push(`Channel "${ch.name}": ${(e as Error).message}`);
      }
    }

    // Then delete empty categories
    for (const ch of channels.filter(c => c.type === 4)) {
      try {
        await rest.delete(Routes.channel(ch.id));
        deletedChannels++;
        await new Promise(r => setTimeout(r, 50));
      } catch (e: unknown) {
        errors.push(`Category "${ch.name}": ${(e as Error).message}`);
      }
    }

    // Delete non-default roles (skip @everyone which has id === guild.id, and bot's managed roles)
    const roles = (await rest.get(Routes.guildRoles(guild.id))) as Array<{ id: string; name: string; managed: boolean }>;
    for (const role of roles) {
      if (role.id === guild.id || role.managed) continue;
      try {
        await rest.delete(Routes.guildRole(guild.id, role.id));
        deletedRoles++;
        await new Promise(r => setTimeout(r, 50));
      } catch (e: unknown) {
        errors.push(`Role "${role.name}": ${(e as Error).message}`);
      }
    }

    const resultEmbed = new EmbedBuilder()
      .setTitle('🗑️ Reset Complete')
      .setColor(0x2ecc71)
      .addFields(
        { name: 'Channels Deleted', value: deletedChannels.toString(), inline: true },
        { name: 'Roles Deleted', value: deletedRoles.toString(), inline: true },
      )
      .setFooter({ text: 'Server is now clean. Run /clawdiscord setup to apply a new template.' });

    if (errors.length > 0) {
      resultEmbed.addFields({ name: 'Errors', value: errors.slice(0, 5).join('\n').slice(0, 1024) });
    }

    await interaction.editReply({ content: null, embeds: [resultEmbed] });
  } catch (error) {
    if ((error as Error).message?.includes('time')) {
      await interaction.editReply({ content: '⏰ Reset timed out.', embeds: [], components: [] });
    } else {
      throw error;
    }
  }
}

// ─── /clawdiscord backup ───
async function handleBackup(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'Server only.', ephemeral: true });
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ Admin required.', ephemeral: true });
  }

  await interaction.deferReply();

  try {
    const backupService = new BackupService(guild.id, process.env.DISCORD_TOKEN!);
    const { template, stats } = await backupService.backup();

    const json = JSON.stringify(template, null, 2);
    const embed = new EmbedBuilder()
      .setTitle('📦 Server Backup Complete')
      .setColor(0x2ecc71)
      .addFields(
        { name: '📁 Categories', value: stats.categories.toString(), inline: true },
        { name: '💬 Channels', value: stats.channels.toString(), inline: true },
        { name: '👥 Roles', value: stats.roles.toString(), inline: true },
      )
      .setDescription(`Template ID: \`${template.id}\`\nUse \`/clawdiscord clone\` to apply this backup to another server.`)
      .setFooter({ text: 'ClawDiscord — Server Backup System' })
      .setTimestamp();

    // Send as attachment if too large for embed
    if (json.length > 1900) {
      const buffer = Buffer.from(json, 'utf-8');
      await interaction.editReply({
        embeds: [embed],
        files: [{ attachment: buffer, name: `${template.id}.json` }],
      });
    } else {
      embed.addFields({ name: 'Template JSON', value: `\`\`\`json\n${json.slice(0, 1000)}...\n\`\`\`` });
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error) {
    await interaction.editReply({ content: `❌ Backup failed: ${(error as Error).message}` });
  }
}

// ─── /clawdiscord analytics ───
async function handleAnalytics(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'Server only.', ephemeral: true });

  await interaction.deferReply();

  try {
    const analytics = new AnalyticsService(guild.id, process.env.DISCORD_TOKEN!);
    const report = await analytics.analyze();

    const scoreEmoji = report.health.score >= 80 ? '🟢' : report.health.score >= 60 ? '🟡' : '🔴';
    const scoreBar = '█'.repeat(Math.floor(report.health.score / 10)) + '░'.repeat(10 - Math.floor(report.health.score / 10));

    const embed = new EmbedBuilder()
      .setTitle(`📊 Server Health Report — ${report.server.name}`)
      .setColor(report.health.score >= 80 ? 0x2ecc71 : report.health.score >= 60 ? 0xf39c12 : 0xe74c3c)
      .addFields(
        { name: `${scoreEmoji} Health Score`, value: `\`${scoreBar}\` **${report.health.score}/100**`, inline: false },
        { name: '👥 Members', value: `${report.server.memberCount.toLocaleString()}${report.server.onlineCount ? ` (${report.server.onlineCount} online)` : ''}`, inline: true },
        { name: '🚀 Boost', value: `Level ${report.server.boostLevel} (${report.server.boostCount} boosts)`, inline: true },
        { name: '📅 Age', value: `${report.server.ageInDays} days`, inline: true },
        { name: '📁 Channels', value: `${report.channels.total} total\n${report.channels.text} text · ${report.channels.voice} voice · ${report.channels.forum} forum`, inline: true },
        { name: '👥 Roles', value: `${report.roles.total} total\n${report.roles.withPermissions.admin} admin · ${report.roles.withPermissions.moderator} mod · ${report.roles.managed} bot`, inline: true },
      )
      .setFooter({ text: 'ClawDiscord Analytics' })
      .setTimestamp();

    if (report.health.issues.length > 0) {
      embed.addFields({
        name: '⚠️ Issues',
        value: report.health.issues.slice(0, 5).map(i => `• ${i}`).join('\n'),
      });
    }

    if (report.health.recommendations.length > 0) {
      embed.addFields({
        name: '💡 Recommendations',
        value: report.health.recommendations.slice(0, 5).map(r => `• ${r}`).join('\n'),
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({ content: `❌ Analysis failed: ${(error as Error).message}` });
  }
}

// ─── /clawdiscord automod ───
async function handleAutoMod(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'Server only.', ephemeral: true });
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ Admin required.', ephemeral: true });
  }

  const preset = interaction.options.getString('preset', true);
  await interaction.deferReply();

  const presets: Record<string, AutoModConfig> = {
    light: { spam_filter: true },
    standard: { spam_filter: true, mention_limit: 5, invite_filter: true },
    strict: {
      spam_filter: true,
      mention_limit: 3,
      invite_filter: true,
      keyword_filter: ['free nitro', 'claim your prize', 'steam gift'],
      link_filter: true,
    },
  };

  const config = presets[preset];
  if (!config) {
    await interaction.editReply({ content: '❌ Invalid preset.' });
    return;
  }

  // Find a staff/mod-log channel for alerts
  const channels = guild.channels.cache;
  const alertChannel = channels.find(c =>
    c.name.includes('mod-log') || c.name.includes('audit') || c.name.includes('staff-log')
  );

  const automod = new AutoModService(guild.id, process.env.DISCORD_TOKEN!);
  const result = await automod.apply(config, alertChannel?.id);

  const embed = new EmbedBuilder()
    .setTitle(`🛡️ AutoMod Applied — ${preset.charAt(0).toUpperCase() + preset.slice(1)} Preset`)
    .setColor(0x5865f2)
    .addFields(
      { name: '✅ Rules Created', value: result.created.toString(), inline: true },
      { name: '📢 Alert Channel', value: alertChannel ? `#${alertChannel.name}` : 'None (create a #mod-log channel)', inline: true },
    )
    .setFooter({ text: 'Use /clawdiscord automod again to add more rules' })
    .setTimestamp();

  if (result.errors.length > 0) {
    embed.addFields({ name: '⚠️ Errors', value: result.errors.slice(0, 3).join('\n') });
  }

  await interaction.editReply({ embeds: [embed] });
}

// ─── /clawdiscord ai ───
async function handleAI(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'Server only.', ephemeral: true });
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ Admin required.', ephemeral: true });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return interaction.reply({
      content: '❌ AI Agent not configured. Set `ANTHROPIC_API_KEY` in the bot environment.',
      ephemeral: true,
    });
  }

  const description = interaction.options.getString('description', true);
  const style = (interaction.options.getString('style') || 'standard') as 'minimal' | 'standard' | 'maximal';

  await interaction.deferReply();

  const thinkingEmbed = new EmbedBuilder()
    .setTitle('🤖 AI Agent is designing your server...')
    .setColor(0x7c3aed)
    .setDescription(`**Your request:** "${description}"\n\n⏳ Generating custom template with AI...`)
    .setFooter({ text: 'Powered by Claude — this takes 5-15 seconds' });

  await interaction.editReply({ embeds: [thinkingEmbed] });

  const agent = new AIAgent(apiKey);
  const result = await agent.generateTemplate(description, { style });

  if (!result.template) {
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setTitle('❌ AI Generation Failed')
        .setColor(0xe74c3c)
        .setDescription(result.error || 'Unknown error. Try a more specific description.')
      ],
    });
    return;
  }

  const template = result.template;
  const totalChannels = template.categories.reduce((acc, c) => acc + c.channels.length, 0);

  const previewEmbed = new EmbedBuilder()
    .setTitle(`✨ AI Generated: ${template.name}`)
    .setColor(0x7c3aed)
    .setDescription(template.description || description)
    .addFields(
      { name: '📁 Categories', value: template.categories.length.toString(), inline: true },
      { name: '💬 Channels', value: totalChannels.toString(), inline: true },
      { name: '👥 Roles', value: template.roles.length.toString(), inline: true },
      { name: '🧠 Tokens Used', value: (result.tokensUsed || 0).toLocaleString(), inline: true },
    )
    .setFooter({ text: 'Review the template below, then click Apply to build your server' });

  // Show category preview
  const catPreview = template.categories
    .map(c => `**${c.name}** (${c.channels.length} ch)`)
    .join('\n');
  if (catPreview.length < 1024) {
    previewEmbed.addFields({ name: '📋 Structure', value: catPreview });
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('ai_apply').setLabel('✅ Apply to Server').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ai_cancel').setLabel('❌ Cancel').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ai_download').setLabel('📥 Download JSON').setStyle(ButtonStyle.Secondary),
  );

  const response = await interaction.editReply({ embeds: [previewEmbed], components: [row] });

  try {
    const btn = await (response as import('discord.js').Message).awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i: ButtonInteraction) => i.user.id === interaction.user.id,
      time: 60_000,
    });

    if (btn.customId === 'ai_cancel') {
      await btn.update({ content: '❌ Cancelled.', embeds: [], components: [] });
      return;
    }

    if (btn.customId === 'ai_download') {
      const json = JSON.stringify(template, null, 2);
      const buffer = Buffer.from(json, 'utf-8');
      await btn.update({
        content: '📥 Here\'s your AI-generated template:',
        embeds: [],
        components: [],
        files: [{ attachment: buffer, name: `${template.id || 'ai-template'}.json` }],
      });
      return;
    }

    // Apply the template
    activeSetups.add(guild.id);
    await btn.update({
      embeds: [new EmbedBuilder().setTitle('🔧 Building your AI-designed server...').setColor(0x5865f2)],
      components: [],
    });

    const setupService = new SetupService(guild.id, template as unknown as import('./services/setup.js').ServerTemplate, process.env.DISCORD_TOKEN!);
    const setupResult = await setupService.execute();
    activeSetups.delete(guild.id);

    // Apply automod if template has it
    if ((template as unknown as Record<string, unknown>).automod) {
      const automod = new AutoModService(guild.id, process.env.DISCORD_TOKEN!);
      await automod.apply((template as unknown as Record<string, unknown>).automod as AutoModConfig);
    }

    const resultEmbed = new EmbedBuilder()
      .setTitle(setupResult.success ? '✅ AI Server Built!' : '⚠️ Built with Errors')
      .setColor(setupResult.success ? 0x2ecc71 : 0xf39c12)
      .addFields(
        { name: '👥 Roles', value: setupResult.stats.roles.toString(), inline: true },
        { name: '📁 Categories', value: setupResult.stats.categories.toString(), inline: true },
        { name: '💬 Channels', value: setupResult.stats.channels.toString(), inline: true },
        { name: '📝 Embeds', value: setupResult.stats.embeds.toString(), inline: true },
        { name: '⏱️ Duration', value: `${(setupResult.duration / 1000).toFixed(1)}s`, inline: true },
      )
      .setDescription('🤖 This server was designed by AI based on your description.')
      .setFooter({ text: 'ClawDiscord AI — The future of Discord automation' })
      .setTimestamp();

    await interaction.editReply({ embeds: [resultEmbed] });
  } catch (error) {
    activeSetups.delete(guild.id);
    if ((error as Error).message?.includes('time')) {
      await interaction.editReply({ content: '⏰ Timed out.', embeds: [], components: [] });
    } else {
      await interaction.editReply({ content: `❌ Error: ${(error as Error).message?.slice(0, 200)}`, embeds: [], components: [] }).catch(() => {});
    }
  }
}

// ─── /clawdiscord clone ───
async function handleClone(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'Server only.', ephemeral: true });
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ Admin required.', ephemeral: true });
  }

  const targetGuildId = interaction.options.getString('target', true);

  await interaction.deferReply();

  try {
    // Backup current server
    const backupService = new BackupService(guild.id, process.env.DISCORD_TOKEN!);
    const { template, stats } = await backupService.backup();

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setTitle('📦 Backup complete, now cloning...')
        .setColor(0x5865f2)
        .setDescription(`Backed up ${stats.channels} channels, ${stats.roles} roles. Applying to target server...`)
      ],
    });

    // Apply to target
    const setupService = new SetupService(
      targetGuildId,
      template as unknown as import('./services/setup.js').ServerTemplate,
      process.env.DISCORD_TOKEN!
    );
    const result = await setupService.execute();

    const embed = new EmbedBuilder()
      .setTitle(result.success ? '✅ Server Cloned!' : '⚠️ Clone Completed with Errors')
      .setColor(result.success ? 0x2ecc71 : 0xf39c12)
      .addFields(
        { name: 'Source', value: guild.name, inline: true },
        { name: 'Target', value: targetGuildId, inline: true },
        { name: '📁 Categories', value: result.stats.categories.toString(), inline: true },
        { name: '💬 Channels', value: result.stats.channels.toString(), inline: true },
        { name: '👥 Roles', value: result.stats.roles.toString(), inline: true },
        { name: '⏱️ Duration', value: `${(result.duration / 1000).toFixed(1)}s`, inline: true },
      )
      .setFooter({ text: 'ClawDiscord — Server Cloning' })
      .setTimestamp();

    if (result.errors.length > 0) {
      embed.addFields({ name: '⚠️ Errors', value: result.errors.slice(0, 3).join('\n').slice(0, 1024) });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({ content: `❌ Clone failed: ${(error as Error).message}` });
  }
}

// ─── BOT STATUS ROTATION ───
function startStatusRotation(client: Client) {
  const statuses = [
    () => ({ name: `${client.guilds.cache.size} servers`, type: ActivityType.Watching as const }),
    () => ({ name: '/clawdiscord setup', type: ActivityType.Listening as const }),
    () => ({ name: 'AI-powered server builder', type: ActivityType.Playing as const }),
    () => ({ name: 'claw-discord.com', type: ActivityType.Watching as const }),
  ];

  let idx = 0;
  setInterval(() => {
    const status = statuses[idx % statuses.length]();
    client.user?.setPresence({
      activities: [{ name: status.name, type: status.type }],
      status: 'online',
    });
    idx++;
  }, 30_000); // Rotate every 30s
}

// ─── LOGIN ───
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN not set in environment');
  process.exit(1);
}

client.login(token);
