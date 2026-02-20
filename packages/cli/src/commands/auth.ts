import Conf from 'conf';
import inquirer from 'inquirer';
import { logger } from '../utils/logger.js';

const config = new Conf({ projectName: 'clawdiscord' });

interface AuthOptions {
  token?: string;
}

export async function authCommand(options: AuthOptions) {
  let token = options.token;

  if (!token) {
    const { inputToken } = await inquirer.prompt([
      {
        type: 'password',
        name: 'inputToken',
        message: 'Enter your ClawDiscord API token:',
        mask: '*',
      },
    ]);
    token = inputToken;
  }

  config.set('apiToken', token);
  config.set('authenticated', true);
  logger.success('Authenticated successfully! Token saved.');
}

export function getToken(): string | null {
  return config.get('apiToken') as string | null;
}

export function isAuthenticated(): boolean {
  return config.get('authenticated') === true;
}
