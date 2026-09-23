import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActivityType
} from 'discord.js';
import { loadBotInstances, getBotInstance, updateBotInstance } from './botManager.js';
import { deployCommands, customerCommands } from './deploy-commands.js';

// Map of active running clients: botId -> Client
export const activeCustomerClients = new Map();

let interactionHandler = null;

/**
 * Register the main interaction handler function to be shared across customer bots
 */
export function setInteractionHandler(handler) {
  interactionHandler = handler;
}
export async function startCustomerBot(botId) {
  const bot = getBotInstance(botId);
  if (!bot || !bot.token || bot.token.trim() === '' || bot.banned) {
    return false;
  }

  // If already running, clean up old client first
  if (activeCustomerClients.has(botId)) {
    try {
      const oldClient = activeCustomerClients.get(botId);
      oldClient.destroy();
    } catch (e) {
      console.warn(`[CUSTOMER BOT] Error stopping old client for ${botId}:`, e.message);
    }
    activeCustomerClients.delete(botId);
  }

  try {
    const customerClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildEmojisAndStickers
      ],
      partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User]
    });
    customerClient.botId = botId;

    customerClient.once(Events.ClientReady, async () => {
      console.log(`=============================================`);
      console.log(`[CUSTOMER BOT ONLINE] Bot ID ${botId} logged in as ${customerClient.user.tag}`);
      console.log(`=============================================`);

      try {
        customerClient.user.setPresence({
          activities: [{ name: 'ER:LC', type: ActivityType.Watching }],
          status: 'online'
        });
      } catch {}

      // 1. Deploy Global Slash Commands for customer bot (visible across all servers)
      try {
        await deployCommands(bot.token, customerClient.user.id, null, false);
      } catch (e) {
        console.warn(`[CUSTOMER BOT] Global deploy note:`, e.message);
      }

      // 2. Also register directly to every guild the bot is in for instant availability
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

    customerClient.on(Events.Error, err => {
      if (err.code === 10062 || err.code === 40060) return;
      console.warn(`[CUSTOMER BOT ${botId}] Error:`, err.message);
    });

    // Handle slash commands, buttons, and modals for this customer bot
    customerClient.on(Events.InteractionCreate, async interaction => {
      try {
        if (interactionHandler) {
          await interactionHandler(interaction);
        }
      } catch (err) {
        if (err.code === 10062 || err.code === 40060) return;
        console.error(`[CUSTOMER BOT ${botId}] Interaction error:`, err);
      }
    });

    await customerClient.login(bot.token);
    activeCustomerClients.set(botId, customerClient);
    updateBotInstance(botId, { status: 'active', setupCompleted: true });
    return true;
  } catch (err) {
    console.error(`[CUSTOMER BOT ${botId}] Login failed:`, err.message);
    updateBotInstance(botId, { status: 'invalid_token' });
    return false;
  }
}

/**
 * Stop a running customer bot.
 */
export function stopCustomerBot(botId) {
  if (activeCustomerClients.has(botId)) {
    try {
      const client = activeCustomerClients.get(botId);
      client.destroy();
    } catch {}
    activeCustomerClients.delete(botId);
    return true;
  }
  return false;
}

/**
 * Start all configured customer bots on startup.
 */
export async function startAllConfiguredBots() {
  const instances = loadBotInstances();
  for (const [bId, bot] of Object.entries(instances)) {
    if (bot.token && bot.token.trim() !== '' && bot.setupCompleted && !bot.banned) {
      console.log(`[STARTUP] Auto-connecting customer bot ${bId}...`);
      await startCustomerBot(bId).catch(err => {
        console.warn(`[STARTUP] Error starting bot ${bId}:`, err.message);
      });
    }
  }
}
