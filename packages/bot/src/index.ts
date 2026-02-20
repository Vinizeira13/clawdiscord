import { Client, GatewayIntentBits, Events } from 'discord.js';
import { config } from 'dotenv';
import { handleGuildCreate } from './events/guildCreate.js';

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`🐾 ClawDiscord Bot ready! Logged in as ${c.user.tag}`);
  console.log(`   Serving ${c.guilds.cache.size} guilds`);
});

client.on(Events.GuildCreate, handleGuildCreate);

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  // Future: slash commands
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN not set in environment');
  process.exit(1);
}

client.login(token);
