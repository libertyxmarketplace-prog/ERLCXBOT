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

export const TOTAL_PAGES = 8;

export const EMOJIS = {
  CHECK: '<:Check:1396399812697391114>',
  CROSS: '<:Cross:1396397536478105672>',
  ARROW_RIGHT: '<:ArrowForward:1396004799396450476>',
  ARROW_LEFT: '<:arrow_left:1551802359833960459>',
  BTN_ARROW_LEFT: { id: '1551802359833960459', name: 'arrow_left' },
  BTN_ARROW_RIGHT: { id: '1396004799396450476', name: 'ArrowForward' }
};

export const DEFAULT_BOTTOM_BANNER =
  "https://cdn.discordapp.com/attachments/1551801623641194616/1551813107586834473/bottom_accent.png?ex=6ab35614&is=6ab20494&hm=bf90c8818eecb2b6ed01d27f4ea891683a72c0aaade5113ac14108a43122f884&";

function maskSecret(str) {
  if (!str || typeof str !== 'string' || str.trim() === '') return '*Not Set*';
  if (str.length <= 8) return '********';
  return `${str.slice(0, 4)}...${str.slice(-4)}`;
}

/**
 * Build the interactive /config control panel payload using Discord Components V2 Container (type 17)
 */
export function buildConfigPanelPayload(botId, page = 1) {
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
              content: `### CONFIGURATION ERROR\n> ${EMOJIS.CROSS} **Bot Instance Not Found:** No bot instance found with ID \`${botId}\`.`
            }
          ]
        }
      ]
    };
  }

  const cust = bot.customizations || {};
  const activePage = Math.max(1, Math.min(TOTAL_PAGES, page));
  const bottomBannerUrl = cust.bottomBannerUrl || DEFAULT_BOTTOM_BANNER;

  const containerComponents = [];


  switch (activePage) {
    // ══════════════════════════════════════════════════════════════════════
    // PAGE 1: BOT ACTIVATION • CORE CREDENTIALS & COMMUNITY (1/8)
    // ══════════════════════════════════════════════════════════════════════
    case 1: {
      const srvName = cust.serverName || 'Not Set';
      const joinCode = cust.joinCode || 'Not Set';
      const statusText = bot.banned ? 'SUSPENDED' : 'ONLINE // OPERATIONAL';

      containerComponents.push({
        type: 10,
        content: [
          `# SYSTEM CONTROL CONSOLE`,
          `### BOT ACTIVATION • CORE CREDENTIALS & COMMUNITY • PAGE 1/8`,
          `\`\`\`ini`,
          `[SYSTEM TELEMETRY]`,
          `TENANT_ID        = ${bot.botId}`,
          `GATEWAY_STATUS   = ${statusText}`,
          `DISCORD_TOKEN    = ${maskSecret(bot.token)}`,
          `ERLC_API_KEY     = ${maskSecret(bot.erlcApiKey)}`,
          `SERVER_JOIN_CODE = ${joinCode}`,
          `COMMUNITY_NAME   = ${srvName}`,
          `\`\`\``,
          `> **Instance Authentication**: Connected to Discord Gateway with active session credentials.`,
          `> **Server Identity**: Community server branding and direct in-game join code applied across operations.`
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
            label: 'Server Identity & Code',
            custom_id: `cfg_btn_servercore_${botId}`
          }
        ]
      });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 2: TICKET SYSTEM • CATEGORIES & ROUTING (2/8)
    // ══════════════════════════════════════════════════════════════════════
    case 2: {
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

      const catLines = categories.map((c, i) => {
        const num = String(i + 1).padStart(2, '0');
        const name = (c.name || `Category ${i + 1}`).padEnd(16, ' ').slice(0, 16);
        const spawnStatus = c.spawnCategoryId ? 'CUSTOM FOLDER' : 'DEFAULT/ROOT';
        const pingStatus = c.pingRoleId ? 'ROLE ATTACHED' : 'FALLBACK ROLE';
        return `${num} | ${name} | SPAWN: ${spawnStatus.padEnd(14, ' ')} | PING: ${pingStatus}`;
      }).join('\n');

      const transChannel = cust.transcriptsChannelId ? `<#${cust.transcriptsChannelId}>` : '*Not Configured*';
      const defCategory = cust.ticketCategoryId ? `<#${cust.ticketCategoryId}>` : '*Server Root*';
      const defPing = cust.ticketPingRoleId ? `<@&${cust.ticketPingRoleId}>` : '*None*';

      const catMentions = categories.map((c, i) => {
        const spawn = c.spawnCategoryId ? `<#${c.spawnCategoryId}>` : (cust.ticketCategoryId ? `<#${cust.ticketCategoryId}> (Fallback)` : '*Server Root*');
        const ping = c.pingRoleId ? `<@&${c.pingRoleId}>` : (cust.ticketPingRoleId ? `<@&${cust.ticketPingRoleId}> (Fallback)` : '*None*');
        return `> **[${i + 1}] ${c.name || `Category ${i + 1}`}** -> Folder: ${spawn} | Alert: ${ping}`;
      }).join('\n');

      containerComponents.push({
        type: 10,
        content: [
          `# TICKET ROUTING & DISPATCH CONTROLLER`,
          `### TICKET SYSTEM • CATEGORIES & ROUTING • PAGE 2/8`,
          `\`\`\`ini`,
          `[TICKET CATEGORY ROUTING MATRIX]`,
          catLines,
          `\`\`\``,
          catMentions,
          ``,
          `> **Transcripts**: ${transChannel} | **Default Folder**: ${defCategory} | **Default Ping**: ${defPing}`,
          `> **Panel Title**: **${cust.panelTitle || 'Support'}** | **Top Banner**: ${cust.topBannerUrl ? '[Configured]' : '[Default Clean]'} | **Bottom Strip**: ${cust.bottomBannerUrl ? '[Configured]' : '[Default Clean]'}`
        ].join('\n')
      });

      containerComponents.push({ type: 14, divider: true, spacing: 1 });

      containerComponents.push({
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: 'Category Names',
            custom_id: `cfg_btn_ticketcatnames_${botId}`
          },
          {
            type: 2,
            style: 1,
            label: 'Category Spawns',
            custom_id: `cfg_btn_ticketcatspawns_${botId}`
          },
          {
            type: 2,
            style: 1,
            label: 'Category Ping Roles',
            custom_id: `cfg_btn_ticketcatpings_${botId}`
          }
        ]
      });

      containerComponents.push({
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            label: 'Ticket Banners & Settings',
            custom_id: `cfg_btn_ticketbanners_${botId}`
          },
          {
            type: 2,
            style: 2,
            label: 'Support Message',
            custom_id: `cfg_btn_text_${botId}`
          }
        ]
      });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 3: ER:LC LIVE OPERATIONS & SESSIONS (3/8)
    // ══════════════════════════════════════════════════════════════════════
    case 3: {
      const sessChannel = cust.sessionChannelId ? `<#${cust.sessionChannelId}>` : '*Not Configured*';
      const ingameVc = cust.ingameVcId ? `<#${cust.ingameVcId}>` : '*Not Configured*';
      const queueVc = cust.queueVcId ? `<#${cust.queueVcId}>` : '*Not Configured*';
      const notifyRole = cust.notificationRoleId ? `<@&${cust.notificationRoleId}>` : '*Not Configured*';
      const hostRole = cust.hostRoleId ? `<@&${cust.hostRoleId}>` : '*Not Configured*';

      const sStartTitle = cust.sessionStartTitle || 'SESSION STARTING';
      const sStartDesc = (cust.sessionStartDesc || 'The session vote has succeeded and operations are now commencing.').slice(0, 75);
      const sShutTitle = cust.sessionShutdownTitle || 'SESSION CONCLUDED';
      const sShutDesc = (cust.sessionShutdownDesc || 'The session has concluded. Thank you for attending today\'s operations.').slice(0, 75);

      containerComponents.push({
        type: 10,
        content: [
          `# EMERGENCY RESPONSE OPERATIONS DISPATCH`,
          `### ER:LC LIVE OPERATIONS & SESSIONS • PAGE 3/8`,
          `\`\`\`ini`,
          `[OPERATIONS COMMUNICATIONS MATRIX]`,
          `ANNOUNCEMENTS_CHANNEL = ${cust.sessionChannelId ? 'CONFIGURED' : 'NOT SET'}`,
          `INGAME_RADIO_VOICE    = ${cust.ingameVcId ? 'CONFIGURED' : 'NOT SET'}`,
          `QUEUE_STAGING_VOICE   = ${cust.queueVcId ? 'CONFIGURED' : 'NOT SET'}`,
          `DUTY_ALERT_ROLE       = ${cust.notificationRoleId ? 'ATTACHED' : 'NOT SET'}`,
          `SESSION_COMMAND_ROLE  = ${cust.hostRoleId ? 'ATTACHED' : 'NOT SET'}`,
          `STARTUP_HEADLINE      = ${sStartTitle}`,
          `SHUTDOWN_HEADLINE     = ${sShutTitle}`,
          `\`\`\``,
          `> **Operations Channels**: Announcements: ${sessChannel}`,
          `> **Voice Frequencies**: Radio VC: ${ingameVc} | Queue VC: ${queueVc}`,
          `> **Operations Command**: Host Role: ${hostRole} | Duty Alert: ${notifyRole}`,
          `> **Startup Dispatch**: **${sStartTitle}** - *${sStartDesc}...*`,
          `> **Shutdown Dispatch**: **${sShutTitle}** - *${sShutDesc}...*`,
          `> **Visual Assets**: Live Banner: ${cust.sessionTopBannerUrl ? '[Active]' : '[Default]'} | Shutdown: ${cust.sessionShutdownBannerUrl ? '[Active]' : '[Default]'}`
        ].join('\n')
      });

      containerComponents.push({ type: 14, divider: true, spacing: 1 });

      containerComponents.push({
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: 'Channels & Roles',
            custom_id: `cfg_btn_sessionchannels_${botId}`
          },
          {
            type: 2,
            style: 1,
            label: 'Session Banners',
            custom_id: `cfg_btn_sessionbanners_${botId}`
          },
          {
            type: 2,
            style: 2,
            label: 'Custom Embed Text',
            custom_id: `cfg_btn_sessiontext_${botId}`
          }
        ]
      });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 4: MODERATION SYSTEM • INFRACTIONS & PROMOTIONS (4/8)
    // ══════════════════════════════════════════════════════════════════════
    case 4: {
      const infractBanner = cust.infractionBannerUrl || cust.infractBannerUrl;
      const promoteBanner = cust.promotionBannerUrl || cust.promoteBannerUrl;

      const infractChan = cust.infractionsChannelId ? `<#${cust.infractionsChannelId}>` : '*Not Configured*';
      const promoteChan = cust.promotionsChannelId ? `<#${cust.promotionsChannelId}>` : '*Not Configured*';
      const remRole = cust.infractRemoveRoleId ? `<@&${cust.infractRemoveRoleId}>` : '*None*';
      const giveRole = cust.infractGiveRoleId ? `<@&${cust.infractGiveRoleId}>` : '*None*';
      const promoGiveRole = cust.promotionGiveRoleId ? `<@&${cust.promotionGiveRoleId}>` : '*None*';

      containerComponents.push({
        type: 10,
        content: [
          `# MODERATION & DISCIPLINARY DIRECTORY`,
          `### MODERATION SYSTEM • INFRACTIONS & PROMOTIONS • PAGE 4/8`,
          `\`\`\`ini`,
          `[INFRACTIONS & PROMOTIONS MATRIX]`,
          `INFRACTIONS_CHANNEL = ${cust.infractionsChannelId ? 'CONFIGURED' : 'NOT SET'}`,
          `PROMOTIONS_CHANNEL  = ${cust.promotionsChannelId ? 'CONFIGURED' : 'NOT SET'}`,
          `PENALTY_REMOVE_ROLE = ${cust.infractRemoveRoleId ? 'ROLE SET' : 'NONE'}`,
          `PENALTY_ASSIGN_ROLE = ${cust.infractGiveRoleId ? 'ROLE SET' : 'NONE'}`,
          `PROMOTION_RANK_ROLE = ${cust.promotionGiveRoleId ? 'ROLE SET' : 'NONE'}`,
          `\`\`\``,
          `> **Infraction Routing**: Channel: ${infractChan} | Removed: ${remRole} | Given: ${giveRole}`,
          `> **Promotion Routing**: Channel: ${promoteChan} | Promotion Role: ${promoGiveRole}`,
          `> **Visual Assets**: Infraction Banner: ${infractBanner ? '[Active]' : '[Default]'} | Promotion Banner: ${promoteBanner ? '[Active]' : '[Default]'}`
        ].join('\n')
      });

      containerComponents.push({ type: 14, divider: true, spacing: 1 });

      containerComponents.push({
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: 'Configure Infractions',
            custom_id: `cfg_btn_infractioncfg_${botId}`
          },
          {
            type: 2,
            style: 1,
            label: 'Configure Promotions',
            custom_id: `cfg_btn_promotioncfg_${botId}`
          }
        ]
      });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 5: STAFF APPLICATIONS & IN-GAME QUIZ (5/8)
    // ══════════════════════════════════════════════════════════════════════
    case 5: {
      const revChannel = cust.reviewChannelId ? `<#${cust.reviewChannelId}>` : '*Default Channel*';
      const resChannel = cust.resultsChannelId ? `<#${cust.resultsChannelId}>` : '*Default Channel*';
      const quizIntro = (cust.appQuizIntroText || 'Welcome to the in-game quiz!').slice(0, 75);

      containerComponents.push({
        type: 10,
        content: [
          `# RECRUITMENT & ASSESSMENT CONSOLE`,
          `### STAFF APPLICATIONS & IN-GAME QUIZ • PAGE 5/8`,
          `\`\`\`ini`,
          `[APPLICATION & QUIZ TELEMETRY]`,
          `REVIEW_CHANNEL     = ${cust.reviewChannelId ? 'CONFIGURED' : 'DEFAULT'}`,
          `RESULTS_CHANNEL    = ${cust.resultsChannelId ? 'CONFIGURED' : 'DEFAULT'}`,
          `APPLICATION_TITLE  = ${cust.appTitle || 'Staff Application'}`,
          `QUIZ_WORKFLOW      = ACTIVE`,
          `\`\`\``,
          `> **Intake Routing**: Submissions Review: ${revChannel} | Announcements: ${resChannel}`,
          `> **Quiz Intro**: *"${quizIntro}..."*`,
          `> **Visual Assets**: Top Banner: ${cust.appTopBannerUrl ? '[Active]' : '[Default]'} | Bottom Strip: ${cust.appBottomBannerUrl ? '[Active]' : '[Default]'}`
        ].join('\n')
      });

      containerComponents.push({ type: 14, divider: true, spacing: 1 });

      containerComponents.push({
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: 'Channels & App Text',
            custom_id: `cfg_btn_apps_${botId}`
          },
          {
            type: 2,
            style: 1,
            label: 'Banners & Quiz Text',
            custom_id: `cfg_btn_appquizcfg_${botId}`
          }
        ]
      });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 6: SERVER DOCUMENTATION & POLICIES (6/8)
    // ══════════════════════════════════════════════════════════════════════
    case 6: {
      const deptChan = cust.deptChannelId ? `<#${cust.deptChannelId}>` : '*Not Configured*';
      const regChan = cust.regulationsChannelId ? `<#${cust.regulationsChannelId}>` : '*Server Default*';
      const staffChan = cust.staffDocsChannelId ? `<#${cust.staffDocsChannelId}>` : '*Not Configured*';

      containerComponents.push({
        type: 10,
        content: [
          `# COMMUNITY DOCUMENTATION & REGULATORY VAULT`,
          `### SERVER DOCUMENTATION & POLICIES • PAGE 6/8`,
          `\`\`\`ini`,
          `[SERVER DOCUMENTATION MATRIX]`,
          `DEPARTMENT_PANEL_CHANNEL = ${cust.deptChannelId ? 'CONFIGURED' : 'NOT SET'}`,
          `REGULATIONS_CHANNEL      = ${cust.regulationsChannelId ? 'CONFIGURED' : 'DEFAULT'}`,
          `STAFF_DOCS_CHANNEL       = ${cust.staffDocsChannelId ? 'CONFIGURED' : 'NOT SET'}`,
          `\`\`\``,
          `> **Department Directory**: Channel: ${deptChan} | Header: ${cust.deptBannerUrl ? '[Active]' : '[Not Set]'}`,
          `> **Community Regulations**: Channel: ${regChan} | Header: ${cust.regulationsBannerUrl ? '[Active]' : '[Not Set]'}`,
          `> **Staff Documentation**: Channel: ${staffChan} | Strip: ${cust.staffDocsBottomBannerUrl ? '[Active]' : '[Not Set]'}`
        ].join('\n')
      });

      containerComponents.push({ type: 14, divider: true, spacing: 1 });

      containerComponents.push({
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: 'Configure Server Docs',
            custom_id: `cfg_btn_docs_${botId}`
          }
        ]
      });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 7: WELCOME SYSTEM (7/8)
    // ══════════════════════════════════════════════════════════════════════
    case 7: {
      const isWelcomeOn = Boolean(cust.welcomeEnabled);
      const welcomeChan = cust.welcomeChannelId ? `<#${cust.welcomeChannelId}>` : '*Server Default*';
      const welcomeMsg = cust.welcomeText || 'Welcome to {server}, {user}! Enjoy your stay.';

      containerComponents.push({
        type: 10,
        content: [
          `# AUTOMATED ARRIVALS & GUEST INDUCTION`,
          `### WELCOME SYSTEM • PAGE 7/8`,
          `\`\`\`ini`,
          `[WELCOME SYSTEM TELEMETRY]`,
          `STATUS          = ${isWelcomeOn ? 'ACTIVE // BROADCASTING' : 'DISABLED // DORMANT'}`,
          `TARGET_CHANNEL  = ${cust.welcomeChannelId ? 'CONFIGURED' : 'DEFAULT'}`,
          `CARD_GRAPHIC    = ${cust.welcomeBannerUrl ? 'CUSTOM IMAGE' : 'CLEAN / NONE'}`,
          `\`\`\``,
          `> **Induction Channel**: Target: ${welcomeChan}`,
          `> **Welcome Template**: *"${welcomeMsg}"*`
        ].join('\n')
      });

      containerComponents.push({ type: 14, divider: true, spacing: 1 });

      containerComponents.push({
        type: 1,
        components: [
          {
            type: 2,
            style: isWelcomeOn ? 4 : 3,
            label: isWelcomeOn ? 'Disable Welcome' : 'Enable Welcome',
            custom_id: `cfg_btn_togglewelcome_${botId}`
          },
          {
            type: 2,
            style: 1,
            label: 'Edit Welcome Settings',
            custom_id: `cfg_btn_welcome_${botId}`
          }
        ]
      });
      break;
    }

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 8: AI CONFIGURATION ASSISTANT (8/8)
    // ══════════════════════════════════════════════════════════════════════
    case 8: {
      const activeAiProv = (cust.aiProvider || bot.aiProvider || 'openrouter').toUpperCase();
      const hasAiKey = Boolean(cust.aiApiKey || bot.aiApiKey);

      containerComponents.push({
        type: 10,
        content: [
          `# AUTONOMOUS CONFIGURATION ENGINE`,
          `### AI CONFIGURATION ASSISTANT • PAGE 8/8`,
          `\`\`\`ini`,
          `[AI AUTOMATION TELEMETRY]`,
          `PROVIDER        = ${activeAiProv}`,
          `KEY_STATUS      = ${hasAiKey ? 'AUTHENTICATED' : 'MISSING KEY'}`,
          `INTERACTION     = NATURAL LANGUAGE PARSER`,
          `\`\`\``,
          `> Tell the assistant what you want to change in plain English:`,
          `> • "Set my session channel to #patrol-announcements and give role 1234 on promotion."`,
          `> • "Update category 2 to High Rank and set its spawn folder to 12345678."`
        ].join('\n')
      });

      containerComponents.push({ type: 14, divider: true, spacing: 1 });

      containerComponents.push({
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: 'Set API Key & Provider',
            custom_id: `cfg_btn_aikey_${botId}`
          },
          {
            type: 2,
            style: 3,
            label: 'Ask AI Assistant',
            custom_id: `cfg_btn_askai_${botId}`
          }
        ]
      });
      break;
    }
  }

  // Bottom Accent Strip
  if (bottomBannerUrl && bottomBannerUrl.trim() !== '') {
    containerComponents.push({
      type: 12,
      items: [{ media: { url: bottomBannerUrl } }]
    });
  }

  // Master Navigation Controls (Strictly zero emojis)
  containerComponents.push({
    type: 1,
    components: [
      {
        type: 2,
        style: 2,
        label: 'Previous',
        custom_id: `cfg_nav_prev_${botId}_${activePage}`,
        disabled: activePage <= 1
      },
      {
        type: 2,
        style: 2,
        label: 'Next',
        custom_id: `cfg_nav_next_${botId}_${activePage}`,
        disabled: activePage >= TOTAL_PAGES
      },
      {
        type: 2,
        style: 2,
        label: 'Refresh',
        custom_id: `cfg_nav_refresh_${botId}_${activePage}`
      }
    ]
  });

  return {
    flags: 32768,
    components: [
      {
        type: 17,
        components: containerComponents
      }
    ]
  };
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
    .setPlaceholder('Paste your Discord Bot Token from Discord Developer Portal')
    .setRequired(true);
  if (bot?.token && bot.token.trim().length > 0) tokenInput.setValue(bot.token.trim());

  const apiKeyInput = new TextInputBuilder()
    .setCustomId('erlcApiKey')
    .setLabel('ER:LC Server API Key (Required)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Paste your ER:LC Private Server API Key')
    .setRequired(true);
  if (bot?.erlcApiKey && bot.erlcApiKey.trim().length > 0) apiKeyInput.setValue(bot.erlcApiKey.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(tokenInput),
    new ActionRowBuilder().addComponents(apiKeyInput)
  );

  return modal;
}

/**
 * Build Server Core Modal (Page 1) - Server Name & Join Code
 */
export function buildServerCoreModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_servercore_${botId}`)
    .setTitle('Server Identity & Join Code');

  const nameInput = new TextInputBuilder()
    .setCustomId('serverName')
    .setLabel('Community Server Name')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. Florida State Roleplay')
    .setMaxLength(100)
    .setRequired(false);
  if (cust.serverName?.trim()) nameInput.setValue(cust.serverName.trim());

  const codeInput = new TextInputBuilder()
    .setCustomId('joinCode')
    .setLabel('ER:LC Private Server Join Code')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. olrpp')
    .setMaxLength(32)
    .setRequired(false);
  if (cust.joinCode?.trim()) codeInput.setValue(cust.joinCode.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(codeInput)
  );

  return modal;
}

/**
 * Build Ticket Category Names Modal (Page 2) - 5 Button Labels
 */
export function buildTicketCategoryNamesModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};
  const defaultNames = ["General Support", "High Rank", "Player Report", "Appeals", "Other"];
  const cats = Array.isArray(cust.ticketCategories) && cust.ticketCategories.length > 0
    ? cust.ticketCategories.map(c => c.name || '')
    : defaultNames;

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_ticketcatnames_${botId}`)
    .setTitle('Edit Category Button Names');

  const inputs = [];
  for (let i = 0; i < 5; i++) {
    const inp = new TextInputBuilder()
      .setCustomId(`cat_name_${i + 1}`)
      .setLabel(`Category ${i + 1} Button Label`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(defaultNames[i])
      .setValue(cats[i] || defaultNames[i])
      .setRequired(i === 0); // Only first is strictly required
    inputs.push(new ActionRowBuilder().addComponents(inp));
  }

  modal.addComponents(...inputs);
  return modal;
}

/**
 * Build Ticket Category Spawns Modal (Page 2) - 5 Spawn Category IDs
 */
export function buildTicketCategorySpawnsModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};
  const cats = Array.isArray(cust.ticketCategories) ? cust.ticketCategories : [];

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_ticketcatspawns_${botId}`)
    .setTitle('Category Spawn Folder IDs');

  const inputs = [];
  for (let i = 0; i < 5; i++) {
    const catName = cats[i]?.name || `Category ${i + 1}`;
    const inp = new TextInputBuilder()
      .setCustomId(`cat_spawn_${i + 1}`)
      .setLabel(`${catName.slice(0, 30)} (Category ID)`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Discord Category ID (e.g. 1548331057911173140)')
      .setRequired(false);
    if (cats[i]?.spawnCategoryId?.trim()) {
      inp.setValue(cats[i].spawnCategoryId.trim());
    }
    inputs.push(new ActionRowBuilder().addComponents(inp));
  }

  modal.addComponents(...inputs);
  return modal;
}

/**
 * Build Ticket Category Ping Roles Modal (Page 2) - 5 Ping Role IDs
 */
export function buildTicketCategoryPingsModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};
  const cats = Array.isArray(cust.ticketCategories) ? cust.ticketCategories : [];

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_ticketcatpings_${botId}`)
    .setTitle('Category Alert / Ping Role IDs');

  const inputs = [];
  for (let i = 0; i < 5; i++) {
    const catName = cats[i]?.name || `Category ${i + 1}`;
    const inp = new TextInputBuilder()
      .setCustomId(`cat_ping_${i + 1}`)
      .setLabel(`${catName.slice(0, 30)} (Role ID to Ping)`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Role ID (e.g. 1548330761621344338)')
      .setRequired(false);
    if (cats[i]?.pingRoleId?.trim()) {
      inp.setValue(cats[i].pingRoleId.trim());
    }
    inputs.push(new ActionRowBuilder().addComponents(inp));
  }

  modal.addComponents(...inputs);
  return modal;
}

/**
 * Build Ticket Banners & Settings Modal (Page 2)
 */
export function buildTicketBannersModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_ticketbanners_${botId}`)
    .setTitle('Ticket Banners & Settings');

  const topInput = new TextInputBuilder()
    .setCustomId('topBannerUrl')
    .setLabel('Ticket Panel Top Banner URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://... (or leave empty)')
    .setRequired(false);
  if (cust.topBannerUrl?.trim()) topInput.setValue(cust.topBannerUrl.trim());

  const bottomInput = new TextInputBuilder()
    .setCustomId('bottomBannerUrl')
    .setLabel('Ticket Panel Bottom Strip URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://... (or leave empty)')
    .setRequired(false);
  if (cust.bottomBannerUrl?.trim()) bottomInput.setValue(cust.bottomBannerUrl.trim());

  const transcriptsInput = new TextInputBuilder()
    .setCustomId('transcriptsChannelId')
    .setLabel('Transcripts Log Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1548876816171798678')
    .setRequired(false);
  if (cust.transcriptsChannelId?.trim()) transcriptsInput.setValue(cust.transcriptsChannelId.trim());

  const fallbackCatInput = new TextInputBuilder()
    .setCustomId('ticketCategoryId')
    .setLabel('Fallback Ticket Category ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1548331057911173140')
    .setRequired(false);
  if (cust.ticketCategoryId?.trim()) fallbackCatInput.setValue(cust.ticketCategoryId.trim());

  const fallbackPingInput = new TextInputBuilder()
    .setCustomId('ticketPingRoleId')
    .setLabel('Fallback Role ID to Ping')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1548876816171798679')
    .setRequired(false);
  if (cust.ticketPingRoleId?.trim()) fallbackPingInput.setValue(cust.ticketPingRoleId.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(topInput),
    new ActionRowBuilder().addComponents(bottomInput),
    new ActionRowBuilder().addComponents(transcriptsInput),
    new ActionRowBuilder().addComponents(fallbackCatInput),
    new ActionRowBuilder().addComponents(fallbackPingInput)
  );

  return modal;
}

/**
 * Build Support Text & Rules Modal (Page 2)
 */
export function buildSupportTextModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_text_${botId}`)
    .setTitle('Customize Ticket Support Message');

  const titleInput = new TextInputBuilder()
    .setCustomId('panelTitle')
    .setLabel('Panel Header Title')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Support')
    .setMaxLength(100)
    .setRequired(true);
  if (cust.panelTitle?.trim()) titleInput.setValue(cust.panelTitle.trim());

  const descInput = new TextInputBuilder()
    .setCustomId('panelDescription')
    .setLabel('Panel Description Text')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('If you require support, open a ticket...')
    .setMaxLength(1000)
    .setRequired(true);
  if (cust.panelDescription?.trim()) descInput.setValue(cust.panelDescription.trim());

  const rulesDescInput = new TextInputBuilder()
    .setCustomId('rulesDescription')
    .setLabel('Guidelines / Rules Modal Text')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Please do not spam or misuse tickets...')
    .setMaxLength(1000)
    .setRequired(false);
  if (cust.rulesDescription?.trim()) rulesDescInput.setValue(cust.rulesDescription.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(descInput),
    new ActionRowBuilder().addComponents(rulesDescInput)
  );

  return modal;
}

/**
 * Build Session Channels & Roles Modal (Page 3)
 */
export function buildSessionChannelsModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_sessionchannels_${botId}`)
    .setTitle('Session Channels & Roles');

  const sessionInput = new TextInputBuilder()
    .setCustomId('sessionChannelId')
    .setLabel('Session Announcements Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1548876816171798678')
    .setRequired(false);
  if (cust.sessionChannelId?.trim()) sessionInput.setValue(cust.sessionChannelId.trim());

  const ingameInput = new TextInputBuilder()
    .setCustomId('ingameVcId')
    .setLabel('In-Game Voice Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1548876816171798679')
    .setRequired(false);
  if (cust.ingameVcId?.trim()) ingameInput.setValue(cust.ingameVcId.trim());

  const queueInput = new TextInputBuilder()
    .setCustomId('queueVcId')
    .setLabel('Queue Voice Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1548876816171798680')
    .setRequired(false);
  if (cust.queueVcId?.trim()) queueInput.setValue(cust.queueVcId.trim());

  const roleInput = new TextInputBuilder()
    .setCustomId('notificationRoleId')
    .setLabel('Staff Notification Role ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1548876816171798681')
    .setRequired(false);
  if (cust.notificationRoleId?.trim()) roleInput.setValue(cust.notificationRoleId.trim());

  const hostRoleInput = new TextInputBuilder()
    .setCustomId('hostRoleId')
    .setLabel('Session Host / Staff Role ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1548876816171798682')
    .setRequired(false);
  if (cust.hostRoleId?.trim()) hostRoleInput.setValue(cust.hostRoleId.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(sessionInput),
    new ActionRowBuilder().addComponents(ingameInput),
    new ActionRowBuilder().addComponents(queueInput),
    new ActionRowBuilder().addComponents(roleInput),
    new ActionRowBuilder().addComponents(hostRoleInput)
  );

  return modal;
}

/**
 * Build Session Banners Modal (Page 3)
 */
export function buildSessionBannersModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_sessionbanners_${botId}`)
    .setTitle('Configure Session Banners');

  const liveInput = new TextInputBuilder()
    .setCustomId('sessionTopBannerUrl')
    .setLabel('Session Live Header Banner URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://... (or leave empty)')
    .setRequired(false);
  if (cust.sessionTopBannerUrl?.trim()) liveInput.setValue(cust.sessionTopBannerUrl.trim());

  const shutInput = new TextInputBuilder()
    .setCustomId('sessionShutdownBannerUrl')
    .setLabel('Session Shutdown Banner URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://... (or leave empty)')
    .setRequired(false);
  if (cust.sessionShutdownBannerUrl?.trim()) shutInput.setValue(cust.sessionShutdownBannerUrl.trim());

  const botInput = new TextInputBuilder()
    .setCustomId('sessionBottomBannerUrl')
    .setLabel('Session Bottom Accent Strip URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://... (or leave empty)')
    .setRequired(false);
  if (cust.sessionBottomBannerUrl?.trim()) botInput.setValue(cust.sessionBottomBannerUrl.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(liveInput),
    new ActionRowBuilder().addComponents(shutInput),
    new ActionRowBuilder().addComponents(botInput)
  );

  return modal;
}

/**
 * Build Session Custom Text & Embed Modal (Page 3)
 */
export function buildSessionTextModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_sessiontext_${botId}`)
    .setTitle('Custom Session Announcement Text');

  const startTitleInput = new TextInputBuilder()
    .setCustomId('sessionStartTitle')
    .setLabel('Session Startup Header Title')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('SESSION STARTING')
    .setMaxLength(100)
    .setRequired(false);
  if (cust.sessionStartTitle?.trim()) startTitleInput.setValue(cust.sessionStartTitle.trim());

  const startDescInput = new TextInputBuilder()
    .setCustomId('sessionStartDesc')
    .setLabel('Session Startup Message Text')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('The session vote has succeeded and staff has officially started...')
    .setMaxLength(1000)
    .setRequired(false);
  if (cust.sessionStartDesc?.trim()) startDescInput.setValue(cust.sessionStartDesc.trim());

  const shutTitleInput = new TextInputBuilder()
    .setCustomId('sessionShutdownTitle')
    .setLabel('Session Shutdown Header Title')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('SESSION CONCLUDED')
    .setMaxLength(100)
    .setRequired(false);
  if (cust.sessionShutdownTitle?.trim()) shutTitleInput.setValue(cust.sessionShutdownTitle.trim());

  const shutDescInput = new TextInputBuilder()
    .setCustomId('sessionShutdownDesc')
    .setLabel('Session Shutdown Message Text')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('The session has concluded. Thank you to everyone who joined...')
    .setMaxLength(1000)
    .setRequired(false);
  if (cust.sessionShutdownDesc?.trim()) shutDescInput.setValue(cust.sessionShutdownDesc.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(startTitleInput),
    new ActionRowBuilder().addComponents(startDescInput),
    new ActionRowBuilder().addComponents(shutTitleInput),
    new ActionRowBuilder().addComponents(shutDescInput)
  );

  return modal;
}

/**
 * Build Infraction Configuration Modal (Page 4)
 */
export function buildInfractionConfigModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_infraction_${botId}`)
    .setTitle('Infraction System Configuration');

  const chanInput = new TextInputBuilder()
    .setCustomId('infractionsChannelId')
    .setLabel('Infractions Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1548876816171798685')
    .setRequired(false);
  if (cust.infractionsChannelId?.trim()) chanInput.setValue(cust.infractionsChannelId.trim());

  const bannerInput = new TextInputBuilder()
    .setCustomId('infractBannerUrl')
    .setLabel('Infraction Panel Banner URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://... (or leave empty)')
    .setRequired(false);
  const existing = cust.infractionBannerUrl || cust.infractBannerUrl;
  if (existing?.trim()) bannerInput.setValue(existing.trim());

  const removeRoleInput = new TextInputBuilder()
    .setCustomId('infractRemoveRoleId')
    .setLabel('Role ID to Remove on Infraction')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1548876816171798681')
    .setRequired(false);
  if (cust.infractRemoveRoleId?.trim()) removeRoleInput.setValue(cust.infractRemoveRoleId.trim());

  const giveRoleInput = new TextInputBuilder()
    .setCustomId('infractGiveRoleId')
    .setLabel('Role ID to Give on Infraction')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1548876816171798682')
    .setRequired(false);
  if (cust.infractGiveRoleId?.trim()) giveRoleInput.setValue(cust.infractGiveRoleId.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(chanInput),
    new ActionRowBuilder().addComponents(bannerInput),
    new ActionRowBuilder().addComponents(removeRoleInput),
    new ActionRowBuilder().addComponents(giveRoleInput)
  );
  return modal;
}

/**
 * Build Promotion Configuration Modal (Page 4)
 */
export function buildPromotionConfigModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_promotion_${botId}`)
    .setTitle('Promotion System Configuration');

  const chanInput = new TextInputBuilder()
    .setCustomId('promotionsChannelId')
    .setLabel('Promotions Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1548876816171798684')
    .setRequired(false);
  if (cust.promotionsChannelId?.trim()) chanInput.setValue(cust.promotionsChannelId.trim());

  const bannerInput = new TextInputBuilder()
    .setCustomId('promoteBannerUrl')
    .setLabel('Promotion Panel Banner URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://... (or leave empty)')
    .setRequired(false);
  const existing = cust.promotionBannerUrl || cust.promoteBannerUrl;
  if (existing?.trim()) bannerInput.setValue(existing.trim());

  const giveRoleInput = new TextInputBuilder()
    .setCustomId('promotionGiveRoleId')
    .setLabel('Role ID Assigned on Promotion')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1548876816171798683')
    .setRequired(false);
  if (cust.promotionGiveRoleId?.trim()) giveRoleInput.setValue(cust.promotionGiveRoleId.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(chanInput),
    new ActionRowBuilder().addComponents(bannerInput),
    new ActionRowBuilder().addComponents(giveRoleInput)
  );
  return modal;
}

/**
 * Build Applications Channels & Text Modal (Page 5)
 */
export function buildAppsModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_apps_${botId}`)
    .setTitle('Applications Channels & Text');

  const reviewInput = new TextInputBuilder()
    .setCustomId('reviewChannelId')
    .setLabel('Staff Review Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1548876816171798680')
    .setRequired(false);
  if (cust.reviewChannelId?.trim()) reviewInput.setValue(cust.reviewChannelId.trim());

  const resultsInput = new TextInputBuilder()
    .setCustomId('resultsChannelId')
    .setLabel('Public Results Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1548876816171798681')
    .setRequired(false);
  if (cust.resultsChannelId?.trim()) resultsInput.setValue(cust.resultsChannelId.trim());

  const titleInput = new TextInputBuilder()
    .setCustomId('appTitle')
    .setLabel('Application Title')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Staff Application')
    .setRequired(false);
  if (cust.appTitle?.trim()) titleInput.setValue(cust.appTitle.trim());

  const descInput = new TextInputBuilder()
    .setCustomId('appDescription')
    .setLabel('Application Description')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Welcome to the staff application portal...')
    .setMaxLength(1000)
    .setRequired(false);
  if (cust.appDescription?.trim()) descInput.setValue(cust.appDescription.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(reviewInput),
    new ActionRowBuilder().addComponents(resultsInput),
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(descInput)
  );

  return modal;
}

/**
 * Build Application Banners & Quiz Modal (Page 5)
 */
export function buildAppQuizModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_appquiz_${botId}`)
    .setTitle('Application Banners & In-Game Quiz');

  const topBannerInput = new TextInputBuilder()
    .setCustomId('appTopBannerUrl')
    .setLabel('Application Top Banner URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://... (or leave empty)')
    .setRequired(false);
  if (cust.appTopBannerUrl?.trim()) topBannerInput.setValue(cust.appTopBannerUrl.trim());

  const botBannerInput = new TextInputBuilder()
    .setCustomId('appBottomBannerUrl')
    .setLabel('Application Bottom Strip URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://... (or leave empty)')
    .setRequired(false);
  if (cust.appBottomBannerUrl?.trim()) botBannerInput.setValue(cust.appBottomBannerUrl.trim());

  const quizInput = new TextInputBuilder()
    .setCustomId('appQuizIntroText')
    .setLabel('In-Game Quiz Intro Text')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Welcome to the quiz! Answer honestly...')
    .setMaxLength(500)
    .setRequired(false);
  if (cust.appQuizIntroText?.trim()) quizInput.setValue(cust.appQuizIntroText.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(topBannerInput),
    new ActionRowBuilder().addComponents(botBannerInput),
    new ActionRowBuilder().addComponents(quizInput)
  );
  return modal;
}

/**
 * Build Server Documentation & Panels Modal (Page 6)
 */
export function buildDocsModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_docs_${botId}`)
    .setTitle('Configure Server Documentation');

  const deptChanInput = new TextInputBuilder()
    .setCustomId('deptChannelId')
    .setLabel('Department Panel Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1548876816171798686')
    .setRequired(false);
  if (cust.deptChannelId?.trim()) deptChanInput.setValue(cust.deptChannelId.trim());

  const deptBannerInput = new TextInputBuilder()
    .setCustomId('deptBannerUrl')
    .setLabel('Department Panel Banner URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://...')
    .setRequired(false);
  if (cust.deptBannerUrl?.trim()) deptBannerInput.setValue(cust.deptBannerUrl.trim());

  const regChanInput = new TextInputBuilder()
    .setCustomId('regulationsChannelId')
    .setLabel('Regulations Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1548876816171798688')
    .setRequired(false);
  if (cust.regulationsChannelId?.trim()) regChanInput.setValue(cust.regulationsChannelId.trim());

  const regBannerInput = new TextInputBuilder()
    .setCustomId('regulationsBannerUrl')
    .setLabel('Regulations Panel Banner URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://...')
    .setRequired(false);
  if (cust.regulationsBannerUrl?.trim()) regBannerInput.setValue(cust.regulationsBannerUrl.trim());

  const docsChanInput = new TextInputBuilder()
    .setCustomId('staffDocsChannelId')
    .setLabel('Staff Docs Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1548876816171798687')
    .setRequired(false);
  if (cust.staffDocsChannelId?.trim()) docsChanInput.setValue(cust.staffDocsChannelId.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(deptChanInput),
    new ActionRowBuilder().addComponents(deptBannerInput),
    new ActionRowBuilder().addComponents(regChanInput),
    new ActionRowBuilder().addComponents(regBannerInput),
    new ActionRowBuilder().addComponents(docsChanInput)
  );

  return modal;
}

/**
 * Build Welcome System Modal (Page 7)
 */
export function buildWelcomeModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_welcome_${botId}`)
    .setTitle('Configure Welcome System');

  const channelInput = new TextInputBuilder()
    .setCustomId('welcomeChannelId')
    .setLabel('Welcome Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1548147497854181397')
    .setRequired(false);
  if (cust.welcomeChannelId?.trim()) channelInput.setValue(cust.welcomeChannelId.trim());

  const bannerInput = new TextInputBuilder()
    .setCustomId('welcomeBannerUrl')
    .setLabel('Welcome Card Top Banner URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://... (or leave empty)')
    .setRequired(false);
  if (cust.welcomeBannerUrl?.trim()) bannerInput.setValue(cust.welcomeBannerUrl.trim());

  const textInput = new TextInputBuilder()
    .setCustomId('welcomeText')
    .setLabel('Welcome Message Template ({user}, {server})')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Welcome to {server}, {user}! Please read the rules...')
    .setMaxLength(1000)
    .setRequired(false);
  if (cust.welcomeText?.trim()) textInput.setValue(cust.welcomeText.trim());

  modal.addComponents(
    new ActionRowBuilder().addComponents(channelInput),
    new ActionRowBuilder().addComponents(bannerInput),
    new ActionRowBuilder().addComponents(textInput)
  );
  return modal;
}

/**
 * Build AI Key Modal (Page 8) - API Key and Provider only (NO model name field!)
 */
export function buildAiKeyModal(botId) {
  const bot = getBotInstance(botId);
  const cust = bot?.customizations || {};

  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_aikey_${botId}`)
    .setTitle('Configure AI Assistant');

  const keyInput = new TextInputBuilder()
    .setCustomId('aiApiKey')
    .setLabel('AI API Key (Required)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Paste your OpenRouter (sk-or-...) or OpenAI API key')
    .setRequired(true);
  const existingKey = bot?.aiApiKey || cust.aiApiKey;
  if (existingKey && existingKey.trim().length > 0) {
    keyInput.setValue(existingKey.trim());
  }

  const providerInput = new TextInputBuilder()
    .setCustomId('aiProvider')
    .setLabel('Provider (openrouter, openai, groq, gemini)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('openrouter')
    .setRequired(false);
  const existingProv = bot?.aiProvider || cust.aiProvider || 'openrouter';
  providerInput.setValue(existingProv);

  modal.addComponents(
    new ActionRowBuilder().addComponents(keyInput),
    new ActionRowBuilder().addComponents(providerInput)
  );

  return modal;
}

/**
 * Build Ask AI Modal (Page 8)
 */
export function buildAskAiModal(botId) {
  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal_askai_${botId}`)
    .setTitle('Ask AI Configuration Assistant');

  const promptInput = new TextInputBuilder()
    .setCustomId('prompt')
    .setLabel('What would you like to configure?')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('e.g. Set my session channel to 123456789 and enable welcome messages...')
    .setMinLength(5)
    .setMaxLength(1000)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(promptInput));
  return modal;
}
