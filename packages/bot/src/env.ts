/**
 * Environment variable validation — crashes early with clear message
 */

interface EnvConfig {
  DISCORD_TOKEN: string;
  DISCORD_CLIENT_ID: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  NODE_ENV: string;
}

function required(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`\n❌ Missing required env var: ${name}`);
    console.error(`   Copy .env.example to .env and fill in the values.\n`);
    process.exit(1);
  }
  return val;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] || fallback;
}

export function validateEnv(): EnvConfig {
  const config: EnvConfig = {
    DISCORD_TOKEN: required('DISCORD_TOKEN'),
    DISCORD_CLIENT_ID: required('DISCORD_CLIENT_ID'),
    SUPABASE_URL: optional('SUPABASE_URL'),
    SUPABASE_SERVICE_KEY: optional('SUPABASE_SERVICE_KEY'),
    ANTHROPIC_API_KEY: optional('ANTHROPIC_API_KEY'),
    NODE_ENV: optional('NODE_ENV', 'development'),
  };

  // Warn about optional but recommended vars
  if (!config.SUPABASE_URL) {
    console.warn('⚠️  SUPABASE_URL not set — database features disabled');
  }
  if (!config.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY not set — AI agent (/ai command) disabled');
  }

  console.log('✅ Environment validated');
  return config;
}

export type { EnvConfig };
