import type { Guild } from 'discord.js';

export async function handleGuildCreate(guild: Guild) {
  console.log(`📥 Joined guild: ${guild.name} (${guild.id})`);
  console.log(`   Members: ${guild.memberCount}`);
  console.log(`   Owner: ${guild.ownerId}`);

  // Future: Auto-detect if this guild has a pending setup
  // and apply the template automatically

  // For now, log the event for tracking
  try {
    // TODO: Record in Supabase
    console.log(`✅ Guild ${guild.name} registered for setup`);
  } catch (error) {
    console.error(`❌ Failed to process guild ${guild.name}:`, error);
  }
}
