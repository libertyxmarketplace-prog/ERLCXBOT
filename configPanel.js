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

export const TOTAL_PAGES = 8;

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
              content: `# Error\n> ${EMOJIS.CROSS} Bot instance not found (\`${botId}\`).`
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
      const srvName = cust.serverName || 'ERLCX (SOON)';
      const joinCode = cust.joinCode || 'Auto-detected';
      const hasToken = Boolean(bot.token && bot.token.trim().length > 0);
      const hasApiKey = Boolean(bot.erlcApiKey && bot.erlcApiKey.trim().length > 0);
      const staffRole = cust.botStaffRoleId ? `<@&${cust.botStaffRoleId}> ${statusBadge(true)}` : `*Admins Only* ${statusBadge(false)}`;
      const botStatus = bot.banned ? 'Suspended' : (hasToken ? 'Active' : 'Unconfigured');

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
        ? `<@${discordBotId}> (\`${discordBotId}\`)`
        : (hasToken ? '`Linked Client`' : `${statusBadge(false)} \`Not Configured\``);

      const ownerDisplay = (bot.ownerUserId && bot.ownerUserId !== 'OWNER')
        ? `<@${bot.ownerUserId}> (\`${bot.ownerUserId}\`)`
        : '`Administrator`';

      containerComponents.push({
        type: 10,
        content: [
          `# Server Configuration`,
          `-# Manage settings, credentials, and access for **${srvName}** • Instance: \`${botId}\` • Page 1 of 8`,
          ``,
          `> ### Core Authentication`,
          `> • **Bot Instance ID:** \`${botId}\``,
          `> • **Discord Bot ID:** ${discordBotDisplay}`,
          `> • **Discord Bot Token:** ${statusBadge(hasToken)} ${hasToken ? '`Configured`' : '`Not Configured`'}`,
          `> • **ER:LC Server API Key:** ${statusBadge(hasApiKey)} ${hasApiKey ? '`Configured`' : '`Not Configured`'}`,
          `> • **Instance Status:** \`${botStatus}\``,
          ``,
          `> ### In-Game Server Details`,
          `> • **Community Name:** **${srvName}**`,
          `> • **Server Join Code:** \`${joinCode}\``,
          ``,
          `> ### Access & Permissions`,
          `> • **Assigned Bot Owner:** ${ownerDisplay}`,
          `> • **Authorized Staff Role:** ${staffRole}`,
          `> • **Management Access:** ${cust.botStaffRoleId ? '`Restricted to Staff Role`' : '`Admins Only`'}`,
          ``,
          `-# Select an action below to update credentials or configure management permissions.`
        ].join('\n')
      });

      containerComponents.push({ type: 14, divider: true, spacing: 1 });

      containerComponents.push({
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: 'Edit Credentials',
            custom_id: `cfg_btn_creds_${botId}`
          },
          {
            type: 2,
            style: 2,
            label: 'Set Staff Role',
            custom_id: `cfg_btn_staffrole_${botId}`
          }
        ]
      });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 2: TICKET CATEGORIES (2/8)
    // ══════════════════════════════════════════════════════════════════════
    case 2: {
      const srvName = cust.serverName || 'ERLCX (SOON)';
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
        const isComplete = Boolean(c.name && c.spawnCategoryId);
        const name = c.name ? `**${c.name}**` : `*Slot ${i + 1} (Empty)*`;
        const spawn = c.spawnCategoryId ? `<#${c.spawnCategoryId}>` : '`Root Category`';
        const ping = c.pingRoleId ? `<@&${c.pingRoleId}>` : '`None`';
        return `> • **Slot ${i + 1}:** ${name} ${statusBadge(isComplete)}\n>   ↳ Spawn: ${spawn} | Ping: ${ping}`;
      }).join('\n');

      const transChannel = cust.transcriptsChannelId ? `<#${cust.transcriptsChannelId}> ${statusBadge(true)}` : `*Not Configured* ${statusBadge(false)}`;
      const claimRole = cust.ticketClaimRoleId ? `<@&${cust.ticketClaimRoleId}> ${statusBadge(true)}` : `*Default Staff* ${statusBadge(false)}`;

      containerComponents.push({
        type: 10,
        content: [
          `# Server Configuration`,
          `-# Support channels, category assignment, and alerts • Page 2 of 8`,
          ``,
          `> ### Category Routing`,
          catBullets,
          ``,
          `> ### System Archiving & Claims`,
          `> • **Transcripts Channel:** ${transChannel}`,
          `> • **Allowed Claim Role:** ${claimRole}`,
          ``,
          `-# Select a category setting below to edit names, spawn channels, or ping roles.`
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
      const srvName = cust.serverName || 'ERLCX (SOON)';
      const insideBanner = cust.ticketInsideBannerUrl ? `Configured ${statusBadge(true)}` : `Default ${statusBadge(false)}`;
      const topBanner = cust.topBannerUrl ? `Configured ${statusBadge(true)}` : `Default ${statusBadge(false)}`;
      const bottomBanner = cust.bottomBannerUrl ? `Configured ${statusBadge(true)}` : `Default ${statusBadge(false)}`;
      const openGreeting = cust.ticketOpenMessage ? `"${cust.ticketOpenMessage.slice(0, 50)}..."` : 'Default Support Welcome';
      const showRules = cust.showRulesButton !== false;

      containerComponents.push({
        type: 10,
        content: [
          `# Server Configuration`,
          `-# Ticket embed styling, branding graphics, and rules • Page 3 of 8`,
          ``,
          `> ### Embed & Layout`,
          `> • **Panel Title:** **${cust.panelTitle || 'Support'}**`,
          `> • **Header Banner:** ${topBanner}`,
          `> • **Inside Ticket Banner:** ${insideBanner}`,
          `> • **Global Bottom Accent:** ${bottomBanner}`,
          ``,
          `> ### Rules & Guidelines`,
          `> • **Rules Button:** ${showRules ? `Visible ${statusBadge(true)}` : `Hidden ${statusBadge(false)}`}`,
          `> • **Rules Title:** **${cust.rulesTitle || 'Support Rules'}**`,
          `> • **Rules Body Content:** ${cust.rulesDescription ? '`Configured`' : '`Default Guidelines`'}`,
          ``,
          `> ### Welcome Prompt`,
          `> • **Welcome Message:** *${openGreeting}*`,
          ``,
          `-# Select an appearance setting below to edit text, banners, or guidelines.`
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
      const srvName = cust.serverName || 'ERLCX (SOON)';
      const sessChannel = cust.sessionChannelId ? `<#${cust.sessionChannelId}> ${statusBadge(true)}` : `*Not Configured* ${statusBadge(false)}`;
      const ingameVc = cust.ingameVcId ? `<#${cust.ingameVcId}> ${statusBadge(true)}` : `*Not Configured* ${statusBadge(false)}`;
      const queueVc = cust.queueVcId ? `<#${cust.queueVcId}> ${statusBadge(true)}` : `*Not Configured* ${statusBadge(false)}`;
      const notifyRole = cust.notificationRoleId ? `<@&${cust.notificationRoleId}> ${statusBadge(true)}` : `*Not Configured* ${statusBadge(false)}`;
      const hostRole = cust.hostRoleId ? `<@&${cust.hostRoleId}> ${statusBadge(true)}` : `*Not Configured* ${statusBadge(false)}`;

      const liveBanner = cust.sessionTopBannerUrl ? `Custom ${statusBadge(true)}` : `None ${statusBadge(false)}`;
      const shutBanner = cust.sessionShutdownBannerUrl ? `Custom ${statusBadge(true)}` : `None ${statusBadge(false)}`;
      const voteBanner = cust.sessionVoteTopBannerUrl ? `Custom ${statusBadge(true)}` : `None ${statusBadge(false)}`;

      containerComponents.push({
        type: 10,
        content: [
          `# Server Configuration`,
          `-# Live patrol operations, dispatch channels, and radios • Page 4 of 8`,
          ``,
          `> ### Voice & Communications`,
          `> • **Announcements Channel:** ${sessChannel}`,
          `> • **In-Game Radio VC:** ${ingameVc}`,
          `> • **Queue Staging VC:** ${queueVc}`,
          ``,
          `> ### Staff Authorization`,
          `> • **Session Host Role:** ${hostRole}`,
          `> • **Staff Alert Role:** ${notifyRole}`,
          ``,
          `> ### Session Graphics`,
          `> • **Live Patrol Banner:** ${liveBanner}`,
          `> • **Session Vote Banner:** ${voteBanner}`,
          `> • **Shutdown Banner:** ${shutBanner}`,
          ``,
          `-# Select a session setting below to edit channels, roles, or banners.`
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
      const srvName = cust.serverName || 'ERLCX (SOON)';
      const revChannel = cust.reviewChannelId ? `<#${cust.reviewChannelId}> ${statusBadge(true)}` : `*Not Configured* ${statusBadge(false)}`;
      const resChannel = cust.resultsChannelId ? `<#${cust.resultsChannelId}> ${statusBadge(true)}` : `*Not Configured* ${statusBadge(false)}`;
      const isIngameOpen = cust.appIngameOpen !== false;
      const isDiscordOpen = cust.appDiscordOpen !== false;

      const ingameQCount = Array.isArray(cust.appQuestionsIngame) ? cust.appQuestionsIngame.length : 5;
      const discordQCount = Array.isArray(cust.appQuestionsDiscord) ? cust.appQuestionsDiscord.length : 5;

      containerComponents.push({
        type: 10,
        content: [
          `# Server Configuration`,
          `-# Recruitment desk, review channels, and question banks • Page 5 of 8`,
          ``,
          `> ### Application Routing`,
          `> • **Staff Review Feed:** ${revChannel}`,
          `> • **Public Decision Channel:** ${resChannel}`,
          ``,
          `> ### Department Recruitment Status`,
          `> • **In-Game Moderator:** ${isIngameOpen ? `Open ${statusBadge(true)}` : `Closed ${statusBadge(false)}`}`,
          `> • **Discord Moderator:** ${isDiscordOpen ? `Open ${statusBadge(true)}` : `Closed ${statusBadge(false)}`}`,
          ``,
          `> ### Interview Question Banks`,
          `> • **In-Game Mod Bank:** \`${ingameQCount} Questions Configured\``,
          `> • **Discord Mod Bank:** \`${discordQCount} Questions Configured\``,
          ``,
          `-# Select an application setting below to edit channels or question banks.`
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
      const srvName = cust.serverName || 'ERLCX (SOON)';
      const staffChan = cust.staffDocsChannelId ? `<#${cust.staffDocsChannelId}> ${statusBadge(true)}` : `*Not Configured* ${statusBadge(false)}`;
      const layoutMode = cust.staffDocsLayout === 'buttons' ? 'Interactive Buttons' : 'Dropdown Select Menu';

      const topBannerStatus = cust.staffDocsTopBannerUrl ? `Custom ${statusBadge(true)}` : `Default ${statusBadge(false)}`;
      const bottomBannerStatus = cust.staffDocsBottomBannerUrl ? `Custom ${statusBadge(true)}` : `Default ${statusBadge(false)}`;

      containerComponents.push({
        type: 10,
        content: [
          `# Server Configuration`,
          `-# Handbooks, operational policies, and documentation hub • Page 6 of 8`,
          ``,
          `> ### Hub Architecture`,
          `> • **Documentation Channel:** ${staffChan}`,
          `> • **Presentation Mode:** \`${layoutMode}\``,
          `> • **Hub Embed Title:** **${cust.staffDocsTitle || 'Official Staff Documentation'}**`,
          ``,
          `> ### Documentation Graphics`,
          `> • **Top Header Graphic:** ${topBannerStatus}`,
          `> • **Bottom Footer Graphic:** ${bottomBannerStatus}`,
          ``,
          `-# Select a documentation setting below to edit content, banners, or channel.`
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
      const srvName = cust.serverName || 'ERLCX (SOON)';
      const infrChan = cust.infractionsChannelId ? `<#${cust.infractionsChannelId}> ${statusBadge(true)}` : `*Not Configured* ${statusBadge(false)}`;
      const promChan = cust.promotionsChannelId ? `<#${cust.promotionsChannelId}> ${statusBadge(true)}` : `*Not Configured* ${statusBadge(false)}`;
      const infrRole = cust.infractionStaffRoleId ? `<@&${cust.infractionStaffRoleId}> ${statusBadge(true)}` : `*None* ${statusBadge(false)}`;
      const promRole = cust.promotionStaffRoleId ? `<@&${cust.promotionStaffRoleId}> ${statusBadge(true)}` : `*None* ${statusBadge(false)}`;

      const promBanner = cust.promoteBannerUrl ? `Custom ${statusBadge(true)}` : `Default ${statusBadge(false)}`;
      const infrBanner = cust.infractBannerUrl ? `Custom ${statusBadge(true)}` : `Default ${statusBadge(false)}`;

      containerComponents.push({
        type: 10,
        content: [
          `# Server Configuration`,
          `-# Internal accountability, strikes, and rank advancements • Page 7 of 8`,
          ``,
          `> ### Promotion Announcements`,
          `> • **Public Promotions Channel:** ${promChan}`,
          `> • **Authorized Promotion Role:** ${promRole}`,
          `> • **Promotion Card Graphic:** ${promBanner}`,
          ``,
          `> ### Staff Infraction Logs`,
          `> • **Infractions Audit Channel:** ${infrChan}`,
          `> • **Authorized Disciplinary Role:** ${infrRole}`,
          `> • **Infraction Card Graphic:** ${infrBanner}`,
          ``,
          `-# Select a moderation setting below to edit promotion or infraction settings.`
        ].join('\n')
      });

      containerComponents.push({ type: 14, divider: true, spacing: 1 });

      containerComponents.push({
        type: 1,
        components: [
          {
            type: 3,
            custom_id: `cfg_select_action_${botId}`,
            placeholder: 'Choose a moderation setting to edit...',
            options: [
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
      const srvName = cust.serverName || 'ERLCX (SOON)';
      const activeAiProv = (cust.aiProvider || bot.aiProvider || 'openrouter').toUpperCase();
      const hasAiKey = Boolean(cust.aiApiKey || bot.aiApiKey);
      const activeModel = cust.aiModel || (activeAiProv === 'GEMINI' ? 'gemini-1.5-flash' : activeAiProv === 'GROQ' ? 'llama-3.3-70b' : 'gpt-4o-mini');

      containerComponents.push({
        type: 10,
        content: [
          `# Server Configuration`,
          `-# Natural language configuration and smart assistance • Page 8 of 8`,
          ``,
          `> ### Intelligence Engine Status`,
          `> • **Active AI Provider:** \`${activeAiProv}\``,
          `> • **API Key Status:** ${statusBadge(hasAiKey)} ${hasAiKey ? '`Configured & Shielded`' : '`Not Configured`'}`,
          `> • **Target Model:** \`${activeModel}\``,
          ``,
          `> ### Conversational Features`,
          `> • Rebrand Ticket Panels, Welcome Messages, & Guideline Text`,
          `> • Auto-configure Voice Radios, Queue Channels, & Staff Roles`,
          `> • Update or clear graphic banners across all bot modules`,
          ``,
          `-# Select an AI setting below to configure your API key or prompt the assistant.`
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
    .setLabel('ER:LC Server API Key (Required)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Paste your ER:LC Server API Key')
    .setRequired(true);
  if (bot?.erlcApiKey && bot.erlcApiKey.trim().length > 0) apiKeyInput.setValue(bot.erlcApiKey.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(tokenInput),
    new ActionRowBuilder().addComponents(apiKeyInput)
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
