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
    customerClient.botId = bot.botId;

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

    customerClient.on(Events.Error, err => {
      if (err.code === 10062 || err.code === 40060) return;
      console.warn(`[CUSTOMER BOT ${botId}] Error:`, err.message);
    });

    // Send Welcome Message when a new member joins on customer bot's server
    customerClient.on(Events.GuildMemberAdd, async member => {
      try {
        const currentBot = getBotInstance(botId);
        if (!currentBot || currentBot.banned) return;
        const cust = currentBot?.customizations;
        if (!cust?.welcomeEnabled) return;

        const guild = member.guild;
        let channel = null;

        if (cust.welcomeChannelId) {
          channel = guild.channels.cache.get(cust.welcomeChannelId) ||
            await guild.channels.fetch(cust.welcomeChannelId).catch(() => null);
        }

        if (!channel) {
          const fetched = await guild.channels.fetch().catch(() => guild.channels.cache);
          channel = fetched?.find?.(c =>
            c && c.isTextBased() && (
              c.name.toLowerCase().includes('welcome') ||
              c.name.toLowerCase().includes('joins') ||
              c.name === '𝖬𝖺𝗂𝗇' ||
              c.name.toLowerCase() === 'main'
            )
          );
        }

        if (!channel && guild.systemChannel && guild.systemChannel.isTextBased()) {
          channel = guild.systemChannel;
        }

        if (!channel) return;

        const welcomeTemplate = cust.welcomeText || "Welcome to {server}, {user}! Enjoy your stay.";
        const memberCount = (guild.memberCount || 1).toLocaleString();
        const serverName = cust.serverName || guild.name || 'our server';

        const formattedMsg = welcomeTemplate
          .replace(/{user}/g, `<@${member.id}>`)
          .replace(/{username}/g, member.user.username)
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
          content: formattedMsg
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

    await customerClient.login(bot.token);
    activeCustomerClients.set(bot.botId, customerClient);
    updateBotInstance(bot.botId, { status: 'active', setupCompleted: true });
    return true;
  } catch (err) {
    console.error(`[CUSTOMER BOT ${botId}] Login failed:`, err.message);
    updateBotInstance(botId, { status: 'invalid_token' });
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
