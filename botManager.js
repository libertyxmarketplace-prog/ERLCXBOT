import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const INSTANCES_FILE = path.join(DATA_DIR, 'bot_instances.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

import dotenv from 'dotenv';
dotenv.config();

export const PRIMARY_BOT_ID = "LC-74921";
export const MASTER_BOT_ID = PRIMARY_BOT_ID;
export const MASTER_TOKEN = process.env.DISCORD_TOKEN || "";

export const DEFAULT_CUSTOMIZATIONS = {
  // ─── Ticket ────────────────────────────────────────────────────────────────
  panelTitle: "Support",
  panelDescription:
    "> If you require support, we ask you to **open a ticket and our team will be ready to help**. Choose the category that matches your issue below and a private channel will be opened for you. Any trolling or rule violations will result in instant moderation towards your account.",
  rulesTitle: "TICKET CENTER",
  rulesDescription:
    "> Need help, want to report an issue, or have a question for our team? Select the ticket option that best matches your situation.\n" +
    "> Before opening a ticket, please read the information below carefully.\n\n" +
    "### TICKET GUIDELINES\n" +
    "> • Only open a ticket when you have a legitimate reason for doing so.\n" +
    "> • Please do not spam, troll, or intentionally misuse the ticket system.\n" +
    "> • Be respectful when speaking with our staff team. Disrespect, arguing, or unnecessary behavior may result in moderation action.\n\n" +
    "### RESPONSE REQUIREMENTS\n" +
    "> • Please respond to your ticket within 24 hours. Tickets with no response may be closed.\n" +
    "> • Provide clear and accurate information so our team can assist you properly.",
  topBannerUrl: "",
  bottomBannerUrl: "",
  // Ticket categories (up to 5 customizable slots without emojis)
  ticketCategories: [
    { id: "cat_1", name: "General Support", spawnCategoryId: "", pingRoleId: "" },
    { id: "cat_2", name: "High Rank", spawnCategoryId: "", pingRoleId: "" },
    { id: "cat_3", name: "Player Report", spawnCategoryId: "", pingRoleId: "" },
    { id: "cat_4", name: "Appeals", spawnCategoryId: "", pingRoleId: "" },
    { id: "cat_5", name: "Other", spawnCategoryId: "", pingRoleId: "" }
  ],
  ticketPingRoleId: "",         // Default fallback role to ping when ticket opens
  transcriptsChannelId: "",
  ticketCategoryId: "",         // Default fallback Discord category where ticket channels spawn

  // ─── Sessions / ER:LC ─────────────────────────────────────────────────────
  sessionTopBannerUrl: "",
  sessionShutdownBannerUrl: "",
  sessionBottomBannerUrl: "",
  sessionChannelId: "",
  ingameVcId: "",
  queueVcId: "",
  notificationRoleId: "",
  hostRoleId: "",               // Role allowed to start/stop sessions
  sessionStartTitle: "SESSION STARTING",
  sessionStartDesc: "The session vote has succeeded and staff has officially started the patrol. Join up in-game now!",
  sessionShutdownTitle: "SESSION CONCLUDED",
  sessionShutdownDesc: "The session has concluded. Thank you to everyone who joined our patrol!",

  // ─── Branding & Graphics ──────────────────────────────────────────────────
  appTopBannerUrl: "",
  appBottomBannerUrl: "",
  infractBannerUrl: "",
  promoteBannerUrl: "",
  staffDocsTopBannerUrl: "",
  staffDocsBottomBannerUrl: "",
  deptBannerUrl: "",
  regulationsBannerUrl: "",
  regulationsChannelId: "",
  welcomeBannerUrl: "",

  // ─── Staff Panels ──────────────────────────────────────────────────────────
  infractRemoveRoleId: "",      // Role removed when infraction issued
  infractGiveRoleId: "",        // Role given when infraction issued
  promotionGiveRoleId: "",      // Role assigned on promotion
  appDescription:
    "> Welcome to the official Staff Application portal.\n" +
    "> Holding a staff position is a privilege that requires consistent activity, professionalism, and accountability.",
  appTitle: "Staff Application",
  appQuizIntroText: "Welcome to the in-game quiz! Answer all questions honestly. Your response will be reviewed by management.",

  // ─── Welcome System ────────────────────────────────────────────────────────
  welcomeEnabled: false,
  welcomeChannelId: "",
  welcomeText: "Welcome to the server, {user}! We're glad to have you here. Please read the rules and enjoy your stay.",

  // ─── Community & Applications ─────────────────────────────────────────────
  serverName: "",
  reviewChannelId: "",
  resultsChannelId: "",

  // ─── Panel Channels ────────────────────────────────────────────────────────
  promotionsChannelId: "",
  infractionsChannelId: "",
  deptChannelId: "",
  staffDocsChannelId: "",

  // ─── Staff Roles ───────────────────────────────────────────────────────────
  staffRoleIds: [],

  // ─── AI ────────────────────────────────────────────────────────────────────
  aiProvider: "openrouter",
  aiModel: "openai/gpt-4o-mini",
  aiApiKey: ""
};


/**
 * Load all bot instances from disk
 */
export function loadBotInstances() {
  try {
    if (!fs.existsSync(INSTANCES_FILE)) {
      const initial = {
        [MASTER_BOT_ID]: {
          botId: MASTER_BOT_ID,
          ownerUserId: "OWNER",
          token: MASTER_TOKEN,
          erlcApiKey: "",
          status: "unconfigured",
          setupCompleted: false,
          banned: false,
          bannedReason: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          customizations: { ...DEFAULT_CUSTOMIZATIONS }
        }
      };
      fs.writeFileSync(INSTANCES_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(INSTANCES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading bot instances:", err);
    return {};
  }
}

/**
 * Save all bot instances to disk
 */
export function saveBotInstances(instances) {
  try {
    fs.writeFileSync(INSTANCES_FILE, JSON.stringify(instances, null, 2), 'utf-8');
  } catch (err) {
    console.error("Error saving bot instances:", err);
  }
}

/**
 * Generate a unique identification number for each bot (e.g. BOT-4821)
 */
export function generateBotId() {
  const instances = loadBotInstances();
  let botId = '';
  do {
    const num = Math.floor(10000 + Math.random() * 90000);
    botId = `LC-${num}`;
  } while (instances[botId]);
  return botId;
}

/**
 * Create a new customer bot instance
 */
export function createBotInstance(ownerUserId, options = {}) {
  const instances = loadBotInstances();
  const botId = options.botId || generateBotId();

  instances[botId] = {
    botId,
    ownerUserId: ownerUserId || 'UNASSIGNED',
    token: options.token || '',
    erlcApiKey: options.erlcApiKey || '',
    aiApiKey: options.aiApiKey || '',
    aiProvider: options.aiProvider || 'openai',
    status: (options.token && options.erlcApiKey) ? 'active' : 'unconfigured',
    setupCompleted: Boolean(options.token && options.erlcApiKey),
    banned: false,
    bannedReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    guildId: options.guildId || null,
    customizations: {
      ...DEFAULT_CUSTOMIZATIONS,
      ...(options.customizations || {})
    }
  };

  saveBotInstances(instances);
  return instances[botId];
}

/**
 * Fetch a bot instance by its Bot ID
 */
export function getBotInstance(botId) {
  const instances = loadBotInstances();
  return instances[botId] || null;
}

/**
 * Find bot instance associated with a Guild ID or user ID
 */
export function getBotInstanceForGuild(guildId, ownerUserId = null) {
  const instances = loadBotInstances();
  // 1. Match by owner first
  if (ownerUserId) {
    for (const bot of Object.values(instances)) {
      if (bot.ownerUserId === ownerUserId) return bot;
    }
  }
  // 2. Exact match by guild
  for (const bot of Object.values(instances)) {
    if (bot.guildId === guildId && bot.botId !== MASTER_BOT_ID) return bot;
  }
  // 3. Fallback to Master
  return instances[MASTER_BOT_ID] || null;
}

/**
 * Get or create a dedicated bot instance for a user
 */
export function getOrCreateBotInstanceForUser(ownerUserId, guildId = null) {
  const instances = loadBotInstances();
  if (ownerUserId) {
    for (const bot of Object.values(instances)) {
      if (bot.ownerUserId === ownerUserId) return bot;
    }
  }
  return createBotInstance(ownerUserId, { guildId });
}

/**
 * Update an existing bot instance
 */
export function updateBotInstance(botId, updates) {
  const instances = loadBotInstances();
  if (!instances[botId]) return null;

  instances[botId] = {
    ...instances[botId],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  // Re-check setup completion
  if (instances[botId].token && instances[botId].erlcApiKey) {
    instances[botId].setupCompleted = true;
    if (instances[botId].status === 'unconfigured') {
      instances[botId].status = 'active';
    }
  }

  saveBotInstances(instances);
  return instances[botId];
}

/**
 * Update specific customization property for a bot
 */
export function updateBotCustomization(botId, key, value) {
  const instances = loadBotInstances();
  if (!instances[botId]) return null;

  if (!instances[botId].customizations) {
    instances[botId].customizations = { ...DEFAULT_CUSTOMIZATIONS };
  }

  instances[botId].customizations[key] = value;
  instances[botId].updatedAt = new Date().toISOString();
  saveBotInstances(instances);
  return instances[botId];
}

/**
 * Retrigger / restart a customer's bot instance
 */
export function retriggerBot(botId) {
  const instances = loadBotInstances();
  const bot = instances[botId];
  if (!bot) {
    return { success: false, message: `Bot ID '${botId}' not found.` };
  }
  if (bot.banned) {
    return { success: false, message: `Cannot retrigger bot '${botId}' because it is banned.` };
  }

  bot.status = 'active';
  bot.lastRetriggeredAt = new Date().toISOString();
  saveBotInstances(instances);

  return {
    success: true,
    message: `Bot '${botId}' has been retriggered and refreshed successfully.`,
    bot
  };
}

/**
 * Ban a bot instance
 */
export function banBot(botId, reason = 'Administrative action by owner') {
  const instances = loadBotInstances();
  const bot = instances[botId];
  if (!bot) {
    return { success: false, message: `Bot ID '${botId}' not found.` };
  }
  if (botId === MASTER_BOT_ID) {
    return { success: false, message: `The Master Bot cannot be banned.` };
  }

  bot.banned = true;
  bot.bannedReason = reason;
  bot.status = 'banned';
  bot.bannedAt = new Date().toISOString();
  saveBotInstances(instances);

  return { success: true, message: `Bot '${botId}' has been banned. Reason: ${reason}`, bot };
}

/**
 * Unban a bot instance
 */
export function unbanBot(botId) {
  const instances = loadBotInstances();
  const bot = instances[botId];
  if (!bot) {
    return { success: false, message: `Bot ID '${botId}' not found.` };
  }

  bot.banned = false;
  bot.bannedReason = null;
  bot.status = bot.setupCompleted ? 'active' : 'unconfigured';
  bot.unbannedAt = new Date().toISOString();
  saveBotInstances(instances);

  return { success: true, message: `Bot '${botId}' has been unbanned.`, bot };
}

/**
 * Get all bot instances as a list
 */
export function listBots() {
  const instances = loadBotInstances();
  return Object.values(instances);
}

/**
 * Resolves the bot instance associated with a Discord interaction
 * Works seamlessly across both Master Bot and Customer Bots.
 */
export function getBotForInteraction(interaction) {
  if (!interaction) return null;
  const instances = loadBotInstances();

  // 1. Direct botId attached to client
  if (interaction.client?.botId && instances[interaction.client.botId]) {
    return instances[interaction.client.botId];
  }

  // 2. Match by client application/user ID
  const clientId = interaction.client?.user?.id;
  if (clientId) {
    for (const b of Object.values(instances)) {
      if (b.botId === clientId || b.clientId === clientId) {
        return b;
      }
    }
  }

  // 3. Match by guild ID if bot was registered for guild
  if (interaction.guildId && instances[interaction.guildId]) {
    return instances[interaction.guildId];
  }

  // 4. Fallback to Master Bot instance
  return instances[MASTER_BOT_ID] || null;
}

