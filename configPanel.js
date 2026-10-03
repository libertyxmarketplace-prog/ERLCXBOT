import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { getBotInstance } from './botManager.js';
import { AI_CAPABILITIES } from './aiConfigAssistant.js';
import { getPanelBottomBanner } from './panelMenu.js';
import { activeCustomerClients } from './customerBotRunner.js';

export const TOTAL_PAGES = 8;

// Human-friendly page map used by the "Jump to page" dropdown
const PAGE_OPTIONS = [
  { page: 1, label: '1 · Credentials & Setup', description: 'Token, API key, server details' },
  { page: 2, label: '2 · Ticket Categories', description: 'Names, spawn channels, ping roles' },
  { page: 3, label: '3 · Ticket Appearance', description: 'Panel text, banners, rules' },
  { page: 4, label: '4 · Live Sessions', description: 'Channels, roles, session banners' },
  { page: 5, label: '5 · Staff Applications', description: 'Review channels and questions' },
  { page: 6, label: '6 · Staff Documentation', description: 'Handbooks, layout, banners' },
  { page: 7, label: '7 · Staff & Community', description: 'Roles, welcome, promotions, logs' },
  { page: 8, label: '8 · AI Assistant', description: 'API key and smart setup' }
];

export const EMOJIS = {
  CHECK: '<:checkmark:1552901024400932894>',
  CROSS: '<:xmark:1552901454098989056>',
  BTN_ARROW_LEFT: { id: '1552907890681970688', name: 'left' },
  BTN_ARROW_RIGHT: { id: '1552909020833259520', name: 'right' }
};

export const DEFAULT_BOTTOM_BANNER = null;

function maskSecret(str) {
  if (!str || typeof str !== 'string' || str.trim() === '') return 'Not Set';
  if (str.length <= 8) return '********';
  return `${str.slice(0, 4)}...${str.slice(-4)}`;
}

function statusBadge(isConfigured) {
  return isConfigured ? EMOJIS.CHECK : EMOJIS.CROSS;
}

// Clean "✅ Configured" / "❌ Not set" text — no backticks, no clutter
function statusText(isConfigured, yesLabel = 'Configured', noLabel = 'Not set') {
  return isConfigured ? `${EMOJIS.CHECK} ${yesLabel}` : `${EMOJIS.CROSS} ${noLabel}`;
}

/**
 * Build the interactive /config control panel payload using Discord Components V2 Container (type 17)
 */
export function buildConfigPanelPayload(botId, page = 1, includeAttachment = true) {
  const bot = getBotInstance(botId);
  if (!bot) {
    return {
      flags: 32768,
      components: [
        {
          type: 17,
          components: [
            {
              type: 10,
              content: `# ❌ Bot Not Found\n-# No instance matches **${botId}**. Run /config again with a valid Bot ID.`
            }
          ]
        }
      ]
    };
  }

  const cust = bot.customizations || {};
  const activePage = Math.max(1, Math.min(TOTAL_PAGES, page));

  const containerComponents = [];
  const files = [];

  switch (activePage) {
    // ══════════════════════════════════════════════════════════════════════
    // PAGE 1: BOT SETUP (1/8)
    // ══════════════════════════════════════════════════════════════════════
    case 1: {
      const srvName = cust.serverName?.trim() || '*Not Set*';
      const joinCode = cust.joinCode?.trim() || '*Not Set*';
      const hasToken = Boolean(bot.token && bot.token.trim().length > 0);
      const hasApiKey = Boolean(bot.erlcApiKey && bot.erlcApiKey.trim().length > 0);
      const isClientOnline = activeCustomerClients.has(botId);
      const botStatus = bot.banned
        ? 'Suspended'
        : (isClientOnline ? 'Online' : (bot.status === 'invalid_token' ? 'Invalid Token' : (hasToken ? 'Active' : 'Unconfigured')));

      let discordBotId = bot.discordBotId || null;
      if (!discordBotId && hasToken) {
        try {
          const rawId = Buffer.from(bot.token.split('.')[0], 'base64').toString('utf-8');
          if (/^\d{17,20}$/.test(rawId)) {
            discordBotId = rawId;
          }
        } catch {}
      }

      const discordBotDisplay = discordBotId
        ? `<@${discordBotId}>`
        : (hasToken ? 'Token linked' : 'Not linked');

      const ownerDisplay = (bot.ownerUserId && bot.ownerUserId !== 'OWNER')
        ? `<@${bot.ownerUserId}>`
        : 'Server administrators';

      containerComponents.push({
        type: 10,
        content: [
          `# ⚙️ Credentials & Setup`,
          `-# Page 1 of 8 • Instance ${botId}`,
          ``,
          `### Connection`,
          `**Discord Bot:** ${discordBotDisplay}`,
          `**Bot Token:** ${statusText(hasToken)}`,
          `**ER:LC API Key:** ${statusText(hasApiKey)}`,
          `**Status:** ${botStatus}`,
          ``,
          `### In-Game Server`,
          `**Community Name:** ${cust.serverName?.trim() || 'Not set'}`,
          `**Join Code:** ${cust.joinCode?.trim() || 'Not set'}`,
          ``,
          `### Ownership`,
          `**Assigned Owner:** ${ownerDisplay}`,
          ``,
          `-# Use the buttons below to edit credentials and server details.`
        ].join('\n')
      });

      containerComponents.push({ type: 14, divider: true, spacing: 1 });

      const page1Buttons = [
        {
          type: 2,
          style: 1,
          label: 'Edit Credentials',
          custom_id: `cfg_btn_creds_${botId}`
        },
        {
          type: 2,
          style: 2,
          label: 'Server Details',
          custom_id: `cfg_btn_servercore_${botId}`
        }
      ];

      if (discordBotId) {
        page1Buttons.push({
          type: 2,
          style: 5,
          label: 'Invite Bot',
          url: `https://discord.com/oauth2/authorize?client_id=${discordBotId}&permissions=8&scope=bot%20applications.commands`
        });
      }

      containerComponents.push({
        type: 1,
        components: page1Buttons
      });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 2: TICKET CATEGORIES (2/8)
    // ══════════════════════════════════════════════════════════════════════
    case 2: {
      const srvName = cust.serverName?.trim() || 'Community Server';
      const defaultCategories = [
        { id: "cat_1", name: "General Support", spawnCategoryId: "", pingRoleId: "" },
        { id: "cat_2", name: "High Rank", spawnCategoryId: "", pingRoleId: "" },
        { id: "cat_3", name: "Player Report", spawnCategoryId: "", pingRoleId: "" },
        { id: "cat_4", name: "Appeals", spawnCategoryId: "", pingRoleId: "" },
        { id: "cat_5", name: "Other", spawnCategoryId: "", pingRoleId: "" }
      ];
      const categories = Array.isArray(cust.ticketCategories) && cust.ticketCategories.length > 0
        ? cust.ticketCategories
        : defaultCategories;

      const catBullets = categories.map((c, i) => {
        const n = i + 1;
        const name = c.name || `Slot ${n}`;
        if (!c.spawnCategoryId) return `**${n}. ${name}** — ${EMOJIS.CROSS} Not set up`;
        const ping = c.pingRoleId ? ` • ping <@&${c.pingRoleId}>` : '';
        return `**${n}. ${name}** — ${EMOJIS.CHECK} <#${c.spawnCategoryId}>${ping}`;
      }).join('\n');

      const transChannel = cust.transcriptsChannelId ? `${EMOJIS.CHECK} <#${cust.transcriptsChannelId}>` : `${EMOJIS.CROSS} Not set`;
      const claimRole = cust.ticketClaimRoleId ? `${EMOJIS.CHECK} <@&${cust.ticketClaimRoleId}>` : `${EMOJIS.CROSS} Default staff`;

      containerComponents.push({
        type: 10,
        content: [
          `# 🎫 Ticket Categories`,
          `-# Page 2 of 8 • Instance ${botId}`,
          ``,
          `### Categories`,
          catBullets,
          ``,
          `### Archiving`,
          `**Transcripts:** ${transChannel}`,
          `**Claim Role:** ${claimRole}`,
          ``,
          `-# Use the dropdown below to edit names, spawns, or ping roles.`
        ].join('\n')
      });

      containerComponents.push({ type: 14, divider: true, spacing: 1 });

      containerComponents.push({
        type: 1,
        components: [
          {
            type: 3,
            custom_id: `cfg_select_action_${botId}`,
            placeholder: 'Choose a ticket setting to edit...',
            options: [
              {
                label: 'Category Names',
                value: 'edit_ticket_catnames',
                description: 'Customize names for buttons 1 through 5'
              },
              {
                label: 'Category Spawn Channels',
                value: 'edit_ticket_catspawns',
                description: 'Set where each category opens ticket channels'
              },
              {
                label: 'Category Ping Roles',
                value: 'edit_ticket_catpings',
                description: 'Set staff roles alerted when each ticket opens'
              },
              {
                label: 'Claim Role & Transcripts',
                value: 'edit_ticket_banners',
                description: 'Set who can claim tickets and transcript destination'
              }
            ]
          }
        ]
      });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 3: TICKET APPEARANCE & GUIDELINES (3/8)
    // ══════════════════════════════════════════════════════════════════════
    case 3: {
      const srvName = cust.serverName?.trim() || 'Community Server';
      const insideBanner = cust.ticketInsideBannerUrl ? `${EMOJIS.CHECK} Custom` : `${EMOJIS.CROSS} Default`;
      const topBanner = cust.topBannerUrl ? `${EMOJIS.CHECK} Custom` : `${EMOJIS.CROSS} Default`;
      const bottomBanner = cust.bottomBannerUrl ? `${EMOJIS.CHECK} Custom` : `${EMOJIS.CROSS} Default`;
      const openGreeting = cust.ticketOpenMessage ? `"${cust.ticketOpenMessage.slice(0, 50)}..."` : 'Default support welcome';
      const showRules = cust.showRulesButton !== false;

      containerComponents.push({
        type: 10,
        content: [
          `# 🎨 Ticket Appearance`,
          `-# Page 3 of 8 • Instance ${botId}`,
          ``,
          `### Panel`,
          `**Title:** ${cust.panelTitle || 'Support'}`,
          `**Header Banner:** ${topBanner}`,
          `**Inside Banner:** ${insideBanner}`,
          `**Bottom Accent:** ${bottomBanner}`,
          ``,
          `### Rules & Greeting`,
          `**Rules Button:** ${showRules ? `${EMOJIS.CHECK} Visible` : `${EMOJIS.CROSS} Hidden`}`,
          `**Rules Title:** ${cust.rulesTitle || 'Support Rules'}`,
          `**Rules Content:** ${cust.rulesDescription ? `${EMOJIS.CHECK} Custom` : `${EMOJIS.CROSS} Default`}`,
          `**Greeting:** ${openGreeting}`,
          ``,
          `-# Use the dropdown below to edit text, banners, or guidelines.`
        ].join('\n')
      });

      containerComponents.push({ type: 14, divider: true, spacing: 1 });

      containerComponents.push({
        type: 1,
        components: [
          {
            type: 3,
            custom_id: `cfg_select_action_${botId}`,
            placeholder: 'Choose a setting to edit...',
            options: [
              {
                label: 'Edit Ticket Text & Guidelines',
                value: 'edit_ticket_text',
                description: 'Change panel title, description, rules, and greeting'
              },
              {
                label: 'Edit Ticket Banners',
                value: 'edit_ticket_banners',
                description: 'Change top header, inside ticket, and bottom banners'
              }
            ]
          }
        ]
      });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 4: SERVER SESSIONS (4/8)
    // ══════════════════════════════════════════════════════════════════════
    case 4: {
      const srvName = cust.serverName?.trim() || 'Community Server';
      const sessChannel = cust.sessionChannelId ? `${EMOJIS.CHECK} <#${cust.sessionChannelId}>` : `${EMOJIS.CROSS} Not set`;
      const ingameVc = cust.ingameVcId ? `${EMOJIS.CHECK} <#${cust.ingameVcId}>` : `${EMOJIS.CROSS} Not set`;
      const queueVc = cust.queueVcId ? `${EMOJIS.CHECK} <#${cust.queueVcId}>` : `${EMOJIS.CROSS} Not set`;
      const notifyRole = cust.notificationRoleId ? `${EMOJIS.CHECK} <@&${cust.notificationRoleId}>` : `${EMOJIS.CROSS} Not set`;
      const hostRole = cust.hostRoleId ? `${EMOJIS.CHECK} <@&${cust.hostRoleId}>` : `${EMOJIS.CROSS} Not set`;

      const liveBanner = cust.sessionTopBannerUrl ? `${EMOJIS.CHECK} Custom` : `${EMOJIS.CROSS} Default`;
      const shutBanner = cust.sessionShutdownBannerUrl ? `${EMOJIS.CHECK} Custom` : `${EMOJIS.CROSS} Default`;
      const voteBanner = cust.sessionVoteTopBannerUrl ? `${EMOJIS.CHECK} Custom` : `${EMOJIS.CROSS} Default`;

      containerComponents.push({
        type: 10,
        content: [
          `# 🚔 Live Sessions`,
          `-# Page 4 of 8 • Instance ${botId}`,
          ``,
          `### Channels`,
          `**Announcements:** ${sessChannel}`,
          `**In-Game Radio:** ${ingameVc}`,
          `**Queue Staging:** ${queueVc}`,
          ``,
          `### Roles`,
          `**Session Host:** ${hostRole}`,
          `**Staff Alerts:** ${notifyRole}`,
          ``,
          `### Banners`,
          `**Live:** ${liveBanner} • **Vote:** ${voteBanner} • **Shutdown:** ${shutBanner}`,
          ``,
          `-# Use the dropdown below to edit channels, roles, or banners.`
        ].join('\n')
      });

      containerComponents.push({ type: 14, divider: true, spacing: 1 });

      containerComponents.push({
        type: 1,
        components: [
          {
            type: 3,
            custom_id: `cfg_select_action_${botId}`,
            placeholder: 'Choose a session setting to edit...',
            options: [
              {
                label: 'Session Channels & Roles',
                value: 'edit_session_channels',
                description: 'Set announcement channel, radio VCs, host and alert roles'
              },
              {
                label: 'Session Banners',
                value: 'edit_session_banners',
                description: 'Update live, vote, and shutdown top/bottom banners'
              },
              {
                label: 'Session Announcement Text',
                value: 'edit_session_text',
                description: 'Customize startup and conclusion headlines'
              }
            ]
          }
        ]
      });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 5: STAFF APPLICATIONS (5/8)
    // ══════════════════════════════════════════════════════════════════════
    case 5: {
      const srvName = cust.serverName?.trim() || 'Community Server';
      const revChannel = cust.reviewChannelId ? `${EMOJIS.CHECK} <#${cust.reviewChannelId}>` : `${EMOJIS.CROSS} Not set`;
      const resChannel = cust.resultsChannelId ? `${EMOJIS.CHECK} <#${cust.resultsChannelId}>` : `${EMOJIS.CROSS} Not set`;
      const isIngameOpen = cust.appIngameOpen !== false;
      const isDiscordOpen = cust.appDiscordOpen !== false;

      const ingameQCount = Array.isArray(cust.appQuestionsIngame) ? cust.appQuestionsIngame.length : 5;
      const discordQCount = Array.isArray(cust.appQuestionsDiscord) ? cust.appQuestionsDiscord.length : 5;

      containerComponents.push({
        type: 10,
        content: [
          `# 📋 Staff Applications`,
          `-# Page 5 of 8 • Instance ${botId}`,
          ``,
          `### Channels`,
          `**Review Feed:** ${revChannel}`,
          `**Results Channel:** ${resChannel}`,
          ``,
          `### Departments`,
          `**In-Game Moderator:** ${isIngameOpen ? `${EMOJIS.CHECK} Open` : `${EMOJIS.CROSS} Closed`}`,
          `**Discord Moderator:** ${isDiscordOpen ? `${EMOJIS.CHECK} Open` : `${EMOJIS.CROSS} Closed`}`,
          ``,
          `### Questions`,
          `**In-Game Bank:** ${ingameQCount} questions`,
          `**Discord Bank:** ${discordQCount} questions`,
          ``,
          `-# Use the dropdown below to edit channels or question banks.`
        ].join('\n')
      });

      containerComponents.push({ type: 14, divider: true, spacing: 1 });

      containerComponents.push({
        type: 1,
        components: [
          {
            type: 3,
            custom_id: `cfg_select_action_${botId}`,
            placeholder: 'Choose an application setting to edit...',
            options: [
              {
                label: 'Application Channels',
                value: 'edit_app_channels',
                description: 'Set review channel and results channel'
              },
              {
                label: 'In-Game Moderator Questions',
                value: 'edit_app_questions_ingame',
                description: 'Customize up to 20 in-game staff interview questions'
              },
              {
                label: 'Discord Moderator Questions',
                value: 'edit_app_questions_discord',
                description: 'Customize up to 20 Discord moderation interview questions'
              }
            ]
          }
        ]
      });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 6: STAFF DOCUMENTATION (6/8)
    // ══════════════════════════════════════════════════════════════════════
    case 6: {
      const srvName = cust.serverName?.trim() || 'Community Server';
      const staffChan = cust.staffDocsChannelId ? `${EMOJIS.CHECK} <#${cust.staffDocsChannelId}>` : `${EMOJIS.CROSS} Not set`;
      const layoutMode = cust.staffDocsLayout === 'buttons' ? 'Buttons' : 'Dropdown menu';

      const topBannerStatus = cust.staffDocsTopBannerUrl ? `${EMOJIS.CHECK} Custom` : `${EMOJIS.CROSS} Default`;
      const bottomBannerStatus = cust.staffDocsBottomBannerUrl ? `${EMOJIS.CHECK} Custom` : `${EMOJIS.CROSS} Default`;

      containerComponents.push({
        type: 10,
        content: [
          `# 📚 Staff Documentation`,
          `-# Page 6 of 8 • Instance ${botId}`,
          ``,
          `### Hub`,
          `**Channel:** ${staffChan}`,
          `**Layout:** ${layoutMode}`,
          `**Title:** ${cust.staffDocsTitle || 'Official Staff Documentation'}`,
          ``,
          `### Graphics`,
          `**Top Banner:** ${topBannerStatus}`,
          `**Bottom Banner:** ${bottomBannerStatus}`,
          ``,
          `-# Use the dropdown below to edit content, banners, or the channel.`
        ].join('\n')
      });

      containerComponents.push({ type: 14, divider: true, spacing: 1 });

      containerComponents.push({
        type: 1,
        components: [
          {
            type: 3,
            custom_id: `cfg_select_action_${botId}`,
            placeholder: 'Choose a documentation setting to edit...',
            options: [
              {
                label: 'Documentation Text & Layout',
                value: 'edit_staffdocs_content',
                description: 'Set hub title, text description, and buttons vs select menu'
              },
              {
                label: 'Documentation Banners',
                value: 'edit_staffdocs_banners',
                description: 'Set top banner and bottom banner URLs'
              },
              {
                label: 'Documentation Channel',
                value: 'edit_staffdocs_channel',
                description: 'Set destination channel for documentation hub'
              }
            ]
          }
        ]
      });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 7: STAFF MODERATION (7/8)
    // ══════════════════════════════════════════════════════════════════════
    case 7: {
      const srvName = cust.serverName?.trim() || 'Community Server';
      const staffRole = cust.botStaffRoleId ? `${EMOJIS.CHECK} <@&${cust.botStaffRoleId}>` : `${EMOJIS.CROSS} Admins only`;
      const infrChan = cust.infractionsChannelId ? `${EMOJIS.CHECK} <#${cust.infractionsChannelId}>` : `${EMOJIS.CROSS} Not set`;
      const promChan = cust.promotionsChannelId ? `${EMOJIS.CHECK} <#${cust.promotionsChannelId}>` : `${EMOJIS.CROSS} Not set`;
      const infrRole = cust.infractionStaffRoleId ? `${EMOJIS.CHECK} <@&${cust.infractionStaffRoleId}>` : `${EMOJIS.CROSS} None`;
      const promRole = cust.promotionStaffRoleId ? `${EMOJIS.CHECK} <@&${cust.promotionStaffRoleId}>` : `${EMOJIS.CROSS} None`;

      const promBanner = cust.promoteBannerUrl ? `${EMOJIS.CHECK} Custom` : `${EMOJIS.CROSS} Default`;
      const infrBanner = cust.infractBannerUrl ? `${EMOJIS.CHECK} Custom` : `${EMOJIS.CROSS} Default`;

      const welcomeChan = cust.welcomeChannelId ? `${EMOJIS.CHECK} <#${cust.welcomeChannelId}>` : `${EMOJIS.CROSS} Not set`;
      const welcomeStatus = cust.welcomeEnabled && cust.welcomeChannelId ? `${EMOJIS.CHECK} Enabled` : `${EMOJIS.CROSS} Disabled`;

      containerComponents.push({
        type: 10,
        content: [
          `# 🛡️ Staff & Community`,
          `-# Page 7 of 8 • Instance ${botId}`,
          ``,
          `### Access`,
          `**Staff Role:** ${staffRole}`,
          ``,
          `### Welcome`,
          `**Channel:** ${welcomeChan}`,
          `**Status:** ${welcomeStatus}`,
          ``,
          `### Promotions`,
          `**Channel:** ${promChan}`,
          `**Role:** ${promRole} • **Banner:** ${promBanner}`,
          ``,
          `### Infractions`,
          `**Channel:** ${infrChan}`,
          `**Role:** ${infrRole} • **Banner:** ${infrBanner}`,
          ``,
          `-# Use the buttons or dropdown below to edit these settings.`
        ].join('\n')
      });

      containerComponents.push({ type: 14, divider: true, spacing: 1 });

      containerComponents.push({
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            label: 'Set Staff Role',
            custom_id: `cfg_btn_staffrole_${botId}`
          },
          {
            type: 2,
            style: 2,
            label: 'Welcome Settings',
            custom_id: `cfg_btn_welcome_${botId}`
          }
        ]
      });

      containerComponents.push({
        type: 1,
        components: [
          {
            type: 3,
            custom_id: `cfg_select_action_${botId}`,
            placeholder: 'Choose a moderation or community setting to edit...',
            options: [
              {
                label: 'Staff Management Role',
                value: 'edit_staffrole',
                description: 'Set authorized staff role for bot management & commands'
              },
              {
                label: 'Welcome System Settings',
                value: 'edit_welcome',
                description: 'Enable/disable welcome cards, set channel, text, and banner'
              },
              {
                label: 'Promotion Settings',
                value: 'edit_promotions',
                description: 'Set promotion channel, ping role, and banners'
              },
              {
                label: 'Infraction Settings',
                value: 'edit_infractions',
                description: 'Set infraction channel, ping role, and banners'
              }
            ]
          }
        ]
      });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 8: AI ASSISTANT (8/8)
    // ══════════════════════════════════════════════════════════════════════
    case 8: {
      const srvName = cust.serverName?.trim() || 'Community Server';
      const activeAiProv = (cust.aiProvider || bot.aiProvider || 'openrouter').toUpperCase();
      const hasAiKey = Boolean(cust.aiApiKey || bot.aiApiKey);
      const activeModel = cust.aiModel || (activeAiProv === 'GEMINI' ? 'gemini-1.5-flash' : activeAiProv === 'GROQ' ? 'llama-3.3-70b' : 'gpt-4o-mini');

      containerComponents.push({
        type: 10,
        content: [
          `# 🤖 AI Assistant`,
          `-# Page 8 of 8 • Instance ${botId}`,
          ``,
          `### Status`,
          `**Provider:** ${activeAiProv}`,
          `**API Key:** ${statusText(hasAiKey, 'Connected', 'Not set')}`,
          `**Model:** ${activeModel}`,
          ``,
          `### What it can do`,
          `• Rewrite ticket panels, welcome messages, and rules`,
          `• Set up radios, queue channels, and staff roles`,
          `• Update or clear banners across every module`,
          ``,
          `-# Use the dropdown below to connect a key or ask the assistant.`
        ].join('\n')
      });

      containerComponents.push({ type: 14, divider: true, spacing: 1 });

      containerComponents.push({
        type: 1,
        components: [
          {
            type: 3,
            custom_id: `cfg_select_action_${botId}`,
            placeholder: 'Choose an AI action...',
            options: [
              {
                label: 'Set API Key & Provider',
                value: 'edit_ai_key',
                description: 'Connect your OpenRouter, Groq, Gemini, or OpenAI Key'
              },
              {
                label: 'Ask AI Assistant',
                value: 'ask_ai',
                description: 'Prompt the AI assistant to adjust settings'
              }
            ]
          }
        ]
      });
      break;
    }
  }

  // Quick "Jump to page" dropdown (wired to the existing cfg_select_page_ handler)
  containerComponents.push({
    type: 1,
    components: [
      {
        type: 3,
        custom_id: `cfg_select_page_${botId}`,
        placeholder: 'Jump to page…',
        options: PAGE_OPTIONS.map(opt => ({
          label: opt.label,
          description: opt.description,
          value: String(opt.page),
          default: opt.page === activePage
        }))
      }
    ]
  });

  // Master Navigation Controls (Left arrow, Right arrow, Refresh, and Helper on the far side)
  containerComponents.push({
    type: 1,
    components: [
      {
        type: 2,
        style: 2,
        emoji: EMOJIS.BTN_ARROW_LEFT,
        custom_id: `cfg_nav_prev_${botId}_${activePage}`,
        disabled: activePage <= 1
      },
      {
        type: 2,
        style: 2,
        emoji: EMOJIS.BTN_ARROW_RIGHT,
        custom_id: `cfg_nav_next_${botId}_${activePage}`,
        disabled: activePage >= TOTAL_PAGES
      },
      {
        type: 2,
        style: 2,
        label: 'Refresh',
        custom_id: `cfg_nav_refresh_${botId}_${activePage}`
      },
      {
        type: 2,
        style: 3, // Success Green on the far side
        label: 'Helper',
        custom_id: `cfg_btn_ai_helper_${botId}`
      }
    ]
  });

  // Bottom Accent Strip (Uploaded Banner or Local Fallback)
  const bottomBanner = getPanelBottomBanner(cust.bottomBannerUrl);
  if (bottomBanner.mediaUrl) {
    containerComponents.push({
      type: 12,
      items: [{ media: { url: bottomBanner.mediaUrl } }]
    });

    if (includeAttachment && bottomBanner.attachment) {
      files.push(bottomBanner.attachment);
    }
  }

  const payload = {
    flags: 32768,
    components: [
      {
        type: 17,
        components: containerComponents
      }
    ]
  };

  if (files.length > 0) {
    payload.files = files;
  }

  return payload;
}

// ══════════════════════════════════════════════════════════════════════
// MODAL BUILDERS
// ══════════════════════════════════════════════════════════════════════

/**
 * Build Credentials Modal (Page 1)
 */
export function buildCredentialsModal(botId) {
  const bot = getBotInstance(botId);
  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_creds_${botId}`)
    .setTitle('Bot Setup: Credentials');

  const tokenInput = new TextInputBuilder()
    .setCustomId('token')
    .setLabel('Discord Bot Token (Required)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Paste your Discord Bot Token')
    .setRequired(true);
  if (bot?.token && bot.token.trim().length > 0) tokenInput.setValue(bot.token.trim());

  const apiKeyInput = new TextInputBuilder()
    .setCustomId('erlcApiKey')
    .setLabel('ER:LC Server API Key (Optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Paste your ER:LC Server API Key (Optional)')
    .setRequired(false);
  if (bot?.erlcApiKey && bot.erlcApiKey.trim().length > 0) apiKeyInput.setValue(bot.erlcApiKey.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(tokenInput),
    new ActionRowBuilder().addComponents(apiKeyInput)
  );

  return modal;
}

/**
 * Build Server Core & Join Code Modal (Page 1)
 */
export function buildServerCoreModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_servercore_${botId}`)
    .setTitle('Server Identity & Join Code');

  const nameInput = new TextInputBuilder()
    .setCustomId('serverName')
    .setLabel('In-Game Server Name')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. Liberty County Roleplay')
    .setRequired(false);
  if (cust.serverName?.trim()) nameInput.setValue(cust.serverName.trim());

  const joinInput = new TextInputBuilder()
    .setCustomId('joinCode')
    .setLabel('Server Join Code')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. LCRP')
    .setRequired(false);
  if (cust.joinCode?.trim()) joinInput.setValue(cust.joinCode.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(joinInput)
  );

  return modal;
}

/**
 * Build Ticket Category Names Modal (Page 2)
 */
export function buildTicketCategoryNamesModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};
  const currentCats = Array.isArray(cust.ticketCategories) ? cust.ticketCategories : [];

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_ticketcatnames_${botId}`)
    .setTitle('Ticket Category Names (1-5)');

  for (let i = 1; i <= 5; i++) {
    const existing = currentCats[i - 1]?.name || '';
    const input = new TextInputBuilder()
      .setCustomId(`cat_name_${i}`)
      .setLabel(`Category ${i} Name (Leave empty to disable)`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(i === 1 ? 'General Support' : i === 2 ? 'High Rank' : `Category ${i}`)
      .setRequired(false);
    if (existing) input.setValue(existing);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  return modal;
}

/**
 * Build Ticket Category Spawn Channels Modal (Page 2)
 */
export function buildTicketCategorySpawnsModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};
  const currentCats = Array.isArray(cust.ticketCategories) ? cust.ticketCategories : [];

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_ticketcatspawns_${botId}`)
    .setTitle('Category Spawn Channels');

  for (let i = 1; i <= 5; i++) {
    const catName = currentCats[i - 1]?.name || `Category ${i}`;
    const existing = currentCats[i - 1]?.spawnCategoryId || '';
    const input = new TextInputBuilder()
      .setCustomId(`cat_spawn_${i}`)
      .setLabel(`${catName.slice(0, 20)} Category ID`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Discord Category ID where ticket opens')
      .setRequired(false);
    if (existing) input.setValue(existing);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  return modal;
}

/**
 * Build Ticket Category Ping Roles Modal (Page 2)
 */
export function buildTicketCategoryPingsModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};
  const currentCats = Array.isArray(cust.ticketCategories) ? cust.ticketCategories : [];

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_ticketcatpings_${botId}`)
    .setTitle('Category Alert Roles');

  for (let i = 1; i <= 5; i++) {
    const catName = currentCats[i - 1]?.name || `Category ${i}`;
    const existing = currentCats[i - 1]?.pingRoleId || '';
    const input = new TextInputBuilder()
      .setCustomId(`cat_ping_${i}`)
      .setLabel(`${catName.slice(0, 20)} Role ID`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Staff Role ID to ping when opened')
      .setRequired(false);
    if (existing) input.setValue(existing);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  return modal;
}

/**
 * Build Ticket Banners & Settings Modal (Page 3)
 */
export function buildTicketBannersModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_ticketbanners_${botId}`)
    .setTitle('Ticket Banners & Appearance');

  const topBannerInput = new TextInputBuilder()
    .setCustomId('topBannerUrl')
    .setLabel('Main Panel Top Banner URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/banner.png')
    .setRequired(false);
  if (cust.topBannerUrl?.trim()) topBannerInput.setValue(cust.topBannerUrl.trim());

  const insideBannerInput = new TextInputBuilder()
    .setCustomId('ticketInsideBannerUrl')
    .setLabel('Inside-Ticket Header Banner URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/inside_banner.png')
    .setRequired(false);
  if (cust.ticketInsideBannerUrl?.trim()) insideBannerInput.setValue(cust.ticketInsideBannerUrl.trim());

  const bottomInput = new TextInputBuilder()
    .setCustomId('bottomBannerUrl')
    .setLabel('Global Bottom Strip Banner URL (Optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/bottom_strip.png')
    .setRequired(false);
  if (cust.bottomBannerUrl?.trim()) bottomInput.setValue(cust.bottomBannerUrl.trim());

  const transInput = new TextInputBuilder()
    .setCustomId('transcriptsChannelId')
    .setLabel('Transcripts Log Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Channel ID where closed transcripts are sent')
    .setRequired(false);
  if (cust.transcriptsChannelId?.trim()) transInput.setValue(cust.transcriptsChannelId.trim());

  const claimRoleInput = new TextInputBuilder()
    .setCustomId('ticketClaimRoleId')
    .setLabel('Allowed Ticket Claim Staff Role ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Role ID allowed to claim tickets')
    .setRequired(false);
  if (cust.ticketClaimRoleId?.trim()) claimRoleInput.setValue(cust.ticketClaimRoleId.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(topBannerInput),
    new ActionRowBuilder().addComponents(insideBannerInput),
    new ActionRowBuilder().addComponents(bottomInput),
    new ActionRowBuilder().addComponents(transInput),
    new ActionRowBuilder().addComponents(claimRoleInput)
  );

  return modal;
}

export const buildBannersModal = buildTicketBannersModal;

/**
 * Build Support Text & Guidelines Modal (Page 3)
 */
export function buildSupportTextModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_text_${botId}`)
    .setTitle('Ticket Guidelines & Welcome');

  const titleInput = new TextInputBuilder()
    .setCustomId('panelTitle')
    .setLabel('Support Panel Title')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Support')
    .setRequired(false);
  if (cust.panelTitle) titleInput.setValue(cust.panelTitle);

  const descInput = new TextInputBuilder()
    .setCustomId('panelDescription')
    .setLabel('Support Panel Description')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('If you require support, open a ticket below...')
    .setRequired(false);
  if (cust.panelDescription) descInput.setValue(cust.panelDescription);

  const defaultWelcome = `Welcome {user} to support! A staff member will assist you shortly.\nPlease provide your Roblox username and detail your inquiry below.`;
  const openMsgInput = new TextInputBuilder()
    .setCustomId('ticketOpenMessage')
    .setLabel('Inside-Ticket Welcome Message')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Enter inside-ticket welcome message (supports {user})...')
    .setRequired(false);
  openMsgInput.setValue(cust.ticketOpenMessage || defaultWelcome);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(descInput),
    new ActionRowBuilder().addComponents(openMsgInput)
  );

  return modal;
}

/**
 * Build Session Channels & Roles Modal (Page 4)
 */
export function buildSessionChannelsModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_sessionchannels_${botId}`)
    .setTitle('Session Channels & Roles');

  const sChanInput = new TextInputBuilder()
    .setCustomId('sessionChannelId')
    .setLabel('Session Announcements Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Channel ID where live panel is sent')
    .setRequired(false);
  if (cust.sessionChannelId?.trim()) sChanInput.setValue(cust.sessionChannelId.trim());

  const hostRoleInput = new TextInputBuilder()
    .setCustomId('hostRoleId')
    .setLabel('Session Host Staff Role ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Role permitted to start, vote, and shutdown')
    .setRequired(false);
  if (cust.hostRoleId?.trim()) hostRoleInput.setValue(cust.hostRoleId.trim());

  const notifyRoleInput = new TextInputBuilder()
    .setCustomId('notificationRoleId')
    .setLabel('Session Alert / Notification Role ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Role pinged when session goes live')
    .setRequired(false);
  if (cust.notificationRoleId?.trim()) notifyRoleInput.setValue(cust.notificationRoleId.trim());

  const ingameInput = new TextInputBuilder()
    .setCustomId('ingameVcId')
    .setLabel('In-Game Radio VC ID (Optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Voice channel ID for active in-game radio')
    .setRequired(false);
  if (cust.ingameVcId?.trim()) ingameInput.setValue(cust.ingameVcId.trim());

  const queueInput = new TextInputBuilder()
    .setCustomId('queueVcId')
    .setLabel('Queue Staging VC ID (Optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Voice channel ID for queue staging')
    .setRequired(false);
  if (cust.queueVcId?.trim()) queueInput.setValue(cust.queueVcId.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(sChanInput),
    new ActionRowBuilder().addComponents(hostRoleInput),
    new ActionRowBuilder().addComponents(notifyRoleInput),
    new ActionRowBuilder().addComponents(ingameInput),
    new ActionRowBuilder().addComponents(queueInput)
  );

  return modal;
}

/**
 * Build Session Banners Modal (Page 4)
 */
export function buildSessionBannersModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_sessionbanners_${botId}`)
    .setTitle('Session Banners');

  const topInput = new TextInputBuilder()
    .setCustomId('sessionTopBannerUrl')
    .setLabel('Live Session Top Banner URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/live_banner.png')
    .setRequired(false);
  if (cust.sessionTopBannerUrl?.trim()) topInput.setValue(cust.sessionTopBannerUrl.trim());

  const voteTopInput = new TextInputBuilder()
    .setCustomId('sessionVoteTopBannerUrl')
    .setLabel('Session Vote Top Banner URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/vote_top.png')
    .setRequired(false);
  if (cust.sessionVoteTopBannerUrl?.trim()) voteTopInput.setValue(cust.sessionVoteTopBannerUrl.trim());

  const shutInput = new TextInputBuilder()
    .setCustomId('sessionShutdownBannerUrl')
    .setLabel('Session Concluded Banner URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/shutdown_banner.png')
    .setRequired(false);
  if (cust.sessionShutdownBannerUrl?.trim()) shutInput.setValue(cust.sessionShutdownBannerUrl.trim());

  const bottomInput = new TextInputBuilder()
    .setCustomId('sessionBottomBannerUrl')
    .setLabel('Session Bottom Strip Banner URL (Optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/bottom_strip.png')
    .setRequired(false);
  if (cust.sessionBottomBannerUrl?.trim()) bottomInput.setValue(cust.sessionBottomBannerUrl.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(topInput),
    new ActionRowBuilder().addComponents(voteTopInput),
    new ActionRowBuilder().addComponents(shutInput),
    new ActionRowBuilder().addComponents(bottomInput)
  );

  return modal;
}

/**
 * Build Session Announcement Text Modal (Page 4)
 */
export function buildSessionTextModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_sessiontext_${botId}`)
    .setTitle('Session Announcement Text');

  const startTitleInput = new TextInputBuilder()
    .setCustomId('sessionStartTitle')
    .setLabel('Session Startup Headline')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('SESSION STARTING')
    .setRequired(false);
  if (cust.sessionStartTitle) startTitleInput.setValue(cust.sessionStartTitle);

  const startDescInput = new TextInputBuilder()
    .setCustomId('sessionStartDesc')
    .setLabel('Session Startup Description')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('The session vote has succeeded and operations are commencing.')
    .setRequired(false);
  if (cust.sessionStartDesc) startDescInput.setValue(cust.sessionStartDesc);

  const shutTitleInput = new TextInputBuilder()
    .setCustomId('sessionShutdownTitle')
    .setLabel('Session Concluded Headline')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('SESSION CONCLUDED')
    .setRequired(false);
  if (cust.sessionShutdownTitle) shutTitleInput.setValue(cust.sessionShutdownTitle);

  const shutDescInput = new TextInputBuilder()
    .setCustomId('sessionShutdownDesc')
    .setLabel('Session Concluded Description')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('The session has concluded. Thank you for attending today.')
    .setRequired(false);
  if (cust.sessionShutdownDesc) shutDescInput.setValue(cust.sessionShutdownDesc);

  modal.addComponents(
    new ActionRowBuilder().addComponents(startTitleInput),
    new ActionRowBuilder().addComponents(startDescInput),
    new ActionRowBuilder().addComponents(shutTitleInput),
    new ActionRowBuilder().addComponents(shutDescInput)
  );

  return modal;
}

/**
 * Build Applications Modal (Page 5)
 */
export function buildAppsModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_apps_${botId}`)
    .setTitle('Staff Application Settings');

  const revInput = new TextInputBuilder()
    .setCustomId('reviewChannelId')
    .setLabel('Application Review Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Channel ID where submitted applications go')
    .setRequired(false);
  if (cust.reviewChannelId?.trim()) revInput.setValue(cust.reviewChannelId.trim());

  const resInput = new TextInputBuilder()
    .setCustomId('resultsChannelId')
    .setLabel('Public Results Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Channel ID where accept/deny notices post')
    .setRequired(false);
  if (cust.resultsChannelId?.trim()) resInput.setValue(cust.resultsChannelId.trim());

  const ingameInput = new TextInputBuilder()
    .setCustomId('appIngameOpen')
    .setLabel('In-Game Moderator Open? (yes / no)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('yes')
    .setRequired(false);
  ingameInput.setValue(cust.appIngameOpen !== false ? 'yes' : 'no');

  const discordInput = new TextInputBuilder()
    .setCustomId('appDiscordOpen')
    .setLabel('Discord Moderator Open? (yes / no)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('yes')
    .setRequired(false);
  discordInput.setValue(cust.appDiscordOpen !== false ? 'yes' : 'no');

  modal.addComponents(
    new ActionRowBuilder().addComponents(revInput),
    new ActionRowBuilder().addComponents(resInput),
    new ActionRowBuilder().addComponents(ingameInput),
    new ActionRowBuilder().addComponents(discordInput)
  );

  return modal;
}

/**
 * Build In-Game Moderator Questions Modal (Page 5, up to 20 questions)
 */
export function buildIngameQuestionsModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const defaultQuestions = [
    '1. What is your Roblox username and age?',
    '2. What prior staff or moderation experience do you have in ER:LC?',
    '3. How many hours per week can you actively dedicate to in-game moderation?',
    '4. How do you handle a player performing Random Deathmatch (RDM)?',
    '5. What steps do you take when a user accuses another player of Fail Roleplay?',
    '6. When is it appropriate to freeze an active roleplay scene?',
    '7. How do you respond to a player who disrespects or argues with you in mod call?',
    '8. What evidence do you require before executing a server ban?',
    '9. How do you de-escalate tension between two disputing civs?',
    '10. How would you handle a fellow staff member abusing mod commands?',
    '11. What is your timezone and typical availability?',
    '12. Why should we choose you over other in-game applicant candidates?',
    '13. Describe your understanding of Powergaming and Metagaming.',
    '14. Do you have working recording software for capturing clip evidence?',
    '15. Any additional notes or information for management review?'
  ].join('\n');

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_appquestions_ingame_${botId}`)
    .setTitle('In-Game Mod Questions (1-20)');

  const questionsInput = new TextInputBuilder()
    .setCustomId('ingameQuestions')
    .setLabel('Interview Questions (1 per line, up to 20)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Enter your questions, 1 per line (up to 20)...')
    .setRequired(false);
  questionsInput.setValue(cust.ingameQuestions || defaultQuestions);

  modal.addComponents(new ActionRowBuilder().addComponents(questionsInput));
  return modal;
}

/**
 * Build Discord Moderator Questions Modal (Page 5, up to 20 questions)
 */
export function buildDiscordQuestionsModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const defaultQuestions = [
    '1. What is your Discord tag, Roblox username, and age?',
    '2. What experience do you have moderating large Discord servers?',
    '3. How would you handle a raid or mass spam attack in public text channels?',
    '4. When is a verbal warning appropriate versus an official warning or mute?',
    '5. How do you handle NSFW or illegal content posted in a general channel?',
    '6. What steps do you take if a user opens a ticket complaining about an unfair mute?',
    '7. How do you handle hate speech or extreme toxicity in Discord voice channels?',
    '8. How many hours daily do you spend monitoring Discord chat activity?',
    '9. How do you address staff members arguing in front of community members?',
    '10. What Discord bot moderation commands are you most familiar with?',
    '11. Why are you interested in becoming a Discord Moderator specifically?',
    '12. What would you do if an unauthorized user attempts to access staff chats?',
    '13. What is your strategy for keeping community chat active and positive?',
    '14. Do you agree to keep all staff discussions strictly confidential?',
    '15. Any closing remarks or credentials for the management team?'
  ].join('\n');

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_appquestions_discord_${botId}`)
    .setTitle('Discord Mod Questions (1-20)');

  const questionsInput = new TextInputBuilder()
    .setCustomId('discordQuestions')
    .setLabel('Interview Questions (1 per line, up to 20)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Enter your questions, 1 per line (up to 20)...')
    .setRequired(false);
  questionsInput.setValue(cust.discordQuestions || defaultQuestions);

  modal.addComponents(new ActionRowBuilder().addComponents(questionsInput));
  return modal;
}

/**
 * Build Application Questionnaire Modal (Page 5 fallback)
 */
export function buildAppQuizModal(botId) {
  return buildIngameQuestionsModal(botId);
}

/**
 * Build Staff Docs Content & Layout Modal (Page 6)
 */
export function buildDocsContentModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_docscontent_${botId}`)
    .setTitle('Documentation Content & Layout');

  const titleInput = new TextInputBuilder()
    .setCustomId('staffDocsTitle')
    .setLabel('Documentation Hub Title')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Official Staff Documentation')
    .setRequired(false);
  if (cust.staffDocsTitle) titleInput.setValue(cust.staffDocsTitle);

  const descInput = new TextInputBuilder()
    .setCustomId('staffDocsDescription')
    .setLabel('Documentation Overview / Welcome Text')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Welcome to the official Staff Documentation directory...')
    .setRequired(false);
  if (cust.staffDocsDescription) descInput.setValue(cust.staffDocsDescription);

  const layoutInput = new TextInputBuilder()
    .setCustomId('staffDocsLayout')
    .setLabel('Layout Style ("select" or "buttons")')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('select')
    .setRequired(false);
  layoutInput.setValue(cust.staffDocsLayout || 'select');

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(descInput),
    new ActionRowBuilder().addComponents(layoutInput)
  );

  return modal;
}

/**
 * Build Staff Docs Banners Modal (Page 6)
 */
export function buildDocsBannersModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_docsbanners_${botId}`)
    .setTitle('Staff Documentation Banners');

  const topInput = new TextInputBuilder()
    .setCustomId('staffDocsTopBannerUrl')
    .setLabel('Top Header Banner URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/docs_top.png')
    .setRequired(false);
  if (cust.staffDocsTopBannerUrl?.trim()) topInput.setValue(cust.staffDocsTopBannerUrl.trim());

  const bottomInput = new TextInputBuilder()
    .setCustomId('staffDocsBottomBannerUrl')
    .setLabel('Bottom Accent Banner URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/docs_bottom.png')
    .setRequired(false);
  if (cust.staffDocsBottomBannerUrl?.trim()) bottomInput.setValue(cust.staffDocsBottomBannerUrl.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(topInput),
    new ActionRowBuilder().addComponents(bottomInput)
  );

  return modal;
}

/**
 * Build Staff Docs Hub Modal (Page 6)
 */
export function buildDocsModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_docs_${botId}`)
    .setTitle('Staff Documentation Channel');

  const chanInput = new TextInputBuilder()
    .setCustomId('staffDocsChannelId')
    .setLabel('Staff Docs Hub Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Channel ID where documentation is posted')
    .setRequired(false);
  if (cust.staffDocsChannelId?.trim()) chanInput.setValue(cust.staffDocsChannelId.trim());

  modal.addComponents(new ActionRowBuilder().addComponents(chanInput));
  return modal;
}

/**
 * Build Promotion Config Modal (Page 7)
 */
export function buildPromotionConfigModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_promotion_${botId}`)
    .setTitle('Staff Promotion Settings');

  const chanInput = new TextInputBuilder()
    .setCustomId('promotionsChannelId')
    .setLabel('Promotions Announcement Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Channel ID where rank promotions post')
    .setRequired(false);
  if (cust.promotionsChannelId?.trim()) chanInput.setValue(cust.promotionsChannelId.trim());

  const roleInput = new TextInputBuilder()
    .setCustomId('promotionStaffRoleId')
    .setLabel('Allowed Promoters Staff Role ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Staff Role allowed to run /promote')
    .setRequired(false);
  if (cust.promotionStaffRoleId?.trim()) roleInput.setValue(cust.promotionStaffRoleId.trim());

  const topBannerInput = new TextInputBuilder()
    .setCustomId('promotionsBannerUrl')
    .setLabel('Promotion Top Banner URL (Optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/promotion_banner.png')
    .setRequired(false);
  if (cust.promotionsBannerUrl?.trim()) topBannerInput.setValue(cust.promotionsBannerUrl.trim());

  const bottomBannerInput = new TextInputBuilder()
    .setCustomId('promotionBottomBannerUrl')
    .setLabel('Promotion Bottom Banner URL (Optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/promotion_bottom.png')
    .setRequired(false);
  if (cust.promotionBottomBannerUrl?.trim()) bottomBannerInput.setValue(cust.promotionBottomBannerUrl.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(chanInput),
    new ActionRowBuilder().addComponents(roleInput),
    new ActionRowBuilder().addComponents(topBannerInput),
    new ActionRowBuilder().addComponents(bottomBannerInput)
  );

  return modal;
}

/**
 * Build Infraction Config Modal (Page 7)
 */
export function buildInfractionConfigModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_infraction_${botId}`)
    .setTitle('Staff Infraction Settings');

  const chanInput = new TextInputBuilder()
    .setCustomId('infractionsChannelId')
    .setLabel('Infractions Announcement Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Channel ID where infractions post')
    .setRequired(false);
  if (cust.infractionsChannelId?.trim()) chanInput.setValue(cust.infractionsChannelId.trim());

  const roleInput = new TextInputBuilder()
    .setCustomId('infractionStaffRoleId')
    .setLabel('Allowed Supervisors Staff Role ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Staff Role allowed to run /infract')
    .setRequired(false);
  if (cust.infractionStaffRoleId?.trim()) roleInput.setValue(cust.infractionStaffRoleId.trim());

  const topBannerInput = new TextInputBuilder()
    .setCustomId('infractionsBannerUrl')
    .setLabel('Infraction Top Banner URL (Optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/infraction_banner.png')
    .setRequired(false);
  if (cust.infractionsBannerUrl?.trim()) topBannerInput.setValue(cust.infractionsBannerUrl.trim());

  const bottomBannerInput = new TextInputBuilder()
    .setCustomId('infractionBottomBannerUrl')
    .setLabel('Infraction Bottom Banner URL (Optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/infraction_bottom.png')
    .setRequired(false);
  if (cust.infractionBottomBannerUrl?.trim()) bottomBannerInput.setValue(cust.infractionBottomBannerUrl.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(chanInput),
    new ActionRowBuilder().addComponents(roleInput),
    new ActionRowBuilder().addComponents(topBannerInput),
    new ActionRowBuilder().addComponents(bottomBannerInput)
  );

  return modal;
}

/**
 * Build Staff Role Permission Modal (Page 1)
 */
export function buildStaffRoleModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_staffrole_${botId}`)
    .setTitle('Authorized Staff Role');

  const roleInput = new TextInputBuilder()
    .setCustomId('botStaffRoleId')
    .setLabel('Authorized Staff Role ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Staff Role ID required to use the bot')
    .setRequired(false);
  if (cust.botStaffRoleId?.trim()) roleInput.setValue(cust.botStaffRoleId.trim());

  modal.addComponents(new ActionRowBuilder().addComponents(roleInput));
  return modal;
}

/**
 * Build AI API Key Modal (Page 8)
 */
export function buildAiKeyModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_aikey_${botId}`)
    .setTitle('Connect AI Assistant Key');

  const provInput = new TextInputBuilder()
    .setCustomId('aiProvider')
    .setLabel('Provider (openrouter or openai)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('openrouter')
    .setRequired(true);
  provInput.setValue(cust.aiProvider || bot?.aiProvider || 'openrouter');

  const keyInput = new TextInputBuilder()
    .setCustomId('aiApiKey')
    .setLabel('API Key')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Paste your OpenRouter or OpenAI API Key')
    .setRequired(true);
  if (cust.aiApiKey || bot?.aiApiKey) keyInput.setValue(cust.aiApiKey || bot.aiApiKey);

  modal.addComponents(
    new ActionRowBuilder().addComponents(provInput),
    new ActionRowBuilder().addComponents(keyInput)
  );

  return modal;
}

/**
 * Build Ask AI Modal (Page 8)
 */
export function buildAskAiModal(botId) {
  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_askai_${botId}`)
    .setTitle('Ask AI Assistant');

  const promptInput = new TextInputBuilder()
    .setCustomId('prompt')
    .setLabel('What would you like the AI to configure?')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('e.g. Remove rules in ticket panel, set session channel to #sessions...')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(promptInput));
  return modal;
}

/**
 * Build Welcome System Modal
 */
export function buildWelcomeModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_welcome_${botId}`)
    .setTitle('Welcome Settings');

  const channelInput = new TextInputBuilder()
    .setCustomId('welcomeChannelId')
    .setLabel('Welcome Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Paste welcome channel ID')
    .setRequired(false);
  if (cust.welcomeChannelId?.trim()) channelInput.setValue(cust.welcomeChannelId.trim());

  const bannerInput = new TextInputBuilder()
    .setCustomId('welcomeBannerUrl')
    .setLabel('Welcome Card Banner Image URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://... image link')
    .setRequired(false);
  if (cust.welcomeBannerUrl?.trim()) bannerInput.setValue(cust.welcomeBannerUrl.trim());

  const textInput = new TextInputBuilder()
    .setCustomId('welcomeText')
    .setLabel('Welcome Message Text')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Welcome to {server}, {user}! Enjoy your stay.')
    .setRequired(false);
  if (cust.welcomeText?.trim()) textInput.setValue(cust.welcomeText.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(channelInput),
    new ActionRowBuilder().addComponents(bannerInput),
    new ActionRowBuilder().addComponents(textInput)
  );

  return modal;
}

