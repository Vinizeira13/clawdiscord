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
import { handleGuildCreate } from './events/guildCreate.js';
import { SetupService } from './services/setup.js';

config();

const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1474410305609273598';

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
    .toJSON(),
];

// ─── CLIENT ───
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`🐾 ClawDiscord Bot ready! Logged in as ${c.user.tag}`);
  console.log(`   Serving ${c.guilds.cache.size} guilds`);

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

// ─── LOGIN ───
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN not set in environment');
  process.exit(1);
}

client.login(token);
