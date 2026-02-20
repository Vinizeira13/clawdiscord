/**
 * ClawDiscord AI Agent — Powered by Claude API
 *
 * Generates fully custom Discord server templates from natural language descriptions.
 * This is the core differentiator: users describe their community, AI designs the perfect server.
 */

import type { ServerTemplate } from './setup.js';

// ─── SYSTEM PROMPT ───
const SYSTEM_PROMPT = `You are ClawDiscord AI — an expert Discord server architect.
Your job: take a user's community description and generate a COMPLETE Discord server template JSON.

You are the BEST at designing Discord servers. You understand:
- Channel organization (categories, naming conventions, channel types)
- Role hierarchies (position matters: higher = more power)
- Permission systems (staff_only, role_locked, read-only patterns)
- Engagement mechanics (forums, threads, voice channels, events)
- Moderation setup (automod rules, slowmode, verification)
- Community features (onboarding, welcome embeds, rules channels)

RULES:
1. Generate VALID JSON matching the ServerTemplate schema
2. Every server MUST have: welcome/rules category, staff category, general chat
3. Roles MUST be sorted by position (lowest first, highest last)
4. Staff roles MUST have position >= 12
5. Include rich embeds for rules, welcome, and key info channels
6. Announcement channels for important updates
7. Voice channels with appropriate user limits
8. Forum channels for support/feedback when relevant
9. Appropriate slowmode values (0-21600 seconds)
10. AutoMod rules tailored to the community type
11. Onboarding prompts for new member discovery

CHANNEL TYPES: text, voice, announcement, forum, stage
PERMISSION PATTERNS: staff_only, role_locked, read-only (send_messages: false)

Always include automod config and onboarding config in the template.

Respond ONLY with valid JSON. No markdown, no explanation, just the JSON template.`;

// ─── TEMPLATE SCHEMA FOR AI ───
const SCHEMA_HINT = `
ServerTemplate JSON schema:
{
  "id": "custom-<slug>",
  "name": "Display Name",
  "description": "One-line description",
  "categories": [
    {
      "name": "CATEGORY NAME (uppercase)",
      "channels": [
        {
          "name": "channel-name (lowercase-kebab)",
          "type": "text|voice|announcement|forum|stage",
          "topic": "Channel description",
          "slowmode": 0,
          "nsfw": false,
          "user_limit": 10,  // voice only
          "permissions": {
            "everyone": { "send_messages": true, "view_channel": true },
            "staff_only": false,
            "role_locked": "RoleName"  // optional: only this role can see
          },
          "embed": {  // optional: auto-post embed on creation
            "title": "Embed Title",
            "description": "Embed content with **markdown**",
            "color": "#5865F2",
            "fields": [{ "name": "Field", "value": "Value", "inline": true }],
            "footer": "Footer text"
          },
          "tags": ["tag1"]  // forum only
        }
      ]
    }
  ],
  "roles": [
    {
      "name": "Role Name",
      "color": "#HEX",
      "hoist": false,
      "mentionable": false,
      "position": 1,
      "permissions": ["SEND_MESSAGES", "VIEW_CHANNEL", "ADD_REACTIONS"]
    }
  ],
  "settings": {
    "verification_level": 1,
    "default_notifications": 1,
    "explicit_content_filter": 2
  },
  "automod": {
    "spam_filter": true,
    "mention_limit": 5,
    "keyword_filter": ["slur1", "spam_word"],
    "link_filter": false,
    "invite_filter": true
  },
  "onboarding": {
    "enabled": true,
    "prompts": [
      {
        "title": "What brings you here?",
        "options": [
          { "title": "Option", "emoji": "🎮", "roles": ["RoleName"], "channels": ["channel-name"] }
        ]
      }
    ]
  }
}`;

// ─── AI AGENT CLASS ───
export class AIAgent {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'claude-sonnet-4-5-20250929') {
    this.apiKey = apiKey;
    this.model = model;
  }

  /**
   * Generate a complete server template from a natural language description.
   */
  async generateTemplate(userDescription: string, options?: {
    maxChannels?: number;
    maxRoles?: number;
    style?: 'minimal' | 'standard' | 'maximal';
  }): Promise<{ template: ServerTemplate | null; error?: string; tokensUsed?: number }> {
    const style = options?.style || 'standard';
    const maxCh = options?.maxChannels || (style === 'minimal' ? 20 : style === 'maximal' ? 60 : 35);
    const maxRoles = options?.maxRoles || (style === 'minimal' ? 10 : style === 'maximal' ? 35 : 20);

    const userPrompt = `Design a Discord server for this community:

"${userDescription}"

Requirements:
- Style: ${style} (${maxCh} max channels, ${maxRoles} max roles)
- Include automod rules appropriate for this community
- Include onboarding prompts for new members
- Make it professional and engaging
- Include welcome embeds with community info
- Add appropriate forum/voice channels

${SCHEMA_HINT}

Generate the complete template JSON now:`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 8000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        return { template: null, error: `API error ${response.status}: ${errBody.slice(0, 200)}` };
      }

      const data = await response.json() as {
        content: Array<{ type: string; text: string }>;
        usage: { input_tokens: number; output_tokens: number };
      };

      const text = data.content?.[0]?.text || '';
      const tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);

      // Parse JSON — handle potential markdown wrapping
      let jsonStr = text.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const template = JSON.parse(jsonStr) as ServerTemplate;

      // Validate
      if (!template.name || !Array.isArray(template.categories) || !Array.isArray(template.roles)) {
        return { template: null, error: 'AI generated invalid template (missing required fields)', tokensUsed };
      }

      return { template, tokensUsed };
    } catch (error) {
      if (error instanceof SyntaxError) {
        return { template: null, error: 'AI response was not valid JSON. Try again with a clearer description.' };
      }
      return { template: null, error: (error as Error).message };
    }
  }

  /**
   * Enhance an existing template with AI suggestions.
   */
  async enhanceTemplate(template: ServerTemplate, instruction: string): Promise<{
    template: ServerTemplate | null;
    error?: string;
  }> {
    const prompt = `Here's an existing Discord server template:

${JSON.stringify(template, null, 2)}

User wants to enhance it:
"${instruction}"

Return the COMPLETE modified template as valid JSON. Keep all existing good parts, add/modify based on the instruction.

${SCHEMA_HINT}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 8000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        return { template: null, error: `API error ${response.status}` };
      }

      const data = await response.json() as { content: Array<{ text: string }> };
      let jsonStr = (data.content?.[0]?.text || '').trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      return { template: JSON.parse(jsonStr) as ServerTemplate };
    } catch (error) {
      return { template: null, error: (error as Error).message };
    }
  }

  /**
   * Analyze a server and suggest improvements.
   */
  async analyzeServer(serverData: {
    name: string;
    channels: Array<{ name: string; type: number; parent?: string }>;
    roles: Array<{ name: string; position: number; color: number }>;
    memberCount: number;
  }): Promise<{ suggestions: string; error?: string }> {
    const prompt = `Analyze this Discord server and suggest improvements:

Server: ${serverData.name} (${serverData.memberCount} members)
Channels (${serverData.channels.length}): ${serverData.channels.map(c => c.name).join(', ')}
Roles (${serverData.roles.length}): ${serverData.roles.map(r => r.name).join(', ')}

Give 5-10 specific, actionable suggestions to improve this server's:
1. Organization (channel/category structure)
2. Engagement (features to add)
3. Moderation (safety improvements)
4. Growth (how to attract/retain members)

Be specific — reference actual channel/role names. Format as bullet points.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        return { suggestions: '', error: `API error ${response.status}` };
      }

      const data = await response.json() as { content: Array<{ text: string }> };
      return { suggestions: data.content?.[0]?.text || '' };
    } catch (error) {
      return { suggestions: '', error: (error as Error).message };
    }
  }
}
