import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActivityType
} from 'discord.js';
import { loadBotInstances, getBotInstance, updateBotInstance, setOnBotBanned, setOnBotUnbanned } from './botManager.js';
import { deployCommands, customerCommands } from './deploy-commands.js';

// Map of active running clients: botId -> Client
export const activeCustomerClients = new Map();

// Deduplication set for welcome messages (guildId_memberId -> timestamp)
const recentlyWelcomed = new Set();

let interactionHandler = null;
let messageHandler = null;

// Immediately enforce ban actions across customer bot clients
setOnBotBanned(async (botId) => {
  console.log(`[CUSTOMER BOT] Administrative ban received for ${botId}. Disconnecting and destroying client...`);
  await stopCustomerBot(botId);
});

setOnBotUnbanned(async (botId) => {
  const bot = getBotInstance(botId);
  if (bot?.token && bot.token.trim() !== '' && bot.setupCompleted && !bot.banned) {
    console.log(`[CUSTOMER BOT] Bot ${botId} unbanned. Re-establishing connection...`);
    await startCustomerBot(botId).catch(err => {
      console.warn(`[CUSTOMER BOT] Error reconnecting unbanned bot ${botId}:`, err.message);
    });
  }
});

/**
 * Register the main interaction handler function to be shared across customer bots
 */
export function setInteractionHandler(handler) {
  interactionHandler = handler;
}

/**
 * Register the main message handler function to be shared across customer bots for prefix commands
 */
export function setMessageHandler(handler) {
  messageHandler = handler;
}

function createCustomerClient(bot, intents) {
  const botId = bot.botId;
  const customerClient = new Client({
    intents,
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User]
  });
  customerClient.botId = botId;

    customerClient.once(Events.ClientReady, async () => {
      console.log(`=============================================`);
      console.log(`[CUSTOMER BOT ONLINE] Bot ID ${bot.botId} logged in as ${customerClient.user.tag} (${customerClient.user.id})`);
      console.log(`=============================================`);

      updateBotInstance(bot.botId, {
        discordBotId: customerClient.user.id,
        discordTag: customerClient.user.tag
      });

      try {
        customerClient.user.setPresence({
          activities: [{ name: 'ER:LC', type: ActivityType.Watching }],
          status: 'online'
        });
      } catch {}

      // Register directly to every guild the bot is in for instant availability (clearing global to avoid duplicates)
      for (const guild of customerClient.guilds.cache.values()) {
        try {
          await deployCommands(bot.token, customerClient.user.id, guild.id, false);
          console.log(`[CUSTOMER BOT] Commands deployed for ${customerClient.user.tag} in ${guild.name} (${guild.id})`);
        } catch (depErr) {
          console.warn(`[CUSTOMER BOT] Could not deploy commands in ${guild.name}:`, depErr.message);
        }
      }
    });

    // Deploy commands if added to a new guild while online
    customerClient.on(Events.GuildCreate, async guild => {
      console.log(`[CUSTOMER BOT] ${customerClient.user.tag} joined guild: ${guild.name} (${guild.id})`);
      try {
        await deployCommands(bot.token, customerClient.user.id, guild.id, false);
      } catch (err) {
        console.warn(`[CUSTOMER BOT] Guild join command deploy failed:`, err.message);
      }
    });

    // Automated self-healing reconnect listeners
    customerClient.on(Events.ShardDisconnect, async (closeEvent, shardId) => {
      console.warn(`[CUSTOMER BOT ${botId}] Shard ${shardId} disconnected (code: ${closeEvent?.code}). Initiating auto-reconnect...`);
      scheduleBotReconnect(botId, 3000);
    });

    customerClient.on(Events.ShardError, (error, shardId) => {
      console.warn(`[CUSTOMER BOT ${botId}] Shard ${shardId} network error:`, error?.message);
    });

    customerClient.on(Events.ShardResume, (shardId, replayedEvents) => {
      console.log(`[CUSTOMER BOT ${botId}] Shard ${shardId} connection resumed (${replayedEvents} events replayed).`);
    });

    customerClient.on(Events.Error, err => {
      if (err.code === 10062 || err.code === 40060) return;
      console.warn(`[CUSTOMER BOT ${botId}] Error:`, err.message);
      if (!customerClient.ws || customerClient.ws.status === 5) {
        scheduleBotReconnect(botId, 4000);
      }
    });

    // Send Welcome Message when a new member joins on customer bot's server
    customerClient.on(Events.GuildMemberAdd, async member => {
      try {
        const currentBot = getBotInstance(botId);
        if (!currentBot || currentBot.banned) return;
        const cust = currentBot?.customizations;
        if (!cust?.welcomeEnabled || !cust?.welcomeChannelId) return;

        const guild = member.guild;
        const dedupeKey = `${guild.id}_${member.id}`;
        if (recentlyWelcomed.has(dedupeKey)) return;
        recentlyWelcomed.add(dedupeKey);
        setTimeout(() => recentlyWelcomed.delete(dedupeKey), 60000);

        const channel = guild.channels.cache.get(cust.welcomeChannelId) ||
          await guild.channels.fetch(cust.welcomeChannelId).catch(() => null);

        if (!channel || !channel.isTextBased()) return;

        const serverName = cust.serverName || guild.name || 'our community';
        const welcomeTemplate = cust.welcomeText || "Welcome to {server}, {user}! Please check the rules and enjoy your stay.";
        const memberCount = (guild.memberCount || 1).toLocaleString();

        const formattedMsg = welcomeTemplate
          .replace(/{user}/g, `<@${member.id}>`)
          .replace(/{username}/g, member.user?.username || '')
          .replace(/{server}/g, serverName)
          .replace(/{count}/g, memberCount);

        const containerComponents = [];
        if (cust.welcomeBannerUrl && cust.welcomeBannerUrl.trim() !== '') {
          containerComponents.push({
            type: 12,
            items: [{ media: { url: cust.welcomeBannerUrl.trim() } }]
          });
        }

        containerComponents.push({
          type: 10,
          content: [
            `# Welcome to ${serverName}`,
            `> ${formattedMsg}`,
            ``,
            `*You are member **#${memberCount}**.*`
          ].join('\n')
        });

        // Pill with member count
        containerComponents.push({
          type: 1,
          components: [
            {
              type: 2,
              style: 2,
              label: `${memberCount} Members`,
              disabled: true,
              custom_id: 'welcome_member_count_pill'
            }
          ]
        });

        await channel.send({
          flags: 32768,
          components: [
            {
              type: 17,
              components: containerComponents
            }
          ]
        });
        console.log(`[CUSTOMER BOT ${botId}] Sent welcome card for ${member.user.tag} in #${channel.name}`);
      } catch (wErr) {
        console.warn(`[CUSTOMER BOT ${botId}] Welcome send error:`, wErr.message);
      }
    });

    // Handle slash commands, buttons, and modals for this customer bot
    customerClient.on(Events.InteractionCreate, async interaction => {
      try {
        const cid = interaction.customId || '';
        if (cid.startsWith('cfg_')) return;
        const MASTER_CMDS = ['config', 'banbot', 'createbot', 'unbanbot', 'listbots', 'retrigger'];
        if (interaction.isChatInputCommand() && MASTER_CMDS.includes(interaction.commandName)) return;

        const currentBot = getBotInstance(botId);
        if (!currentBot || currentBot.banned) {
          console.warn(`[CUSTOMER BOT ${botId}] Blocked interaction on banned bot instance.`);
          await stopCustomerBot(botId);
          if (interaction.isRepliable()) {
            return interaction.reply({
              content: `<:xmark:1552901454098989056> **Bot Instance Suspended**\n> This bot instance (\`${botId}\`) has been suspended by administration.\n> **Reason:** \`${currentBot?.bannedReason || 'Violation of service terms'}\``,
              flags: 64
            }).catch(() => null);
          }
          return;
        }

        if (interactionHandler) {
          await interactionHandler(interaction);
        }
      } catch (err) {
        if (err.code === 10062 || err.code === 40060) return;
        console.error(`[CUSTOMER BOT ${botId}] Interaction error:`, err);
      }
    });

    // Handle prefix commands for this customer bot
    customerClient.on(Events.MessageCreate, async message => {
      try {
        const currentBot = getBotInstance(botId);
        if (!currentBot || currentBot.banned) {
          await stopCustomerBot(botId);
          return;
        }

        if (messageHandler) {
          await messageHandler(message);
        }
      } catch (err) {
        console.error(`[CUSTOMER BOT ${botId}] Message error:`, err);
      }
    });

  return customerClient;
}

export async function startCustomerBot(botId) {
  const bot = getBotInstance(botId);
  if (!bot || !bot.token || bot.token.trim() === '' || bot.banned) {
    if (bot?.banned && activeCustomerClients.has(botId)) {
      await stopCustomerBot(botId);
    }
    return false;
  }

  // If already running, clean up old client first
  if (activeCustomerClients.has(botId)) {
    await stopCustomerBot(botId);
  }

  const fullIntents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildEmojisAndStickers
  ];

  const standardIntents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildEmojisAndStickers
  ];

  async function connectClient(intents) {
    const client = createCustomerClient(bot, intents);
    let timer = null;
    try {
      const readyPromise = new Promise((resolve) => {
        if (client.isReady()) {
          return resolve(client);
        }
        timer = setTimeout(() => {
          resolve(client);
        }, 8000);

        client.once(Events.ClientReady, () => {
          clearTimeout(timer);
          resolve(client);
        });
      });

      await client.login(bot.token.trim());
      await readyPromise;
      return client;
    } catch (err) {
      if (timer) clearTimeout(timer);
      client.removeAllListeners();
      await client.destroy().catch(() => null);
      throw err;
    }
  }

  let clientToUse = null;
  try {
    // Attempt standard gateway intents for universal, 100% instant connectivity without developer portal blockers
    try {
      clientToUse = await connectClient(standardIntents);
      console.log(`[CUSTOMER BOT ${bot.botId}] Connected successfully with standard gateway intents.`);
    } catch (stdErr) {
      // If error is privileged intents or other, retry with full intents if requested
      const msg = stdErr?.message || '';
      if (!msg.includes('invalid token') && !stdErr.code?.includes('TokenInvalid')) {
        console.warn(`[CUSTOMER BOT ${bot.botId}] Standard intents connection note (${msg}), attempting full intents...`);
        clientToUse = await connectClient(fullIntents);
      } else {
        throw stdErr;
      }
    }

    activeCustomerClients.set(bot.botId, clientToUse);
    let resolvedId = clientToUse.user?.id;
    if (!resolvedId && bot.token) {
      try {
        const raw = Buffer.from(bot.token.split('.')[0], 'base64').toString('utf-8');
        if (/^\d{17,20}$/.test(raw)) resolvedId = raw;
      } catch {}
    }
    const resolvedTag = clientToUse.user?.tag || `Customer Bot (${bot.botId})`;

    updateBotInstance(bot.botId, {
      discordBotId: resolvedId,
      discordTag: resolvedTag,
      status: 'active',
      setupCompleted: true,
      banned: false,
      bannedReason: null
    });
    return true;
  } catch (err) {
    console.error(`[CUSTOMER BOT ${botId}] Login failed:`, err.message);
    if (clientToUse) {
      clientToUse.removeAllListeners();
      await clientToUse.destroy().catch(() => null);
    }
    if (err.message && (err.message.includes('An invalid token was provided') || err.code === 'TokenInvalid')) {
      updateBotInstance(botId, { status: 'invalid_token' });
    }
    return false;
  }
}

/**
 * Stop and completely disconnect a running customer bot.
 */
export async function stopCustomerBot(botId) {
  const bot = getBotInstance(botId);
  const actualId = bot ? bot.botId : botId;
  if (activeCustomerClients.has(actualId)) {
    try {
      const client = activeCustomerClients.get(actualId);
      activeCustomerClients.delete(actualId);
      if (client) {
        client.removeAllListeners();
        await client.destroy().catch(() => null);
      }
      console.log(`[CUSTOMER BOT] Client for bot ${actualId} completely shut off and destroyed.`);
      return true;
    } catch (e) {
      console.warn(`[CUSTOMER BOT] Error stopping bot ${actualId}:`, e.message);
      activeCustomerClients.delete(actualId);
      return false;
    }
  }
  return false;
}

const reconnectTimeouts = new Map();

/**
 * Debounced self-healing reconnection scheduler
 */
export function scheduleBotReconnect(botId, delayMs = 3000) {
  if (reconnectTimeouts.has(botId)) return;

  const timer = setTimeout(async () => {
    reconnectTimeouts.delete(botId);
    const bot = getBotInstance(botId);
    if (!bot || bot.banned || !bot.token || bot.status === 'invalid_token') return;
    console.log(`[CUSTOMER BOT WATCHDOG] Executing self-healing reconnect for bot ${botId}...`);
    await startCustomerBot(botId).catch(err => {
      console.warn(`[CUSTOMER BOT WATCHDOG] Reconnect error for bot ${botId}:`, err.message);
    });
  }, delayMs);

  reconnectTimeouts.set(botId, timer);
}

let watchdogTimer = null;

/**
 * 24/7 Watchdog Heartbeat that ensures all active customer bots remain online
 */
export function startWatchdog() {
  if (watchdogTimer) return;
  console.log('[CUSTOMER BOT WATCHDOG] Active 24/7 keep-alive monitoring service started.');
  watchdogTimer = setInterval(async () => {
    try {
      const instances = loadBotInstances();
      for (const [bId, bot] of Object.entries(instances)) {
        if (!bot.token || bot.token.trim() === '' || bot.banned || bot.status === 'invalid_token') {
          continue;
        }

        const client = activeCustomerClients.get(bId);
        // If client is missing, not ready, or disconnected from gateway
        const isOffline = !client || !client.isReady() || (client.ws && client.ws.status !== 0);
        if (isOffline) {
          console.warn(`[CUSTOMER BOT WATCHDOG] Bot ${bId} is offline or stalled (status: ${client?.ws?.status ?? 'none'}). Self-healing...`);
          scheduleBotReconnect(bId, 1000);
        }
      }
    } catch (wErr) {
      console.warn('[CUSTOMER BOT WATCHDOG ERROR]:', wErr.message);
    }
  }, 20000); // Check every 20 seconds
}

/**
 * Start all configured customer bots on startup and start keep-alive watchdog.
 */
export async function startAllConfiguredBots() {
  startWatchdog();
  const instances = loadBotInstances();
  for (const [bId, bot] of Object.entries(instances)) {
    if (bot.token && bot.token.trim() !== '' && !bot.banned && bot.status !== 'invalid_token') {
      console.log(`[STARTUP] Auto-connecting customer bot ${bId}...`);
      await startCustomerBot(bId).catch(err => {
        console.warn(`[STARTUP] Error starting bot ${bId}:`, err.message);
      });
    }
  }
}

