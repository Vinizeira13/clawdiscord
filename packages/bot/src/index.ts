import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { config } from 'dotenv';
import { handleGuildCreate } from './events/guildCreate.js';

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

// ─── LOGIN ───
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN not set in environment');
  process.exit(1);
}

client.login(token);
