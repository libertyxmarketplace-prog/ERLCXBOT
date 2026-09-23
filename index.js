import {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  AttachmentBuilder,
  ChannelType,
  Events
} from 'discord.js';
import fs from 'fs';
import dotenv from 'dotenv';
import { CONFIG } from './config.js';
import {
  loadBotInstances,
  getBotInstance,
  getBotInstanceForGuild,
  getOrCreateBotInstanceForUser,
  updateBotInstance,
  updateBotCustomization,
  createBotInstance,
  retriggerBot,
  banBot,
  unbanBot,
  listBots,
  MASTER_BOT_ID,
  DEFAULT_CUSTOMIZATIONS,
  getBotForInteraction
} from './botManager.js';
import {
  buildConfigPanelPayload,
  buildCredentialsModal,
  buildServerCoreModal,
  buildTicketCategoryNamesModal,
  buildTicketCategorySpawnsModal,
  buildTicketCategoryPingsModal,
  buildTicketBannersModal,
  buildSupportTextModal,
  buildSessionChannelsModal,
  buildSessionBannersModal,
  buildSessionTextModal,
  buildInfractionConfigModal,
  buildPromotionConfigModal,
  buildAppsModal,
  buildAppQuizModal,
  buildDocsModal,
  buildWelcomeModal,
  buildAiKeyModal,
  buildAskAiModal,
  TOTAL_PAGES,
  EMOJIS
} from './configPanel.js';
import { startCustomerBot, startAllConfiguredBots, setInteractionHandler } from './customerBotRunner.js';
import { processAiConfigRequest, AI_CAPABILITIES } from './aiConfigAssistant.js';
import { deployCommands } from './deploy-commands.js';
import {
  loadDeskData,
  setDeskStatus,
  loadPanelsData,
  addPanelRecord,
  savePanelsData,
  getActiveTicket,
  saveActiveTicket,
  deleteActiveTicket,
  archiveTicket,
  loadTicketsData,
  updateArchivedReason,
  hasUserReadRules,
  markUserReadRules,
  isCategoryDisabled,
  closeCategory,
  openCategory,
  closeAllCategories,
  openAllCategories,
  isReportStaffDisabled,
  setReportStaffDisabled
} from './storage.js';
import {
  buildTicketPanel,
  buildRulesEmbed,
  buildTicketControl,
  buildCloseConfirmation,
  buildTranscriptLogEmbed,
  buildWelcomePayload,
  toSansSerif,
  buildCommandsDirectoryPayload,
  buildMediaShowcasePayload
} from './panelBuilder.js';
import {
  joinVoice,
  playMusic,
  setMusicVolume,
  pauseMusic,
  resumeMusic,
  replayMusic,
  toggleMusicLoop,
  leaveVoice,
  getMusicQueue,
  initMusicEngine
} from './musicManager.js';
import { generateTranscript } from './transcript.js';
import {
  fetchErlcServerData,
  fetchErlcServerDataForBot,
  buildSessionPanel,
  addSessionPanel,
  updateAllSessionPanels,
  loadSessionVotes,
  saveSessionVotes,
  getSessionVote,
  saveSessionVote,
  buildSessionVotePayload,
  buildSessionEndedPanel,
  loadSessionState,
  saveSessionState,
  ensureSessionOfflineState,
  shutdownSession,
  activateLiveSessionPanel,
  buildSessionInfoCard,
  buildHostVoteCompletedPayload
} from './sessionManager.js';
import {
  loadGiveaways,
  saveGiveaways,
  getGiveaway,
  saveGiveaway,
  parseDuration,
  buildGiveawayCard,
  endGiveaway,
  rerollGiveaway,
  checkActiveGiveaways,
  findActiveGiveaway,
  findConcludedGiveaway,
  recoverGiveawayFromMessage,
  GIVEAWAY_EMOJI
} from './giveawayManager.js';
import { randomUUID } from 'crypto';

/**
 * Refreshes all live session panels for a given bot instance.
 * Called automatically after config saves that affect session appearance.
 * @param {string} botId - The bot instance ID.
 * @param {import('discord.js').Client} discordClient - Discord client reference.
 */
async function refreshBotPanels(botId, discordClient) {
  try {
    const bot = getBotInstance(botId);
    if (!bot) return;
    const { loadSessionPanels, saveSessionPanels, fetchErlcServerData: _fetchData, buildSessionPanel: _build } = await import('./sessionManager.js');
    const sessionData = await fetchErlcServerDataForBot(bot);
    const sessionPayload = buildSessionPanel(sessionData, bot.customizations || {});
    const panelStore = loadSessionPanels();
    const validPanels = [];
    for (const panel of (panelStore.panels || [])) {
      try {
        const ch = await discordClient.channels.fetch(panel.channelId).catch(() => null);
        if (!ch) continue;
        const msg = await ch.messages.fetch(panel.messageId).catch(() => null);
        if (!msg) continue;
        await msg.edit(sessionPayload);
        validPanels.push(panel);
      } catch (err) {
        console.warn(`[refreshBotPanels] Could not update panel ${panel.messageId}:`, err.message);
      }
    }
    saveSessionPanels({ panels: validPanels });
    console.log(`[refreshBotPanels] Refreshed ${validPanels.length} panel(s) for bot ${botId}`);
  } catch (err) {
    console.warn(`[refreshBotPanels] Error:`, err.message);
  }
}
import {
  loadApplicationsData,
  saveApplicationsData,
  isPositionOpen,
  setPositionOpen,
  setAllPositionsOpen,
  getActiveSession,
  setActiveSession,
  removeActiveSession,
  saveSubmission,
  getSubmission,
  updateSubmission,
  setReviewChannel,
  setResultsChannel,
  getReviewChannelId,
  getResultsChannelId,
  getRoleDisplayName,
  buildApplicationPanel,
  buildApplicationHubMessage,
  buildModule1Modal,
  buildModule2Modal,
  buildModule3Modal,
  buildModule4Modal,
  buildStaffReviewCard,
  buildApplicationResultV2,
  buildApplicationResultFallback,
  buildApplicationStatusDmV2
} from './applicationManager.js';
import {
  postDepartmentPanel,
  buildDepartmentDmPayload,
  DEPARTMENTS,
  findDepartment
} from './departmentManager.js';
import {
  buildStaffDocsHubPayload,
  buildStaffDocSectionPayload
} from './staffDocsManager.js';
import {
  buildPromotionCard,
  buildInfractionCard
} from './staffActionManager.js';
import {
  loadLoaRecords,
  saveLoaRecords,
  parseLoaDuration,
  buildLoaSubmissionCard,
  buildLoaStatusDm,
  checkAndExpireLoas
} from './loaManager.js';

dotenv.config();

const client = new Client({
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

/**
 * Checks if a guild member has staff permissions or Administrator rights.
 */
function isStaff(member, interaction = null) {
  if (!member && !interaction) return false;

  // Server Owner always has staff access
  const guild = member?.guild || interaction?.guild;
  if (guild?.ownerId && (member?.id === guild.ownerId || interaction?.user?.id === guild.ownerId)) {
    return true;
  }

  // Check administrative / management permissions
  const memberPerms = interaction?.memberPermissions || member?.permissions;
  if (memberPerms) {
    if (memberPerms.has(PermissionFlagsBits.Administrator)) return true;
    if (memberPerms.has(PermissionFlagsBits.ManageGuild)) return true;
    if (memberPerms.has(PermissionFlagsBits.ManageChannels)) return true;
    if (memberPerms.has(PermissionFlagsBits.ManageMessages)) return true;
  }

  // Check custom bot configured roles (ticketPingRoleId, hostRoleId, category ping roles)
  if (interaction) {
    try {
      const botInst = getBotForInteraction(interaction);
      const cust = botInst?.customizations;
      if (cust) {
        if (cust.ticketPingRoleId && member?.roles?.cache?.has?.(cust.ticketPingRoleId)) return true;
        if (cust.hostRoleId && member?.roles?.cache?.has?.(cust.hostRoleId)) return true;
        if (cust.notificationRoleId && member?.roles?.cache?.has?.(cust.notificationRoleId)) return true;
        if (cust.promotionStaffRoleId && member?.roles?.cache?.has?.(cust.promotionStaffRoleId)) return true;
        if (cust.infractionStaffRoleId && member?.roles?.cache?.has?.(cust.infractionStaffRoleId)) return true;
        if (Array.isArray(cust.ticketCategories)) {
          for (const cat of cust.ticketCategories) {
            if (cat?.pingRoleId && member?.roles?.cache?.has?.(cat.pingRoleId)) return true;
          }
        }
      }
    } catch {}
  }

  // Check configured staff roles
  if (Array.isArray(CONFIG.STAFF_ROLE_IDS) && CONFIG.STAFF_ROLE_IDS.length > 0) {
    const hasConfiguredRole = CONFIG.STAFF_ROLE_IDS.some(roleId =>
      roleId && !roleId.includes('PASTE') && member?.roles?.cache?.has?.(roleId)
    );
    if (hasConfiguredRole) return true;
  } else {
    // If staff role list is intentionally left empty, allow members with Manage Messages
    if (memberPerms && memberPerms.has(PermissionFlagsBits.ManageMessages)) {
      return true;
    }
  }

  return false;
}

/**
 * Calculates readable duration between two timestamps.
 */
function formatDuration(startTimestamp, endTimestamp = Date.now()) {
  if (!startTimestamp) return 'N/A';
  const diffMs = Math.max(0, endTimestamp - startTimestamp);
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0 || (seconds > 0 && days === 0)) parts.push(`${seconds}s`);
  return parts.join(' ');
}

/**
 * Resolves a Discord role object and a clean human-readable rank name from user input.
 * Prevents raw ID numbers or <@&...> strings from appearing in UI labels.
 */
function resolveRoleAndRank(guild, roleOption = null, rankString = null) {
  let role = roleOption || null;
  let rankName = '';

  if (role) {
    rankName = role.name;
  } else if (rankString) {
    const trimmed = rankString.trim();
    // 1. Check for role mention <@&1234567890>
    const mentionMatch = trimmed.match(/<@&(\d+)>/);
    if (mentionMatch) {
      role = guild.roles.cache.get(mentionMatch[1]) || null;
      if (role) rankName = role.name;
    }
    // 2. Check for numeric role ID
    if (!role && /^\d{17,20}$/.test(trimmed)) {
      role = guild.roles.cache.get(trimmed) || null;
      if (role) rankName = role.name;
    }
    // 3. Check for exact or case-insensitive role name match in guild
    if (!role) {
      role = guild.roles.cache.find(r => r.name.toLowerCase() === trimmed.toLowerCase()) || null;
      if (role) {
        rankName = role.name;
      } else {
        // Strip any residual mention syntax
        rankName = trimmed.replace(/<@&?\d+>/g, '').trim() || trimmed;
      }
    }
  }

  if (!rankName) rankName = role ? role.name : 'Promoted Staff';
  return { role, rankName };
}

/**
 * Iterates through all posted ticket panels and updates them with the latest state.
 * Automatically prunes panels whose messages or channels were deleted.
 */
export async function updateAllLivePanels(discordClient) {
  const panelsData = loadPanelsData();
  const validPanels = [];

  for (const panel of panelsData.panels || []) {
    try {
      const channel = await discordClient.channels.fetch(panel.channelId).catch(() => null);
      if (!channel) continue;

      const message = await channel.messages.fetch(panel.messageId).catch(() => null);
      if (!message) continue;

      const botInst = getBotInstanceForGuild(panel.guildId || channel.guild?.id);
      const payload = buildTicketPanel(null, botInst?.customizations);
      await message.edit(payload);

      // Clean up any legacy bottom message if it existed
      if (panel.bottomMessageId) {
        const legacyBottom = await channel.messages.fetch(panel.bottomMessageId).catch(() => null);
        if (legacyBottom) await legacyBottom.delete().catch(() => null);
      }

      validPanels.push({ channelId: panel.channelId, messageId: panel.messageId });
    } catch (err) {
      console.warn(`Could not update panel message ${panel.messageId}:`, err.message);
    }
  }

  savePanelsData({ panels: validPanels });
}

/**
 * Refreshes control panels across all active management tickets
 * (e.g. when Report Staff is enabled or disabled).
 */
async function updateAllActiveTicketControls(clientInstance) {
  try {
    const allTickets = loadTicketsData();
    const activeTickets = Object.values(allTickets.active || {});
    for (const ticket of activeTickets) {
      if (ticket.category === 'management' && ticket.controlMessageId) {
        try {
          const ch = await clientInstance.channels.fetch(ticket.channelId).catch(() => null);
          if (ch) {
            const ctrlMsg = await ch.messages.fetch(ticket.controlMessageId).catch(() => null);
            if (ctrlMsg) {
              const updatedControl = buildTicketControl(ticket);
              await ctrlMsg.edit(updatedControl).catch(() => null);
            }
          }
        } catch (e) {
          // ignore single channel/message error
        }
      }
    }
  } catch (err) {
    console.error('Error updating active ticket controls:', err);
  }
}

/**
 * Close ticket workflow: countdown -> transcript -> log -> DM author -> delete channel.
 */
async function closeTicketWorkflow(channel, closedByUser, reasonOverride = null) {
  const ticketData = getActiveTicket(channel.id) || {
    channelId: channel.id,
    channelName: channel.name,
    authorId: null,
    authorTag: 'Unknown User',
    category: 'unknown',
    categoryLabel: 'Support Ticket',
    reason: 'Not recorded',
    claimedBy: null,
    createdAt: Date.now()
  };

  const closeReason = reasonOverride || ticketData.closeReason || 'No reason provided.';
  ticketData.closeReason = closeReason;

  // 1. Send 5-second countdown notice without emojis
  await channel.send({
    content: `**Archiving transcript and closing ticket in 5 seconds...**`
  }).catch(() => null);

  await new Promise(resolve => setTimeout(resolve, 5000));

  // 2. Generate Transcript
  let transcriptAttachment = null;
  try {
    transcriptAttachment = await generateTranscript(channel, ticketData, closedByUser, closeReason);
  } catch (err) {
    console.error(`Failed to generate transcript for #${channel.name}:`, err);
  }

  const durationStr = formatDuration(ticketData.createdAt, Date.now());

  // 3. Post to Transcripts Channel
  let logMessageId = null;
  if (CONFIG.TRANSCRIPTS_CHANNEL_ID && !CONFIG.TRANSCRIPTS_CHANNEL_ID.includes('PASTE')) {
    try {
      const logChannel = await client.channels.fetch(CONFIG.TRANSCRIPTS_CHANNEL_ID).catch(() => null);
      if (logChannel) {
        // Bottom banner image: use local asset if present, or fallback to config URL
        const bannerFile = fs.existsSync('./assets/bottom-banner.png')
          ? new AttachmentBuilder('./assets/bottom-banner.png', { name: 'bottom-banner.png' })
          : null;
        const bannerImgRef = bannerFile ? 'attachment://bottom-banner.png' : CONFIG.BOTTOM_BANNER_URL;

        const logPayload = buildTranscriptLogEmbed({
          channelName: channel.name,
          channelId: channel.id,
          authorId: ticketData.authorId,
          authorTag: ticketData.authorTag,
          closedById: closedByUser.id,
          claimedById: ticketData.claimedBy,
          openDuration: durationStr,
          closeReason: closeReason,
          transcriptUrl: null,
          bannerImage: bannerImgRef
        });

        if (bannerFile) {
          logPayload.files = [bannerFile];
        }

        // Send clean log embed (NO html file attached to this message, keeping top clean!)
        const logMsg = await logChannel.send(logPayload);
        logMessageId = logMsg.id;

        // Archive the HTML transcript inside a thread so it never clutters the top of the log message
        let transcriptUrl = null;
        if (transcriptAttachment) {
          try {
            const thread = await logMsg.startThread({
              name: `transcript-${channel.name}`,
              autoArchiveDuration: 60
            });
            const threadMsg = await thread.send({
              content: `> Archived transcript document for **#${channel.name}**`,
              files: [transcriptAttachment]
            });
            transcriptUrl = threadMsg.attachments.first()?.url || null;
            await thread.setArchived(true).catch(() => null);
          } catch (threadErr) {
            console.warn('Could not archive transcript in thread, fallback upload:', threadErr.message);
            const fallbackMsg = await logChannel.send({
              content: `> Archived transcript document for **#${channel.name}**`,
              files: [transcriptAttachment]
            }).catch(() => null);
            transcriptUrl = fallbackMsg?.attachments.first()?.url || null;
          }
        }

        // Add Open Transcript button pointing directly to the archived HTML transcript
        if (transcriptUrl) {
          const updatedPayload = buildTranscriptLogEmbed({
            channelName: channel.name,
            channelId: channel.id,
            authorId: ticketData.authorId,
            authorTag: ticketData.authorTag,
            closedById: closedByUser.id,
            claimedById: ticketData.claimedBy,
            openDuration: durationStr,
            closeReason: closeReason,
            transcriptUrl: transcriptUrl,
            bannerImage: bannerImgRef
          });
          await logMsg.edit({ components: updatedPayload.components }).catch(() => null);
        }
      }
    } catch (logErr) {
      console.error(`Failed to send log embed to transcripts channel:`, logErr);
    }
  }

  // 4. Archive to JSON
  archiveTicket({
    channelId: channel.id,
    channelName: channel.name,
    authorId: ticketData.authorId,
    authorTag: ticketData.authorTag,
    category: ticketData.category,
    categoryLabel: ticketData.categoryLabel,
    reason: ticketData.reason,
    claimedBy: ticketData.claimedBy,
    claimedTag: ticketData.claimedTag,
    closedById: closedByUser.id,
    closedByTag: closedByUser.tag,
    closeReason: closeReason,
    createdAt: ticketData.createdAt,
    closedAt: Date.now(),
    duration: durationStr,
    logMessageId: logMessageId
  });

  // 6. Delete the channel
  try {
    await channel.delete(`Ticket closed by ${closedByUser.tag}: ${closeReason}`);
  } catch (delErr) {
    console.error(`Failed to delete ticket channel ${channel.id}:`, delErr);
  }
}

/* ========================================================================== */
/*                                BOT EVENTS                                  */
/* ========================================================================== */

client.once(Events.ClientReady, async () => {
  console.log(`=============================================`);
  console.log(` ERLCX Bot logged in as ${client.user.tag}`);
  console.log(` Loaded ${CONFIG.CATEGORIES.length} Support Categories`);
  console.log(`=============================================`);

  // Refresh live panels on bot boot
  await updateAllLivePanels(client);
  await updateAllSessionPanels(client);
  await ensureSessionOfflineState(client);
  await checkAndExpireLoas(client);
  initMusicEngine();
  try {
    // 1. Deploy Global Slash Commands for Master Bot (visible across all servers)
    await deployCommands(null, null, null, false, true);
    console.log('[MASTER BOT] Master global slash commands deployed successfully.');

    // 2. Also register directly to every server the bot is currently in for instant availability
    for (const guild of client.guilds.cache.values()) {
      try {
        await deployCommands(process.env.DISCORD_TOKEN, client.user.id, guild.id, false, true);
        console.log(`[MASTER BOT] Commands deployed directly to guild: ${guild.name} (${guild.id})`);
      } catch (gErr) {
        console.warn(`[MASTER BOT] Could not deploy to ${guild.name}:`, gErr.message);
      }
    }
  } catch (err) {
    console.warn('[MASTER BOT] Deploy commands error:', err.message);
  }
  await startAllConfiguredBots();

  // Auto-refresh live session panels every 60 seconds
  setInterval(async () => {
    try {
      await updateAllSessionPanels(client);
    } catch (e) {
      console.warn('Session auto-update error:', e.message);
    }
  }, 60 * 1000);

  // Check and expire active LOAs every 5 minutes
  setInterval(async () => {
    try {
      await checkAndExpireLoas(client);
    } catch (e) {
      console.warn('LOA expiration check error:', e.message);
    }
  }, 5 * 60 * 1000);

  // Expire session votes older than 24 hours
  setInterval(async () => {
    try {
      const votesStore = loadSessionVotes();
      const now = Date.now();
      let changed = false;
      for (const vote of Object.values(votesStore.votes || {})) {
        if (vote.status === 'active' && now >= vote.expiresAt) {
          vote.status = 'expired';
          changed = true;
          try {
            const ch = await client.channels.fetch(vote.channelId).catch(() => null);
            if (ch && vote.messageId) {
              const msg = await ch.messages.fetch(vote.messageId).catch(() => null);
              if (msg) await msg.edit(buildSessionVotePayload(vote));
            }
          } catch {}
        }
      }
      if (changed) saveSessionVotes(votesStore);
    } catch (e) {
      console.warn('Error checking expired votes:', e.message);
    }
  }, 5 * 60 * 1000);

  // Check active giveaways every 15 seconds
  setInterval(async () => {
    try {
      await checkActiveGiveaways(client);
    } catch (e) {
      console.warn('Error checking active giveaways:', e.message);
    }
  }, 15 * 1000);

  // Cache application commands for clickable blue mentions
  try {
    await client.application?.commands.fetch().catch(() => null);
    for (const g of client.guilds.cache.values()) {
      await g.commands.fetch().catch(() => null);
    }
  } catch {}
});

// Automatically deploy slash commands when invited to a new guild
client.on(Events.GuildCreate, async guild => {
  console.log(`[MASTER BOT] Joined new guild: ${guild.name} (${guild.id})`);
  try {
    await deployCommands(process.env.DISCORD_TOKEN, client.user.id, guild.id, false, true);
    console.log(`[MASTER BOT] Slash commands successfully deployed to guild ${guild.name} (${guild.id})`);
  } catch (err) {
    console.warn(`Failed to deploy commands on guild join:`, err.message);
  }
});

// Auto-clean active tickets if a channel is deleted manually in Discord
client.on(Events.ChannelDelete, async channel => {
  try {
    const activeTicket = getActiveTicket(channel.id);
    if (activeTicket) {
      deleteActiveTicket(channel.id);
      console.log(`Auto-cleaned manually deleted ticket #${channel.name || channel.id}`);
    }
  } catch (err) {
    console.error('Error in channelDelete listener:', err);
  }
});

// Send Welcome Message when a new member joins
client.on(Events.GuildMemberAdd, async member => {
  try {
    if (CONFIG.WELCOME?.ENABLED === false) {
      console.log(`[GuildMemberAdd] User ${member.user.tag} (${member.id}) joined, but welcome system is disabled.`);
      return;
    }
    const guild = member.guild;
    console.log(`[GuildMemberAdd] User ${member.user.tag} (${member.id}) joined ${guild.name} (${guild.id})`);

    let channel = null;
    const GUILD_WELCOME_MAP = {
      '1541210827967823955': CONFIG.WELCOME.CHANNEL_ID || '1548147497854181397', // ERLCX #𝖬𝖺𝗂𝗇
      '1530147023754367006': '1549635572698447932' // Discord bot V.2 #welcome
    };

    const preferredId = GUILD_WELCOME_MAP[guild.id] || CONFIG.WELCOME.CHANNEL_ID;
    if (preferredId) {
      channel = guild.channels.cache.get(preferredId) ||
        await guild.channels.fetch(preferredId).catch(() => null);
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

    if (!channel) {
      console.warn(`[GuildMemberAdd] Welcome channel not found in guild ${guild.name} (${guild.id})`);
      return;
    }

    try {
      const payload = buildWelcomePayload(member);
      await channel.send(payload);
      console.log(`[GuildMemberAdd] Sent welcome card to #${channel.name} in ${guild.name}`);
    } catch (sendErr) {
      console.warn(`[GuildMemberAdd] Primary welcome card failed (${sendErr.message}), sending resilient fallback...`);
      const fallbackBtn = new ButtonBuilder()
        .setCustomId('welcome_member_count')
        .setStyle(ButtonStyle.Secondary)
        .setLabel(`${(guild.memberCount || 1).toLocaleString()} Members`)
        .setEmoji('👥')
        .setDisabled(true);
      const fallbackRow = new ActionRowBuilder().addComponents(fallbackBtn);
      const navCh = CONFIG.WELCOME.NAVIGATE_CHANNEL_ID;
      const navText = navCh && guild.channels.cache.has(navCh) ? ` Navigate the server through <#${navCh}>` : '';
      await channel.send({
        content: `👋 Welcome to ${guild.name || CONFIG.WELCOME.SERVER_NAME || 'ERLCX'}, <@${member.id}>.${navText}`,
        components: [fallbackRow]
      });
      console.log(`[GuildMemberAdd] Resilient fallback welcome card sent to #${channel.name}`);
    }
  } catch (err) {
    console.error('Error sending welcome message on guildMemberAdd:', err);
  }
});

/* ========================================================================== */
/*                             PREFIX COMMANDS                                */
/* ========================================================================== */

client.on(Events.MessageCreate, async message => {
  try {
    if (message.author.bot) return;

    // Handle Direct Messages for active staff applications
    if (!message.guild) {
      const session = getActiveSession(message.author.id);
      if (session) {
        await message.reply({
          content: 'Please click on the module buttons on your staff application message above to open each form and enter your responses.'
        }).catch(() => null);
      }
      return;
    }

    // Check if the bot is mentioned for AI bot configuration
    if (message.mentions.has(client.user?.id) && !message.mentions.everyone) {
      const prompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
      if (prompt.length > 0) {
        const botInst = getBotInstanceForGuild(message.guild?.id, message.author.id);
        if (!botInst) {
          return message.reply({ content: '⚠️ Bot instance not initialized. Run `/config` first.' }).catch(() => null);
        }
        if (botInst.banned) {
          return message.reply({ content: `⛔ Bot instance \`${botInst.botId}\` is banned: ${botInst.bannedReason || 'Suspended'}` }).catch(() => null);
        }
        
        await message.channel.sendTyping().catch(() => null);
        const result = await processAiConfigRequest({
          botId: botInst.botId,
          prompt,
          userId: message.author.id
        });

        if (result.success) {
          let replyContent = `🤖 **AI Assistant:**\n${result.reply}`;
          if (result.changes && result.changes.length > 0) {
            replyContent += `\n\n**Applied Changes:**\n` + result.changes.map(c => `• \`${c.field}\`: \`${c.value}\``).join('\n');
          }
          await message.reply({ content: replyContent }).catch(() => null);
        } else {
          await message.reply({ content: `⚠️ ${result.message}` }).catch(() => null);
        }
        return;
      }
    }

    const content = message.content.trim();
    if (!content.startsWith(CONFIG.PREFIX)) return;

    const args = content.slice(CONFIG.PREFIX.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();

    // Helper to send temporary feedback and remove caller message to prevent duplicates
    const sendCleanFeedback = async (text) => {
      const replyMsg = await message.channel.send({ content: text }).catch(() => null);
      setTimeout(async () => {
        if (replyMsg) await replyMsg.delete().catch(() => null);
        await message.delete().catch(() => null);
      }, 3500);
    };

    // -add @user / -add <userId>
    if (command === 'add') {
      const activeTicket = getActiveTicket(message.channel.id);
      if (!activeTicket) {
        return sendCleanFeedback('This command can only be used inside an active ticket channel.');
      }

      if (!isStaff(message.member) && activeTicket.authorId !== message.author.id) {
        return sendCleanFeedback('Only staff or the ticket creator can add users to this ticket.');
      }

      const rawTarget = args[0];
      const targetUser = message.mentions.users.first() || 
        (rawTarget ? await client.users.fetch(rawTarget.replace(/[^0-9]/g, '')).catch(() => null) : null);

      if (!targetUser) {
        return sendCleanFeedback('Please mention a user or provide an ID: `-add @user`');
      }

      await message.channel.permissionOverwrites.edit(targetUser.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true
      });

      const addEmbed = new EmbedBuilder()
        .setDescription(`> <@${targetUser.id}> has been added to this ticket by <@${message.author.id}>.`);

      await message.delete().catch(() => null);
      await message.channel.send({ embeds: [addEmbed] });
      return;
    }

    // -remove @user / -remove <userId>
    if (command === 'remove') {
      const activeTicket = getActiveTicket(message.channel.id);
      if (!activeTicket) {
        return sendCleanFeedback('This command can only be used inside an active ticket channel.');
      }

      if (!isStaff(message.member) && activeTicket.authorId !== message.author.id) {
        return sendCleanFeedback('Only staff or the ticket creator can remove users from this ticket.');
      }

      const rawTarget = args[0];
      const targetUser = message.mentions.users.first() || 
        (rawTarget ? await client.users.fetch(rawTarget.replace(/[^0-9]/g, '')).catch(() => null) : null);

      if (!targetUser) {
        return sendCleanFeedback('Please mention a user or provide an ID: `-remove @user`');
      }

      if (targetUser.id === activeTicket.authorId) {
        return sendCleanFeedback('You cannot remove the ticket creator from their own ticket.');
      }

      await message.channel.permissionOverwrites.delete(targetUser.id).catch(() => null);

      const removeEmbed = new EmbedBuilder()
        .setDescription(`> <@${targetUser.id}> has been removed from this ticket by <@${message.author.id}>.`);

      await message.delete().catch(() => null);
      await message.channel.send({ embeds: [removeEmbed] });
      return;
    }

    // Check staff permissions for management prefix commands
    if (!isStaff(message.member)) return;

    // -close [general|management|all|report staff|reason]
    if (command === 'close') {
      const target = args[0]?.toLowerCase();
      const fullArg = args.join(' ').toLowerCase();

      // -close report staff
      if (fullArg === 'report staff' || fullArg === 'reportstaff' || fullArg === 'report' || (target === 'report' && args[1]?.toLowerCase() === 'staff')) {
        setReportStaffDisabled(true);
        await updateAllActiveTicketControls(client);
        return sendCleanFeedback('Closed **Report Staff**. Hidden from all management tickets.');
      }

      // -close ingame application / -close discord application / -close application
      if (fullArg.includes('ingame app') || fullArg.includes('ingame application')) {
        setPositionOpen('ingame_mod', false);
        return sendCleanFeedback('Closed **In-Game Moderator** applications.');
      }
      if (fullArg.includes('discord app') || fullArg.includes('discord application')) {
        setPositionOpen('discord_mod', false);
        return sendCleanFeedback('Closed **Discord Moderator** applications.');
      }
      if (fullArg === 'application' || fullArg === 'all application' || fullArg === 'applications' || fullArg === 'app' || fullArg === 'apps') {
        setAllPositionsOpen(false);
        return sendCleanFeedback('Closed **all staff applications**.');
      }

      // If used inside an active ticket channel without a category target
      const activeTicket = getActiveTicket(message.channel.id);
      if (activeTicket && (!target || !['general', 'management', 'mangment', 'manage', 'all', 'report'].includes(target))) {
        const reason = args.join(' ') || 'Closed via staff command';
        await message.delete().catch(() => null);
        await closeTicketWorkflow(message.channel, message.author, reason);
        return;
      }

      if (target === 'general') {
        closeCategory('general');
        await updateAllLivePanels(client);
        return sendCleanFeedback('Closed **General Support**. Live panel updated.');
      }

      if (target === 'management' || target === 'mangment' || target === 'manage') {
        closeCategory('management');
        await updateAllLivePanels(client);
        return sendCleanFeedback('Closed **Management Support**. Live panel updated.');
      }

      if (target === 'all') {
        closeAllCategories();
        await updateAllLivePanels(client);
        return sendCleanFeedback('Closed **all support categories**. Live panel updated.');
      }

      return sendCleanFeedback('Usage: `-close general`, `-close management`, `-close report staff`, `-close all`, or `-close [reason]` inside a ticket.');
    }

    // -open [general|management|all|report staff]
    if (command === 'open') {
      const target = args[0]?.toLowerCase();
      const fullArg = args.join(' ').toLowerCase();

      // -open report staff
      if (fullArg === 'report staff' || fullArg === 'reportstaff' || fullArg === 'report' || (target === 'report' && args[1]?.toLowerCase() === 'staff')) {
        setReportStaffDisabled(false);
        await updateAllActiveTicketControls(client);
        return sendCleanFeedback('Opened **Report Staff**. Restored to all management tickets.');
      }

      // -open ingame application / -open discord application / -open application
      if (fullArg.includes('ingame app') || fullArg.includes('ingame application')) {
        setPositionOpen('ingame_mod', true);
        return sendCleanFeedback('Opened **In-Game Moderator** applications.');
      }
      if (fullArg.includes('discord app') || fullArg.includes('discord application')) {
        setPositionOpen('discord_mod', true);
        return sendCleanFeedback('Opened **Discord Moderator** applications.');
      }
      if (fullArg === 'application' || fullArg === 'all application' || fullArg === 'applications' || fullArg === 'app' || fullArg === 'apps') {
        setAllPositionsOpen(true);
        return sendCleanFeedback('Opened **all staff applications**.');
      }

      if (target === 'general') {
        openCategory('general');
        await updateAllLivePanels(client);
        return sendCleanFeedback('Opened **General Support**. Live panel updated.');
      }

      if (target === 'management' || target === 'mangment' || target === 'manage') {
        openCategory('management');
        await updateAllLivePanels(client);
        return sendCleanFeedback('Opened **Management Support**. Live panel updated.');
      }

      if (target === 'all') {
        openAllCategories();
        await updateAllLivePanels(client);
        return sendCleanFeedback('Opened **all support categories**. Live panel updated.');
      }

      return sendCleanFeedback('Usage: `-open general`, `-open management`, `-open report staff`, or `-open all`.');
    }

    // -shutdown or -session shutdown
    if (command === 'shutdown' || (command === 'session' && args[0]?.toLowerCase() === 'shutdown')) {
      if (!isStaff(message.member)) return;

      const targetChannel = message.mentions.channels.first()
        || (CONFIG.SESSION.CHANNEL_ID ? await client.channels.fetch(CONFIG.SESSION.CHANNEL_ID).catch(() => null) : null)
        || message.channel;

      try {
        await shutdownSession(client, targetChannel.id);
        await message.delete().catch(() => null);
        return sendCleanFeedback(`Session officially shut down. Session Ended panel posted in <#${targetChannel.id}>.`);
      } catch (err) {
        console.error('Prefix shutdown error:', err);
        return sendCleanFeedback(`Failed to shut down session: ${err.message}`);
      }
    }

    // -session info or -sessioninfo
    if ((command === 'session' && args[0]?.toLowerCase() === 'info') || command === 'sessioninfo') {
      if (!isStaff(message.member)) return;

      const targetChannel = message.mentions.channels.first()
        || (CONFIG.SESSION.CHANNEL_ID ? await client.channels.fetch(CONFIG.SESSION.CHANNEL_ID).catch(() => null) : null)
        || message.channel;

      try {
        const infoPayload = buildSessionInfoCard();
        await targetChannel.send(infoPayload);
        await message.delete().catch(() => null);
        return sendCleanFeedback(`Session info announcement posted in <#${targetChannel.id}>.`);
      } catch (err) {
        console.error('Prefix session info error:', err);
        return sendCleanFeedback(`Failed to send session info: ${err.message}`);
      }
    }

    // -session [panel] [#channel]
    if (command === 'session') {
      const targetChannel = message.mentions.channels.first()
        || (CONFIG.SESSION.CHANNEL_ID ? await client.channels.fetch(CONFIG.SESSION.CHANNEL_ID).catch(() => null) : null)
        || message.channel;

      try {
        await activateLiveSessionPanel(client, targetChannel.id);
        await message.delete().catch(() => null);
        return sendCleanFeedback(`Session Information panel successfully posted to <#${targetChannel.id}>.`);
      } catch (err) {
        console.error('Failed to post session panel via prefix:', err);
        return sendCleanFeedback(`Failed to send session panel: ${err.message}`);
      }
    }

    // -purge [amount]
    if (command === 'purge') {
      if (!isStaff(message.member)) return;

      const rawAmount = parseInt(args[0], 10);
      if (isNaN(rawAmount) || rawAmount < 1 || rawAmount > 100) {
        return sendCleanFeedback('Usage: `-purge [1-100]`');
      }

      try {
        await message.delete().catch(() => null);
        const deleted = await message.channel.bulkDelete(rawAmount, true);
        const confirmMsg = await message.channel.send({
          content: `Deleted **${deleted.size}** message(s).`
        }).catch(() => null);

        setTimeout(async () => {
          if (confirmMsg) await confirmMsg.delete().catch(() => null);
        }, 3000);
      } catch (err) {
        console.error('Prefix purge error:', err);
        return sendCleanFeedback(`Could not purge messages: ${err.message}`);
      }
      return;
    }

    // -testwelcome / -welcome [on/off]
    if (command === 'testwelcome' || command === 'welcome') {
      if (!isStaff(message.member)) return;

      const subArg = args[0]?.toLowerCase();
      if (subArg === 'off' || subArg === 'disable') {
        CONFIG.WELCOME.ENABLED = false;
        return sendCleanFeedback('🔇 Welcome system has been **disabled**.');
      } else if (subArg === 'on' || subArg === 'enable') {
        CONFIG.WELCOME.ENABLED = true;
        return sendCleanFeedback('🔊 Welcome system has been **enabled**.');
      }

      const GUILD_WELCOME_MAP = {
        '1541210827967823955': CONFIG.WELCOME.CHANNEL_ID || '1548147497854181397',
        '1530147023754367006': '1549635572698447932'
      };
      const preferredId = GUILD_WELCOME_MAP[message.guild.id] || CONFIG.WELCOME.CHANNEL_ID;
      const targetChannel = (preferredId ? message.guild.channels.cache.get(preferredId) : null) ||
        message.guild.channels.cache.find(c => c.isTextBased() && (c.name.includes('welcome') || c.name === '𝖬𝖺𝗂𝗇' || c.name === 'main')) ||
        message.channel;

      const payload = buildWelcomePayload(message.member);
      await targetChannel.send(payload);
      const statusNote = CONFIG.WELCOME?.ENABLED === false ? ' *(Note: System is currently turned off for new joins)*' : '';
      return sendCleanFeedback(`Sent test welcome message to <#${targetChannel.id}>!${statusNote}`);
    }

    // -department [panel] [channel] / -departments
    if (command === 'department' || command === 'departments') {
      if (!isStaff(message.member)) return;
      const targetChannel = message.mentions.channels.first() || message.channel;
      try {
        await postDepartmentPanel(targetChannel);
        return sendCleanFeedback(`Successfully dispatched Department Panel to <#${targetChannel.id}>!`);
      } catch (err) {
        return sendCleanFeedback(`Failed to dispatch department panel: ${err.message}`);
      }
    }

    // -say <message>
    if (command === 'say') {
      if (!isStaff(message.member)) return;
      const textToSay = args.join(' ').trim();
      if (!textToSay) {
        return sendCleanFeedback('Usage: `-say <message>`');
      }

      await message.delete().catch(() => null);
      await message.channel.send({ content: textToSay });
      return;
    }

    // -gstart <duration> <winners> [@role] <prize>
    if (command === 'gstart') {
      if (!isStaff(message.member)) return;

      const durationStr = args[0];
      const winnersCount = parseInt(args[1], 10);
      const pingRole = message.mentions.roles.first();

      // Filter out role mention from the prize args
      const remainingArgs = args.slice(2).filter(a => !a.startsWith('<@&') && !a.endsWith('>'));
      const prize = remainingArgs.join(' ');

      if (!durationStr || isNaN(winnersCount) || !prize) {
        return sendCleanFeedback('Usage: `-gstart <duration> <winners> [@role] <prize>` (e.g. `-gstart 10m 1 @GiveawayPing Nitro Classic`)');
      }

      const durationMs = parseDuration(durationStr);
      if (!durationMs || durationMs < 5000) {
        return sendCleanFeedback('Invalid duration. Use formats like `30s`, `10m`, `1h`, `1d`.');
      }

      const giveaway = {
        id: null,
        channelId: message.channel.id,
        guildId: message.guild.id,
        prize: prize,
        hostId: message.author.id,
        winnerCount: Math.max(1, winnersCount),
        entries: [],
        startedAt: Date.now(),
        endsAt: Date.now() + durationMs,
        ended: false,
        winners: []
      };

      try {
        if (pingRole) {
          await message.channel.send({ content: `<@&${pingRole.id}>` });
        }

        const cardPayload = buildGiveawayCard(giveaway);
        const sentMsg = await message.channel.send(cardPayload);
        giveaway.id = sentMsg.id;
        saveGiveaway(giveaway);
        await sentMsg.edit(buildGiveawayCard(giveaway, false)).catch(() => null);
        await message.delete().catch(() => null);
      } catch (err) {
        console.error('Prefix giveaway start error:', err);
        return sendCleanFeedback(`Could not start giveaway: ${err.message}`);
      }
      return;
    }

    // -gend [message_id or prize]
    if (command === 'gend') {
      if (!isStaff(message.member)) return;
      const query = args.join(' ').trim() || null;
      const giveaway = findActiveGiveaway(query, message.channel.id);

      if (!giveaway) {
        return sendCleanFeedback('Could not find an active giveaway in this channel.');
      }

      try {
        await endGiveaway(client, giveaway.id);
        await message.delete().catch(() => null);
      } catch (err) {
        return sendCleanFeedback(`Failed to end giveaway: ${err.message}`);
      }
      return;
    }

    // -greroll [message_id or prize]
    if (command === 'greroll') {
      if (!isStaff(message.member)) return;
      const query = args.join(' ').trim() || null;
      const giveaway = findConcludedGiveaway(query, message.channel.id);

      if (!giveaway) {
        return sendCleanFeedback('Could not find a concluded giveaway in this channel.');
      }

      try {
        await rerollGiveaway(client, giveaway.id, giveaway.winnerCount || 1);
        await message.delete().catch(() => null);
      } catch (err) {
        return sendCleanFeedback(`Failed to reroll giveaway: ${err.message}`);
      }
      return;
    }

    // -app panel [channel] | -app setreview <channel>
    if (command === 'app' || command === 'application') {
      if (!isStaff(message.member)) return;
      const sub = args[0]?.toLowerCase();

      if (sub === 'panel') {
        const channelMention = message.mentions.channels.first();
        const targetChannel = channelMention || message.channel;
        const panelPayload = buildApplicationPanel();

        try {
          await targetChannel.send(panelPayload);
          await message.delete().catch(() => null);
        } catch (err) {
          return sendCleanFeedback(`Failed to send application panel: ${err.message}`);
        }
        return;
      }

      if (sub === 'setreview') {
        const channelMention = message.mentions.channels.first();
        if (!channelMention) {
          return sendCleanFeedback('Please mention a channel: `-app setreview #channel`');
        }
        setReviewChannel(channelMention.id);
        return sendCleanFeedback(`Staff application review channel set to <#${channelMention.id}>.`);
      }

      if (sub === 'setresults' || sub === 'setresult' || sub === 'results') {
        const channelMention = message.mentions.channels.first();
        if (!channelMention) {
          return sendCleanFeedback('Please mention a channel: `-app setresults #channel`');
        }
        setResultsChannel(channelMention.id);
        return sendCleanFeedback(`Staff application results channel set to <#${channelMention.id}>.`);
      }
    }

    // -setresults #channel / -results #channel
    if (command === 'setresults' || command === 'results') {
      if (!isStaff(message.member)) return;
      const channelMention = message.mentions.channels.first();
      if (!channelMention) {
        return sendCleanFeedback('Please mention a channel: `-setresults #channel`');
      }
      setResultsChannel(channelMention.id);
      return sendCleanFeedback(`Staff application results channel set to <#${channelMention.id}>.`);
    }

    // -refont <text> (Convert to Mathematical Sans-Serif: 𝖳𝗁𝗂𝗌 𝖥𝗈𝗇𝗍)
    if (command === 'refont') {
      const text = args.join(' ').trim();
      if (!text) {
        return sendCleanFeedback('Usage: `-refont <text to convert>`');
      }
      const styled = toSansSerif(text);
      await message.delete().catch(() => null);
      return message.channel.send({ content: styled });
    }

    // -commands or -help
    if (command === 'commands' || command === 'command' || command === 'help') {
      await message.delete().catch(() => null);
      const payload = buildCommandsDirectoryPayload(client, 0, message.guild?.id);
      const sentMsg = await message.channel.send(payload);
      setTimeout(() => {
        sentMsg.delete().catch(() => null);
      }, 60000);
      return sentMsg;
    }

    // -media [caption] (with image attachment)
    if (command === 'media') {
      const attachment = message.attachments.first();
      if (!attachment) {
        return sendCleanFeedback('⚠️ Please attach an image or screenshot to use `-media [caption]`.');
      }
      const caption = args.join(' ').trim() || null;
      const { v2Payload, fallbackPayload } = buildMediaShowcasePayload({
        attachment,
        caption,
        creditUser: message.author,
        pingRole: null
      });

      await message.delete().catch(() => null);
      try {
        await message.channel.send(v2Payload);
      } catch (v2Err) {
        await message.channel.send(fallbackPayload);
      }
      return;
    }

    // -join
    if (command === 'join') {
      const voiceChannel = message.member?.voice?.channel;
      if (!voiceChannel) {
        return sendCleanFeedback('⚠️ You must be connected to a voice channel to use `-join`.');
      }
      try {
        await joinVoice(voiceChannel, message.channel);
        return sendCleanFeedback(`🔊 Successfully connected to **${voiceChannel.name}**!`);
      } catch (err) {
        return sendCleanFeedback(`Failed to join voice channel: ${err.message}`);
      }
    }

    // -play <song name or url>
    if (command === 'play' || command === 'p') {
      const voiceChannel = message.member?.voice?.channel;
      if (!voiceChannel) {
        return sendCleanFeedback('⚠️ You must be connected to a voice channel to play music.');
      }
      const query = args.join(' ').trim();
      if (!query) {
        return sendCleanFeedback('Usage: `-play <song name or YouTube link>`');
      }
      try {
        const res = await playMusic(voiceChannel, message.channel, query, message.author);
        if (res.status === 'playing') {
          return sendCleanFeedback(`▶️ **Now Playing:** **${res.track.title}** (${res.track.duration})`);
        } else {
          return sendCleanFeedback(`📝 **Queued (Position #${res.position}):** **${res.track.title}** (${res.track.duration})`);
        }
      } catch (err) {
        return sendCleanFeedback(`Playback error: ${err.message}`);
      }
    }

    // -volume <1-100>
    if (command === 'volume' || command === 'vol') {
      const level = parseInt(args[0], 10);
      if (isNaN(level) || level < 1 || level > 100) {
        return sendCleanFeedback('Usage: `-volume <1 - 100>`');
      }
      try {
        const newVol = setMusicVolume(message.guild.id, level);
        return sendCleanFeedback(`🔊 Playback volume set to **${newVol}%**.`);
      } catch (err) {
        return sendCleanFeedback(err.message);
      }
    }

    // -pause
    if (command === 'pause') {
      try {
        const ok = pauseMusic(message.guild.id);
        if (ok) {
          return sendCleanFeedback('⏸️ Music playback paused. Use `-resume` to continue.');
        } else {
          return sendCleanFeedback('Playback is not currently playing.');
        }
      } catch (err) {
        return sendCleanFeedback(err.message);
      }
    }

    // -resume / -unpause
    if (command === 'resume' || command === 'unpause') {
      try {
        const ok = resumeMusic(message.guild.id);
        if (ok) {
          return sendCleanFeedback('▶️ Resumed music playback.');
        } else {
          return sendCleanFeedback('Playback is not currently paused.');
        }
      } catch (err) {
        return sendCleanFeedback(err.message);
      }
    }

    // -replay
    if (command === 'replay') {
      try {
        await replayMusic(message.guild.id);
        return sendCleanFeedback('🔄 Replaying current track from the beginning.');
      } catch (err) {
        return sendCleanFeedback(err.message);
      }
    }

    // -loop
    if (command === 'loop') {
      try {
        const isLooping = toggleMusicLoop(message.guild.id);
        return sendCleanFeedback(`🔂 Track loop is now **${isLooping ? 'ENABLED' : 'DISABLED'}**.`);
      } catch (err) {
        return sendCleanFeedback(err.message);
      }
    }

    // -leave / -stop / -dc
    if (command === 'leave' || command === 'stop' || command === 'dc') {
      const ok = leaveVoice(message.guild.id);
      if (ok) {
        return sendCleanFeedback('⏹️ Music stopped and disconnected from voice channel.');
      } else {
        return sendCleanFeedback('The bot is not currently in a voice channel.');
      }
    }

    // -loa [duration/end date] | [reason]
    if (command === 'loa') {
      const fullArgs = args.join(' ').trim();
      if (!fullArgs || fullArgs.toLowerCase() === 'help') {
        const helpEmbed = new EmbedBuilder()
          .setTitle('ERLCX | Leave of Absence (LOA) Format')
          .setDescription(
            `> To submit an official Leave of Absence, please use the standard format:\n\n` +
            `\`-loa <Duration or End Date> | <Reason>\`\n\n` +
            `**Examples:**\n` +
            `> • \`-loa 7 days | High school midterms and family trip\`\n` +
            `> • \`-loa 1 week | Out of town for sports tournament\`\n` +
            `> • \`-loa 2026-09-30 | Medical recovery and rest\`\n\n` +
            `*Once submitted, your request will be dispatched to Staff Management in <#1548336007311527996> for review.*`
          )
          .setColor(0x0284c7)
          .setFooter({ text: 'ERLCX Staff Administration • Leave System' });

        return message.channel.send({ embeds: [helpEmbed] });
      }

      const parts = fullArgs.split('|').map(p => p.trim());
      let durationInput = parts[0];
      let reasonInput = parts[1];

      if (!reasonInput && args.length >= 2) {
        durationInput = args[0];
        reasonInput = args.slice(1).join(' ');
      }

      if (!reasonInput) {
        reasonInput = 'Personal leave / Unspecified obligations';
      }

      const now = Date.now();
      const durationMs = parseLoaDuration(durationInput);
      const startTimestamp = now;
      const endTimestamp = startTimestamp + durationMs;

      const loaId = `loa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const member = message.member;
      const cleanName = (member.nickname || member.user.displayName || message.author.username)
        .replace(/^[^\w\s]*LOA[^\w\s]*\s*\|\s*/i, '')
        .replace(/^𝖫𝖮𝖠\s*\|\s*/i, '')
        .trim();

      const record = {
        id: loaId,
        userId: message.author.id,
        userTag: message.author.tag || message.author.username,
        guildId: message.guild.id,
        originalNickname: cleanName,
        startTimestamp,
        endTimestamp,
        reason: reasonInput,
        status: 'pending',
        createdAt: now
      };

      const store = loadLoaRecords();
      if (!store.pending) store.pending = {};
      store.pending[loaId] = record;

      const logChannelId = '1548336007311527996';
      let reviewSent = false;
      try {
        const logChannel = await client.channels.fetch(logChannelId).catch(() => null) ||
          message.guild.channels.cache.find(c => c.name.toLowerCase().includes('loa') && c.isTextBased());
        if (logChannel) {
          const cardPayload = buildLoaSubmissionCard(record);
          const reviewMsg = await logChannel.send(cardPayload);
          record.reviewMessageId = reviewMsg.id;
          record.reviewChannelId = logChannel.id;
          reviewSent = true;
        }
      } catch (postErr) {
        console.error('[LOA] Failed to post to LOA channel:', postErr);
      }

      saveLoaRecords(store);

      await message.delete().catch(() => null);

      const confirmEmbed = new EmbedBuilder()
        .setDescription(
          `> <@${message.author.id}>, your Leave of Absence request has been submitted to Staff Management in <#${logChannelId}>.\n` +
          `> Scheduled Term: <t:${Math.floor(startTimestamp / 1000)}:d> to <t:${Math.floor(endTimestamp / 1000)}:d> (<t:${Math.floor(endTimestamp / 1000)}:R>). You will receive a Direct Message once reviewed.`
        )
        .setColor(0x0284c7);

      const confirmMsg = await message.channel.send({ embeds: [confirmEmbed] });
      setTimeout(() => confirmMsg.delete().catch(() => null), 8000);
      return;
    }

    // -staffdocs [panel]
    if (command === 'staffdocs' || command === 'staffdoc') {
      if (!isStaff(message.member)) {
        return sendCleanFeedback('You must be a staff member to use this command.');
      }
      try {
        const payload = buildStaffDocsHubPayload();
        await message.delete().catch(() => null);
        return message.channel.send(payload);
      } catch (err) {
        console.error('Failed to post staff docs via prefix:', err);
        return sendCleanFeedback(`Error: ${err.message}`);
      }
    }

    // -promote @user <role/rank> | [reason]
    if (command === 'promote') {
      const botInst = getBotInstanceForGuild(message.guild?.id, message.author.id);
      const cust = botInst?.customizations;
      const requiredRole = cust?.promotionStaffRoleId;
      const isOwner = message.guild?.ownerId === message.author?.id;
      const isAdmin = message.member?.permissions?.has(PermissionFlagsBits.Administrator);

      if (requiredRole && !message.member?.roles?.cache?.has(requiredRole) && !isAdmin && !isOwner) {
        return sendCleanFeedback(`You must have the <@&${requiredRole}> role or Administrator permissions to issue promotions.`);
      }
      if (!requiredRole && !isStaff(message.member)) {
        return sendCleanFeedback('You must be a staff member to issue promotions.');
      }
      const targetUser = message.mentions.users.first();
      if (!targetUser) {
        return sendCleanFeedback('Please mention a staff member: `-promote @user <Rank/Role> | [Reason]`');
      }

      // Check for mentioned role in message
      const mentionedRole = message.mentions.roles.first() || (cust?.promotionGiveRoleId ? message.guild.roles.cache.get(cust.promotionGiveRoleId) : null);

      const restArgs = args.filter(a => !a.startsWith('<@')).join(' ').trim();
      const parts = restArgs.split('|').map(p => p.trim());
      const rawRank = parts[0] || (mentionedRole ? mentionedRole.name : 'Promoted Staff');
      const reason = parts[1] || 'Exemplary service and dedication';

      const { role: newRole, rankName: newRank } = resolveRoleAndRank(message.guild, mentionedRole, rawRank);

      // Automatically award role to member if found
      if (newRole) {
        try {
          const member = await message.guild.members.fetch(targetUser.id).catch(() => null);
          if (member) {
            await member.roles.add(newRole);
          }
        } catch (err) {
          console.warn(`[Promote] Could not assign role ${newRole.name}:`, err.message);
        }
      }

      const PROMOTIONS_CHANNEL_ID = cust?.promotionsChannelId || '1550709402896568320';
      let targetChannel = message.guild.channels.cache.get(PROMOTIONS_CHANNEL_ID) ||
        await client.channels.fetch(PROMOTIONS_CHANNEL_ID).catch(() => null) ||
        message.channel;

      try {
        const promoCard = buildPromotionCard({
          user: targetUser,
          newRank,
          oldRank: null,
          reason,
          promotedBy: message.author,
          role: newRole,
          bannerUrl: cust?.promoteBannerUrl || cust?.promotionBannerUrl
        });
        await message.delete().catch(() => null);
        await targetChannel.send(promoCard);
      } catch (err) {
        console.error('Failed to post promotion via prefix:', err);
        return sendCleanFeedback(`Error: ${err.message}`);
      }
      return;
    }

    // -infract @user <type> | <reason> | [proof]
    if (command === 'infract') {
      const botInst = getBotInstanceForGuild(message.guild?.id, message.author.id);
      const cust = botInst?.customizations;
      const requiredRole = cust?.infractionStaffRoleId;
      const isOwner = message.guild?.ownerId === message.author?.id;
      const isAdmin = message.member?.permissions?.has(PermissionFlagsBits.Administrator);

      if (requiredRole && !message.member?.roles?.cache?.has(requiredRole) && !isAdmin && !isOwner) {
        return sendCleanFeedback(`You must have the <@&${requiredRole}> role or Administrator permissions to issue infractions.`);
      }
      if (!requiredRole && !isStaff(message.member)) {
        return sendCleanFeedback('You must be a staff member to issue infractions.');
      }
      const targetUser = message.mentions.users.first();
      if (!targetUser) {
        return sendCleanFeedback('Please mention a staff member: `-infract @user <Type> | <Reason> | [Proof]`');
      }

      const restArgs = args.filter(a => !a.startsWith('<@')).join(' ').trim();
      const parts = restArgs.split('|').map(p => p.trim());
      const type = parts[0] || 'Written Warning';
      const reason = parts[1] || 'Failure to adhere to staff operational policy';
      const proof = parts[2] || null;

      const INFRACTIONS_CHANNEL_ID = cust?.infractionsChannelId || '1550709451152162887';
      let targetChannel = message.guild.channels.cache.get(INFRACTIONS_CHANNEL_ID) ||
        await client.channels.fetch(INFRACTIONS_CHANNEL_ID).catch(() => null) ||
        message.channel;

      // Automatically assign giveRole and remove removeRole if configured
      try {
        const member = await message.guild.members.fetch(targetUser.id).catch(() => null);
        if (member) {
          if (cust?.infractGiveRoleId) {
            await member.roles.add(cust.infractGiveRoleId).catch(() => null);
          }
          if (cust?.infractRemoveRoleId && member.roles.cache.has(cust.infractRemoveRoleId)) {
            await member.roles.remove(cust.infractRemoveRoleId).catch(() => null);
          }
        }
      } catch {}

      try {
        const infractCard = buildInfractionCard({
          user: targetUser,
          type,
          reason,
          proof,
          issuedBy: message.author,
          bannerUrl: cust?.infractBannerUrl || cust?.infractionBannerUrl
        });
        await message.delete().catch(() => null);
        await targetChannel.send(infractCard);
      } catch (err) {
        console.error('Failed to post infraction via prefix:', err);
        return sendCleanFeedback(`Error: ${err.message}`);
      }
      return;
    }
  } catch (err) {
    console.error('Error handling prefix command:', err);
  }
});

/* ========================================================================== */
/*                           INTERACTION ROUTING                              */
/* ========================================================================== */

export async function handleInteraction(interaction) {
  try {
    /* ---------------------------------------------------------------------- */
    /* MASTER BOT GUARD — ERLCX only handles /config, /banbot, /createbot     */
    /* All other commands must be handled by the customer bot, not ERLCX.     */
    /* ---------------------------------------------------------------------- */
    const MASTER_CLIENT_ID = process.env.CLIENT_ID;
    const isMasterBot = interaction.applicationId === MASTER_CLIENT_ID;
    const MASTER_ONLY_COMMANDS = ['config', 'banbot', 'createbot'];

    if (isMasterBot && interaction.isChatInputCommand() && !MASTER_ONLY_COMMANDS.includes(interaction.commandName)) {
      // ERLCX is not supposed to respond to this command — silently ignore
      return;
    }

    // Also guard buttons, modals, and select menus for master bot — only cfg_ interactions pass through
    if (isMasterBot && (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu())) {
      const cid = interaction.customId || '';
      if (!cid.startsWith('cfg_') && !cid.startsWith('cfg_modal') && !cid.startsWith('cfg_nav')) {
        return; // ERLCX ignores non-config UI interactions
      }
    }

    /* ---------------------------------------------------------------------- */
    /* 1. SLASH COMMANDS                                                      */
    /* ---------------------------------------------------------------------- */
    if (interaction.isChatInputCommand()) {
      const botInst = getBotInstanceForGuild(interaction.guild?.id, interaction.user.id);

      // Check if bot is banned
      if (botInst && botInst.banned) {
        return interaction.reply({
          content: `${EMOJIS.CROSS} **Bot Instance Suspended**\n> This bot instance (\`${botInst.botId}\`) has been banned by the platform administrator.\n> **Reason:** \`${botInst.bannedReason || 'Terms violation'}\``,
          flags: 64
        });
      }

      // /config [page] [bot_id]
      if (interaction.commandName === 'config') {
        await interaction.deferReply({ flags: 32832 }).catch(() => null);

        const isUserStaff = isStaff(interaction.member, interaction) ||
          interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
          interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

        if (!isUserStaff) {
          return interaction.editReply({
            content: `${EMOJIS.CROSS} You must have Administrator or Staff permissions to access \`/config\`.`
          });
        }

        const requestedPage = interaction.options.getInteger('page') || 1;
        const requestedBotId = interaction.options.getString('bot_id');
        let targetBot = requestedBotId ? getBotInstance(requestedBotId) : getOrCreateBotInstanceForUser(interaction.user.id, interaction.guild?.id);

        if (!targetBot) {
          return interaction.editReply({
            content: `${EMOJIS.CROSS} Could not find bot instance with ID \`${requestedBotId}\`.`
          });
        }

        const payload = buildConfigPanelPayload(targetBot.botId, requestedPage);
        return interaction.editReply(payload).catch(err => {
          console.error('[CONFIG] editReply error:', err);
        });
      }

      // /createbot [user]
      if (interaction.commandName === 'createbot') {
        const isOwner = interaction.user.id === interaction.guild?.ownerId ||
          interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
        if (!isOwner) {
          return interaction.reply({ content: '❌ Only administrators can create bot instances.', ephemeral: true });
        }
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const newBot = createBotInstance(targetUser.id, { guildId: interaction.guild?.id });
        return interaction.reply({
          content: `✅ **New Bot Instance Created!**\n• **Bot ID:** \`${newBot.botId}\`\n• **Assigned User:** <@${targetUser.id}>\n• **Status:** \`${newBot.status}\`\n\nRun \`/config\` to begin setup.`,
          ephemeral: true
        });
      }

      // /retrigger <bot_id>
      if (interaction.commandName === 'retrigger') {
        const isOwner = interaction.user.id === interaction.guild?.ownerId ||
          interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
        if (!isOwner) {
          return interaction.reply({ content: '❌ Only administrators can retrigger bot instances.', ephemeral: true });
        }
        const bId = interaction.options.getString('bot_id');
        const res = retriggerBot(bId);
        return interaction.reply({
          content: res.success ? `🔄 **Retrigger Success:** ${res.message}` : `❌ **Retrigger Failed:** ${res.message}`,
          ephemeral: true
        });
      }

      // /banbot <bot_id> [reason]
      if (interaction.commandName === 'banbot') {
        const isOwner = interaction.user.id === interaction.guild?.ownerId ||
          interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
        if (!isOwner) {
          return interaction.reply({ content: '❌ Only administrators can ban bot instances.', ephemeral: true });
        }
        const bId = interaction.options.getString('bot_id');
        const reason = interaction.options.getString('reason') || 'Violation of service terms';
        const res = banBot(bId, reason);
        return interaction.reply({
          content: res.success ? `⛔ **Bot Banned:** ${res.message}` : `❌ **Failed to Ban Bot:** ${res.message}`,
          ephemeral: true
        });
      }

      // /unbanbot <bot_id>
      if (interaction.commandName === 'unbanbot') {
        const isOwner = interaction.user.id === interaction.guild?.ownerId ||
          interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
        if (!isOwner) {
          return interaction.reply({ content: '❌ Only administrators can unban bot instances.', ephemeral: true });
        }
        const bId = interaction.options.getString('bot_id');
        const res = unbanBot(bId);
        return interaction.reply({
          content: res.success ? `✅ **Bot Unbanned:** ${res.message}` : `❌ **Failed to Unban Bot:** ${res.message}`,
          ephemeral: true
        });
      }

      // /listbots
      if (interaction.commandName === 'listbots') {
        const isOwner = interaction.user.id === interaction.guild?.ownerId ||
          interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
        if (!isOwner) {
          return interaction.reply({ content: '❌ Only administrators can view bot instances.', ephemeral: true });
        }
        const bots = listBots();
        const listText = bots.map(b =>
          `• \`${b.botId}\`: Owner: <@${b.ownerUserId}> | Status: \`${b.status}\` | Banned: \`${b.banned ? 'YES' : 'NO'}\` | Setup: \`${b.setupCompleted ? 'Complete' : 'Pending'}\``
        ).join('\n') || 'No bot instances registered.';

        const listEmbed = new EmbedBuilder()
          .setTitle('🤖 Registered Bot Instances')
          .setDescription(listText)
          .setColor(0x0a84fd);

        return interaction.reply({ embeds: [listEmbed], ephemeral: true });
      }

      // Standalone /purge <amount>
      if (interaction.commandName === 'purge') {
        await interaction.deferReply({ flags: 64 });

        const isUserStaff = isStaff(interaction.member, interaction) ||
          interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages);

        if (!isUserStaff) {
          return interaction.editReply({
            content: 'You do not have permission to use `/purge` (requires Manage Messages or Staff role).'
          });
        }

        const botMember = interaction.guild?.members?.me;
        if (botMember && !interaction.channel.permissionsFor(botMember)?.has(PermissionFlagsBits.ManageMessages)) {
          return interaction.editReply({
            content: 'I need the **Manage Messages** permission in this channel to delete messages.'
          });
        }

        const amount = interaction.options.getInteger('amount');
        try {
          const deleted = await interaction.channel.bulkDelete(amount, true);
          return interaction.editReply({
            content: `Successfully deleted **${deleted.size}** message(s).`
          });
        } catch (err) {
          console.error('Slash purge error:', err);
          return interaction.editReply({
            content: `Failed to purge messages: ${err.message}`
          });
        }
      }
      // Standalone /add <user>
      if (interaction.commandName === 'add') {
        const activeTicket = getActiveTicket(interaction.channel.id);
        if (!activeTicket) {
          return interaction.reply({
            content: 'This command can only be used inside an active ticket channel.',
            ephemeral: true
          });
        }
        if (!isStaff(interaction.member, interaction) && activeTicket.authorId !== interaction.user.id) {
          return interaction.reply({
            content: 'Only staff members or the ticket creator can add users to this ticket.',
            ephemeral: true
          });
        }

        const targetUser = interaction.options.getUser('user');
        await interaction.channel.permissionOverwrites.edit(targetUser.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          EmbedLinks: true
        });

        const addEmbed = new EmbedBuilder()
          .setDescription(`> <@${targetUser.id}> has been added to this ticket by <@${interaction.user.id}>.`);

        return interaction.reply({ embeds: [addEmbed] });
      }

      // Standalone /remove <user>
      if (interaction.commandName === 'remove') {
        const activeTicket = getActiveTicket(interaction.channel.id);
        if (!activeTicket) {
          return interaction.reply({
            content: 'This command can only be used inside an active ticket channel.',
            ephemeral: true
          });
        }
        if (!isStaff(interaction.member, interaction) && activeTicket.authorId !== interaction.user.id) {
          return interaction.reply({
            content: 'Only staff members or the ticket creator can remove users from this ticket.',
            ephemeral: true
          });
        }

        const targetUser = interaction.options.getUser('user');
        if (targetUser.id === activeTicket.authorId) {
          return interaction.reply({
            content: 'You cannot remove the ticket creator from their own ticket.',
            ephemeral: true
          });
        }

        await interaction.channel.permissionOverwrites.delete(targetUser.id).catch(() => null);

        const removeEmbed = new EmbedBuilder()
          .setDescription(`> <@${targetUser.id}> has been removed from this ticket by <@${interaction.user.id}>.`);

        return interaction.reply({ embeds: [removeEmbed] });
      }

      // Standalone /say <message> [channel]
      if (interaction.commandName === 'say') {
        await interaction.deferReply({ flags: 64 });

        if (!isStaff(interaction.member, interaction)) {
          return interaction.editReply({
            content: 'You must be a staff member or administrator to use this command.'
          });
        }

        const messageText = interaction.options.getString('message');
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

        try {
          await targetChannel.send({ content: messageText });
          return interaction.editReply({
            content: `Message successfully sent to <#${targetChannel.id}>.`
          });
        } catch (err) {
          console.error('Say command error:', err);
          return interaction.editReply({
            content: `Failed to send message: ${err.message}`
          });
        }
      }

      // /session commands (panel, vote)
      if (interaction.commandName === 'session') {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'panel') {
          await interaction.deferReply({ flags: 64 });

          if (!isStaff(interaction.member, interaction)) {
            return interaction.editReply({
              content: 'You must be a staff member or administrator to run this command.'
            });
          }

          const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

          try {
            await activateLiveSessionPanel(interaction.client, targetChannel.id);

            return interaction.editReply({
              content: `Session Information panel successfully posted to <#${targetChannel.id}>.`
            });
          } catch (sendErr) {
            console.error('Failed to post session panel:', sendErr);
            return interaction.editReply({
              content: `Failed to send session panel to <#${targetChannel.id}>: ${sendErr.message}`
            });
          }
        }

        if (subcommand === 'shutdown') {
          await interaction.deferReply({ flags: 64 });

          if (!isStaff(interaction.member, interaction)) {
            return interaction.editReply({
              content: 'You must be a staff member or administrator to shut down a session.'
            });
          }

          const targetChannel = interaction.options.getChannel('channel')
            || (CONFIG.SESSION.CHANNEL_ID ? await interaction.client.channels.fetch(CONFIG.SESSION.CHANNEL_ID).catch(() => null) : null)
            || interaction.channel;

          try {
            await shutdownSession(interaction.client, targetChannel.id);
            return interaction.editReply({
              content: `Session officially shut down. Session Ended panel has been posted in <#${targetChannel.id}>.`
            });
          } catch (err) {
            console.error('Failed to shut down session:', err);
            return interaction.editReply({
              content: `Failed to shut down session: ${err.message}`
            });
          }
        }

        if (subcommand === 'info') {
          await interaction.deferReply({ flags: 64 });

          if (!isStaff(interaction.member, interaction)) {
            return interaction.editReply({
              content: 'You must be a staff member or administrator to run this command.'
            });
          }

          const targetChannel = interaction.options.getChannel('channel')
            || (CONFIG.SESSION.CHANNEL_ID ? await interaction.client.channels.fetch(CONFIG.SESSION.CHANNEL_ID).catch(() => null) : null)
            || interaction.channel;

          try {
            const infoPayload = buildSessionInfoCard();
            await targetChannel.send(infoPayload);
            return interaction.editReply({
              content: `Session info announcement posted in <#${targetChannel.id}>.`
            });
          } catch (err) {
            console.error('Failed to post session info:', err);
            return interaction.editReply({
              content: `Failed to send session info: ${err.message}`
            });
          }
        }

        if (subcommand === 'vote') {
          await interaction.deferReply({ flags: 64 });

          if (!isStaff(interaction.member, interaction)) {
            return interaction.editReply({
              content: 'You must be a staff member or administrator to initiate a session vote.'
            });
          }

          const required = interaction.options.getInteger('required');
          const durationCode = interaction.options.getString('duration');
          const pingRole = interaction.options.getRole('role') || { id: CONFIG.SESSION.NOTIFICATION_ROLE_ID };
          const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

          const durationLabels = {
            '30m': '30 Minutes',
            '1h': '1 Hour',
            '2h': '2 Hours',
            '3h': '3 Hours',
            '5h': '5 Hours',
            '12h': '12 Hours',
            '24h': '24 Hours'
          };
          const durationLabel = durationLabels[durationCode] || durationCode;

          const voteId = `vote_${Date.now()}`;
          const vote = {
            id: voteId,
            channelId: targetChannel.id,
            messageId: null,
            hostId: interaction.user.id,
            hostName: interaction.member?.displayName || interaction.user.username,
            requiredVotes: required,
            voters: [],
            pingRoleId: pingRole.id,
            durationLabel: durationLabel,
            createdAt: Date.now(),
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
            status: 'active'
          };

          try {
            if (pingRole?.id) {
              await targetChannel.send({ content: `<@&${pingRole.id}>` });
            }

            const payload = buildSessionVotePayload(vote);
            const sentMsg = await targetChannel.send(payload);
            vote.messageId = sentMsg.id;
            saveSessionVote(vote);

            return interaction.editReply({
              content: `Official Session Vote successfully posted to <#${targetChannel.id}>!`
            });
          } catch (err) {
            console.error('Failed to post session vote:', err);
            return interaction.editReply({
              content: `Failed to start session vote: ${err.message}`
            });
          }
        }
      }

      // /giveaway commands (start, end, reroll)
      if (interaction.commandName === 'giveaway') {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'start') {
          await interaction.deferReply({ flags: 64 });

          if (!isStaff(interaction.member, interaction)) {
            return interaction.editReply({
              content: 'You must be a staff member or administrator to start a giveaway.'
            });
          }

          const prize = interaction.options.getString('prize');
          const durationInput = interaction.options.getString('duration');
          const durationMs = parseDuration(durationInput);

          if (!durationMs || durationMs < 5000) {
            return interaction.editReply({
              content: 'Invalid duration. Please use formats like `30s`, `10m`, `1h`, `1d`.'
            });
          }

          const winnerCount = interaction.options.getInteger('winners') || 1;
          const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
          const pingRole = interaction.options.getRole('role');

          const giveaway = {
            id: null,
            channelId: targetChannel.id,
            guildId: interaction.guildId,
            prize: prize,
            hostId: interaction.user.id,
            winnerCount: winnerCount,
            entries: [],
            startedAt: Date.now(),
            endsAt: Date.now() + durationMs,
            ended: false,
            winners: []
          };

          try {
            if (pingRole) {
              await targetChannel.send({ content: `<@&${pingRole.id}>` });
            }

            const cardPayload = buildGiveawayCard(giveaway);
            const sentMsg = await targetChannel.send(cardPayload);
            giveaway.id = sentMsg.id;
            saveGiveaway(giveaway);
            await sentMsg.edit(buildGiveawayCard(giveaway, false)).catch(() => null);

            return interaction.editReply({
              content: `${GIVEAWAY_EMOJI} Giveaway for **${prize}** successfully created in <#${targetChannel.id}>!`
            });
          } catch (err) {
            console.error('Failed to create giveaway:', err);
            return interaction.editReply({
              content: `Failed to create giveaway: ${err.message}`
            });
          }
        }

        if (subcommand === 'end') {
          await interaction.deferReply({ flags: 64 });

          if (!isStaff(interaction.member, interaction)) {
            return interaction.editReply({
              content: 'You must be a staff member or administrator to end a giveaway.'
            });
          }

          const query = interaction.options.getString('giveaway');
          const giveaway = findActiveGiveaway(query, interaction.channel.id);

          if (!giveaway) {
            return interaction.editReply({
              content: 'Could not find an active giveaway in this channel.'
            });
          }

          try {
            await endGiveaway(interaction.client, giveaway.id);
            return interaction.editReply({
              content: `${GIVEAWAY_EMOJI} Giveaway for **${giveaway.prize}** has been concluded.`
            });
          } catch (err) {
            return interaction.editReply({
              content: `Failed to end giveaway: ${err.message}`
            });
          }
        }

        if (subcommand === 'reroll') {
          await interaction.deferReply({ flags: 64 });

          if (!isStaff(interaction.member, interaction)) {
            return interaction.editReply({
              content: 'You must be a staff member or administrator to reroll a giveaway.'
            });
          }

          const query = interaction.options.getString('giveaway');
          const giveaway = findConcludedGiveaway(query, interaction.channel.id);

          if (!giveaway) {
            return interaction.editReply({
              content: 'Could not find a concluded giveaway in this channel.'
            });
          }

          const winnersCount = interaction.options.getInteger('winners') || giveaway.winnerCount || 1;

          try {
            const newWinners = await rerollGiveaway(interaction.client, giveaway.id, winnersCount);
            const winnerPings = newWinners.map(id => `<@${id}>`).join(', ');
            return interaction.editReply({
              content: `${GIVEAWAY_EMOJI} Successfully rerolled giveaway. New winner(s): ${winnerPings}`
            });
          } catch (err) {
            return interaction.editReply({
              content: `Failed to reroll giveaway: ${err.message}`
            });
          }
        }
      }

      // /application panel [channel] | /application setreview <channel>
      if (interaction.commandName === 'application') {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'panel') {
          await interaction.deferReply({ ephemeral: true });

          if (!isStaff(interaction.member, interaction)) {
            return interaction.editReply({
              content: 'You must be a staff member or administrator to run this command.'
            });
          }

          const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
          const botInst = getBotInstanceForGuild(interaction.guildId);
          const panelPayload = buildApplicationPanel(botInst?.customizations);

          try {
            await targetChannel.send(panelPayload);
            return interaction.editReply({
              content: `Successfully dispatched the Staff Application Panel to <#${targetChannel.id}>!`
            });
          } catch (err) {
            console.error('Failed to send application panel:', err);
            return interaction.editReply({
              content: `Failed to send application panel: ${err.message}`
            });
          }
        }

        if (subcommand === 'setreview') {
          await interaction.deferReply({ ephemeral: true });

          if (!isStaff(interaction.member, interaction)) {
            return interaction.editReply({
              content: 'You must be a staff member or administrator to run this command.'
            });
          }

          const targetChannel = interaction.options.getChannel('channel');
          setReviewChannel(targetChannel.id);
          return interaction.editReply({
            content: `Staff application review channel has been set to <#${targetChannel.id}>.`
          });
        }

        if (subcommand === 'setresults') {
          await interaction.deferReply({ ephemeral: true });

          if (!isStaff(interaction.member, interaction)) {
            return interaction.editReply({
              content: 'You must be a staff member or administrator to run this command.'
            });
          }

          const targetChannel = interaction.options.getChannel('channel');
          setResultsChannel(targetChannel.id);
          return interaction.editReply({
            content: `Staff application results channel has been set to <#${targetChannel.id}>.`
          });
        }
        return;
      }

      // /welcome [action: test/status/enable/disable] | /testwelcome
      if (interaction.commandName === 'welcome' || interaction.commandName === 'testwelcome') {
        await interaction.deferReply({ flags: 64 });

        if (!isStaff(interaction.member, interaction)) {
          return interaction.editReply({
            content: 'You must be a staff member or administrator to run this command.'
          });
        }

        const sub = interaction.options.getSubcommand?.(false);
        if (sub === 'disable' || sub === 'off') {
          CONFIG.WELCOME.ENABLED = false;
          return interaction.editReply({
            content: '🔇 Welcome system has been **disabled** for new joins.'
          });
        }
        if (sub === 'enable' || sub === 'on') {
          CONFIG.WELCOME.ENABLED = true;
          return interaction.editReply({
            content: '🔊 Welcome system has been **enabled** for new joins.'
          });
        }
        if (sub === 'status') {
          const status = CONFIG.WELCOME?.ENABLED ? '🟢 Enabled' : '🔴 Disabled';
          return interaction.editReply({
            content: `**Welcome System Status:** ${status}\nTarget Channel: <#${CONFIG.WELCOME.CHANNEL_ID}>`
          });
        }

        // test subcommand or default
        const GUILD_WELCOME_MAP = {
          '1541210827967823955': CONFIG.WELCOME.CHANNEL_ID || '1548147497854181397',
          '1530147023754367006': '1549635572698447932'
        };
        const preferredId = GUILD_WELCOME_MAP[interaction.guild.id] || CONFIG.WELCOME.CHANNEL_ID;
        const targetChannel = interaction.options.getChannel?.('channel') ||
          (preferredId ? interaction.guild.channels.cache.get(preferredId) : null) ||
          interaction.channel;

        try {
          const payload = buildWelcomePayload(interaction.member);
          await targetChannel.send(payload);
          const statusNote = CONFIG.WELCOME?.ENABLED === false ? ' *(Note: Welcome system is currently turned off for new joins)*' : '';
          return interaction.editReply({
            content: `Successfully sent test welcome card to <#${targetChannel.id}>!${statusNote}`
          });
        } catch (err) {
          console.error('Error sending test welcome:', err);
          return interaction.editReply({
            content: `Failed to send test welcome message: ${err.message}`
          });
        }
      }

      // /department panel [channel] | /departments [channel]
      if (interaction.commandName === 'department' || interaction.commandName === 'departments') {
        await interaction.deferReply({ flags: 64 });

        if (!isStaff(interaction.member, interaction)) {
          return interaction.editReply({
            content: 'You must be a staff member or administrator to run this command.'
          });
        }

        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

        try {
          await postDepartmentPanel(targetChannel);
          return interaction.editReply({
            content: `Successfully dispatched the Department Panel to <#${targetChannel.id}>!`
          });
        } catch (err) {
          console.error('Failed to post department panel:', err);
          return interaction.editReply({
            content: `Failed to dispatch department panel: ${err.message}`
          });
        }
      }

      // /staffdocs panel [channel]
      if (interaction.commandName === 'staffdocs') {
        if (interaction.deferred || interaction.replied) return;
        await interaction.deferReply({ flags: 64 });
        if (!isStaff(interaction.member, interaction)) {
          return interaction.editReply({
            content: 'You must be a staff member or administrator to run this command.'
          });
        }
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        const botInst = getBotInstanceForGuild(interaction.guildId);
        try {
          const payload = buildStaffDocsHubPayload(botInst?.customizations);
          await targetChannel.send(payload);
          return interaction.editReply({
            content: `Successfully dispatched the Staff Documentation Hub to <#${targetChannel.id}>!`
          });
        } catch (err) {
          console.error('Failed to post staff documentation panel:', err);
          return interaction.editReply({
            content: `Failed to dispatch staff documentation hub: ${err.message}`
          });
        }
      }

      // /promote <user> [role] [rank] [old_role] [old_rank] [reason] [channel]
      // /promote <user> [role] [rank] [old_role] [old_rank] [reason] [channel]
      if (interaction.commandName === 'promote') {
        if (interaction.deferred || interaction.replied) return;
        await interaction.deferReply({ flags: 64 });

        const botInst = getBotInstanceForGuild(interaction.guildId);
        const cust = botInst?.customizations;
        const requiredRole = cust?.promotionStaffRoleId;
        const isOwner = interaction.guild?.ownerId === interaction.user?.id;
        const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

        if (requiredRole && !interaction.member?.roles?.cache?.has(requiredRole) && !isAdmin && !isOwner) {
          return interaction.editReply({
            content: `You must have the <@&${requiredRole}> role or Administrator permissions to issue promotions.`
          });
        }
        if (!requiredRole && !isStaff(interaction.member, interaction)) {
          return interaction.editReply({
            content: 'You must be a staff member or administrator to issue promotions.'
          });
        }
        const targetUser = interaction.options.getUser('user');
        const roleOption = interaction.options.getRole('role') || (cust?.promotionGiveRoleId ? interaction.guild.roles.cache.get(cust.promotionGiveRoleId) : null);
        const rankOption = interaction.options.getString('rank');
        const oldRoleOption = interaction.options.getRole('old_role');
        const oldRankOption = interaction.options.getString('old_rank');
        const reason = interaction.options.getString('reason');

        // Resolve new role and clean rank title
        const { role: newRole, rankName: newRank } = resolveRoleAndRank(interaction.guild, roleOption, rankOption);
        // Resolve previous role/rank if provided
        const { role: oldRole, rankName: oldRank } = resolveRoleAndRank(interaction.guild, oldRoleOption, oldRankOption);

        // Automatically assign new role to promoted member (and remove old role if specified)
        let roleAwarded = false;
        let roleError = null;
        if (newRole) {
          try {
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (member) {
              await member.roles.add(newRole);
              roleAwarded = true;
              if (oldRole && member.roles.cache.has(oldRole.id)) {
                await member.roles.remove(oldRole).catch(() => null);
              }
            }
          } catch (err) {
            console.warn(`[Promote] Could not assign role ${newRole.name}:`, err.message);
            roleError = err.message;
          }
        }

        const PROMOTIONS_CHANNEL_ID = cust?.promotionsChannelId || '1550709402896568320';
        let targetChannel = interaction.options.getChannel('channel') ||
          interaction.guild.channels.cache.get(PROMOTIONS_CHANNEL_ID) ||
          await interaction.client.channels.fetch(PROMOTIONS_CHANNEL_ID).catch(() => null) ||
          interaction.channel;

        try {
          const promoCard = buildPromotionCard({
            user: targetUser,
            newRank,
            oldRank: oldRank !== 'Promoted Staff' ? oldRank : null,
            reason,
            promotedBy: interaction.user,
            role: newRole,
            bannerUrl: cust?.promoteBannerUrl || cust?.promotionBannerUrl
          });
          await targetChannel.send(promoCard);

          let feedback = `Official promotion announcement for <@${targetUser.id}> dispatched to <#${targetChannel.id}>!`;
          if (roleAwarded) {
            feedback += `\nRole **${newRole.name}** was automatically awarded to <@${targetUser.id}>.`;
          } else if (roleError) {
            feedback += `\n*(Note: Role assignment failed: ${roleError}. Please verify bot role permissions)*`;
          }

          return interaction.editReply({ content: feedback });
        } catch (err) {
          console.error('Failed to post promotion announcement:', err);
          return interaction.editReply({
            content: `Failed to dispatch promotion card: ${err.message}`
          });
        }
      }

      // /infract <user> <type> <reason> [proof] [channel]
      if (interaction.commandName === 'infract') {
        if (interaction.deferred || interaction.replied) return;
        await interaction.deferReply({ flags: 64 });

        const botInst = getBotInstanceForGuild(interaction.guildId);
        const cust = botInst?.customizations;
        const requiredRole = cust?.infractionStaffRoleId;
        const isOwner = interaction.guild?.ownerId === interaction.user?.id;
        const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

        if (requiredRole && !interaction.member?.roles?.cache?.has(requiredRole) && !isAdmin && !isOwner) {
          return interaction.editReply({
            content: `You must have the <@&${requiredRole}> role or Administrator permissions to log infractions.`
          });
        }
        if (!requiredRole && !isStaff(interaction.member, interaction)) {
          return interaction.editReply({
            content: 'You must be a staff member or administrator to log infractions.'
          });
        }
        const targetUser = interaction.options.getUser('user');
        const type = interaction.options.getString('type');
        const reason = interaction.options.getString('reason');
        const proof = interaction.options.getString('proof');

        const INFRACTIONS_CHANNEL_ID = cust?.infractionsChannelId || '1550709451152162887';
        let targetChannel = interaction.options.getChannel('channel') ||
          interaction.guild.channels.cache.get(INFRACTIONS_CHANNEL_ID) ||
          await interaction.client.channels.fetch(INFRACTIONS_CHANNEL_ID).catch(() => null) ||
          interaction.channel;

        // Automatically assign giveRole and remove removeRole if configured
        try {
          const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
          if (member) {
            if (cust?.infractGiveRoleId) {
              await member.roles.add(cust.infractGiveRoleId).catch(() => null);
            }
            if (cust?.infractRemoveRoleId && member.roles.cache.has(cust.infractRemoveRoleId)) {
              await member.roles.remove(cust.infractRemoveRoleId).catch(() => null);
            }
          }
        } catch {}
        try {
          const infractCard = buildInfractionCard({
            user: targetUser,
            type,
            reason,
            proof,
            issuedBy: interaction.user,
            bannerUrl: botInst?.customizations?.infractBannerUrl
          });
          await targetChannel.send(infractCard);
          return interaction.editReply({
            content: `Official infraction record (${type}) for <@${targetUser.id}> logged in <#${targetChannel.id}>!`
          });
        } catch (err) {
          console.error('Failed to post infraction card:', err);
          return interaction.editReply({
            content: `Failed to dispatch infraction card: ${err.message}`
          });
        }
      }

      // /loa request <start> <end> <reason>
      if (interaction.commandName === 'loa') {
        if (interaction.deferred || interaction.replied) return;
        await interaction.deferReply({ flags: 64 });
        const startInput = interaction.options.getString('start');
        const endInput = interaction.options.getString('end');
        const reason = interaction.options.getString('reason');

        const now = Date.now();
        const durationMs = parseLoaDuration(endInput);
        let startTimestamp = Date.parse(startInput);
        if (isNaN(startTimestamp) || startTimestamp < now - 86400000) {
          startTimestamp = now;
        }
        const endTimestamp = startTimestamp + durationMs;

        const loaId = `loa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const member = interaction.member;
        const cleanName = (member.nickname || member.user.displayName || member.user.username)
          .replace(/^[^\w\s]*LOA[^\w\s]*\s*\|\s*/i, '')
          .replace(/^𝖫𝖮𝖠\s*\|\s*/i, '')
          .trim();

        const record = {
          id: loaId,
          userId: interaction.user.id,
          userTag: interaction.user.tag || interaction.user.username,
          guildId: interaction.guildId,
          originalNickname: cleanName,
          startTimestamp,
          endTimestamp,
          reason,
          status: 'pending',
          createdAt: now
        };

        const store = loadLoaRecords();
        if (!store.pending) store.pending = {};
        store.pending[loaId] = record;

        // Post to LOA review/log channel (1548336007311527996)
        const logChannelId = '1548336007311527996';
        let reviewSent = false;
        try {
          const logChannel = await interaction.client.channels.fetch(logChannelId).catch(() => null) ||
            interaction.guild.channels.cache.find(c => c.name.toLowerCase().includes('loa') && c.isTextBased());
          if (logChannel) {
            const cardPayload = buildLoaSubmissionCard(record);
            const reviewMsg = await logChannel.send(cardPayload);
            record.reviewMessageId = reviewMsg.id;
            record.reviewChannelId = logChannel.id;
            reviewSent = true;
          }
        } catch (postErr) {
          console.error('[LOA] Failed to post to LOA channel:', postErr);
        }

        saveLoaRecords(store);

        if (reviewSent) {
          return interaction.editReply({
            content: `Your Leave of Absence request has been submitted to Staff Management for review (<t:${Math.floor(startTimestamp / 1000)}:d> to <t:${Math.floor(endTimestamp / 1000)}:d>). You will receive a Direct Message once processed.`
          });
        } else {
          return interaction.editReply({
            content: `Leave of Absence request recorded, but could not dispatch to <#${logChannelId}>. Please ensure Staff Management reviews your request.`
          });
        }
      }

      // /commands
      if (interaction.commandName === 'commands') {
        const payload = buildCommandsDirectoryPayload(interaction.client, 0, interaction.guildId);
        await interaction.reply(payload);
        setTimeout(() => {
          interaction.deleteReply().catch(() => null);
        }, 60000);
        return;
      }

      // /refont <text>
      if (interaction.commandName === 'refont') {
        const text = interaction.options.getString('text');
        const styled = toSansSerif(text || '');
        return interaction.reply({ content: styled });
      }

      // /media <image> [title] [caption] [credit] [ping] [channel]
      if (interaction.commandName === 'media') {
        await interaction.deferReply({ flags: 64 });

        const attachment = interaction.options.getAttachment('image');
        if (!attachment) {
          return interaction.editReply({ content: 'Please provide a valid image attachment.' });
        }

        const title = interaction.options.getString('title');
        const caption = interaction.options.getString('caption');
        const pingRole = interaction.options.getRole('ping');
        const creditUser = interaction.options.getUser('credit') || interaction.user;
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

        const { v2Payload, fallbackPayload } = buildMediaShowcasePayload({
          attachment,
          title,
          caption,
          creditUser,
          pingRole
        });

        try {
          await targetChannel.send(v2Payload);
        } catch (v2Err) {
          console.warn('[Media] Components V2 send fallback:', v2Err.message);
          await targetChannel.send(fallbackPayload);
        }

        return interaction.editReply({
          content: `Successfully published media showcase in <#${targetChannel.id}>!`
        });
      }

      if (interaction.commandName !== 'ticket') return;

      const subcommand = interaction.options.getSubcommand();

      // /ticket panel [channel]
      if (subcommand === 'panel') {
        await interaction.deferReply({ ephemeral: true });

        if (!isStaff(interaction.member, interaction)) {
          return interaction.editReply({
            content: 'You must be a staff member or administrator to run this command.'
          });
        }

        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

        // Verify channel permissions for bot
        if (targetChannel.guild && interaction.guild.members.me) {
          const perms = targetChannel.permissionsFor(interaction.guild.members.me);
          if (perms && (!perms.has(PermissionFlagsBits.SendMessages) || !perms.has(PermissionFlagsBits.EmbedLinks))) {
            return interaction.editReply({
              content: `I do not have permission to send messages and embeds in <#${targetChannel.id}>. Please grant "Send Messages" and "Embed Links" permissions.`
            });
          }
        }

        const botInst = getBotInstanceForGuild(interaction.guild?.id);
        const panelPayload = buildTicketPanel(null, botInst?.customizations);

        try {
          const sentMessage = await targetChannel.send(panelPayload);
          addPanelRecord(targetChannel.id, sentMessage.id);

          return interaction.editReply({
            content: `Support desk panel successfully posted in <#${targetChannel.id}>.`
          });
        } catch (sendErr) {
          console.error('Failed to post ticket panel:', sendErr);
          return interaction.editReply({
            content: `Failed to send ticket panel to <#${targetChannel.id}>: ${sendErr.message}`
          });
        }
      }

      // /ticket status <online|busy|closed>
      if (subcommand === 'status') {
        await interaction.deferReply({ ephemeral: true });

        if (!isStaff(interaction.member, interaction)) {
          return interaction.editReply({
            content: 'You must be a staff member or administrator to change desk status.'
          });
        }

        const newStatus = interaction.options.getString('status');
        setDeskStatus(newStatus);
        await updateAllLivePanels(client);

        const statusInfo = CONFIG.STATUS_PRESETS[newStatus];
        return interaction.editReply({
          content: `Support desk operational status updated to **${statusInfo.label}**. All live panels have been refreshed.`
        });
      }

      // /ticket category <category> <state>
      if (subcommand === 'category') {
        await interaction.deferReply({ ephemeral: true });

        if (!isStaff(interaction.member, interaction)) {
          return interaction.editReply({
            content: 'You must be a staff member or administrator to toggle category states.'
          });
        }

        const categoryId = interaction.options.getString('category');
        const state = interaction.options.getString('state');
        toggleCategory(categoryId, state);
        await updateAllLivePanels(client);

        const categoryObj = CONFIG.CATEGORIES.find(c => c.id === categoryId);
        const stateLabel = state === 'enable' ? '**Available**' : '**Unavailable**';

        return interaction.editReply({
          content: `Category **${categoryObj?.label || categoryId}** has been set to ${stateLabel}. All live panels refreshed.`
        });
      }

      // Inside Ticket Commands: verify active ticket
      const activeTicket = getActiveTicket(interaction.channel.id);

      // /ticket close [reason]
      if (subcommand === 'close') {
        if (!activeTicket) {
          return interaction.reply({
            content: 'This command can only be used inside an active ticket channel.',
            ephemeral: true
          });
        }

        const reason = interaction.options.getString('reason') || 'Closed via slash command';
        await interaction.reply({
          content: `Close initiated by <@${interaction.user.id}>...`,
          ephemeral: false
        });

        await closeTicketWorkflow(interaction.channel, interaction.user, reason);
        return;
      }

      // /ticket claim
      if (subcommand === 'claim') {
        if (!activeTicket) {
          return interaction.reply({
            content: 'This command can only be used inside an active ticket channel.',
            ephemeral: true
          });
        }
        if (!isStaff(interaction.member, interaction)) {
          return interaction.reply({
            content: 'Only staff members can claim tickets.',
            ephemeral: true
          });
        }

        activeTicket.claimedBy = interaction.user.id;
        activeTicket.claimedTag = interaction.user.tag;
        saveActiveTicket(interaction.channel.id, activeTicket);

        const botInst = getBotForInteraction(interaction);
        const cust = botInst?.customizations || DEFAULT_CUSTOMIZATIONS;

        if (activeTicket.controlMessageId) {
          const controlMsg = await interaction.channel.messages.fetch(activeTicket.controlMessageId).catch(() => null);
          if (controlMsg) await controlMsg.edit(buildTicketControl(activeTicket, cust)).catch(() => null);
        }

        await interaction.reply({
          content: `<@${interaction.user.id}> has claimed this ticket.`
        });
        return;
      }

      // /ticket unclaim
      if (subcommand === 'unclaim') {
        if (!activeTicket) {
          return interaction.reply({
            content: 'This command can only be used inside an active ticket channel.',
            ephemeral: true
          });
        }
        if (!isStaff(interaction.member, interaction)) {
          return interaction.reply({
            content: 'Only staff members can unclaim tickets.',
            ephemeral: true
          });
        }

        if (activeTicket.claimedBy !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({
            content: 'Only the assigned handler or an administrator can unclaim this ticket.',
            ephemeral: true
          });
        }

        activeTicket.claimedBy = null;
        activeTicket.claimedTag = null;
        saveActiveTicket(interaction.channel.id, activeTicket);

        const botInst = getBotForInteraction(interaction);
        const cust = botInst?.customizations || DEFAULT_CUSTOMIZATIONS;

        if (activeTicket.controlMessageId) {
          const controlMsg = await interaction.channel.messages.fetch(activeTicket.controlMessageId).catch(() => null);
          if (controlMsg) await controlMsg.edit(buildTicketControl(activeTicket, cust)).catch(() => null);
        }

        await interaction.reply({
          content: `This ticket has been unclaimed and returned to staff.`
        });
        return;
      }

      // /ticket add <user>
      if (subcommand === 'add') {
        if (!activeTicket) {
          return interaction.reply({
            content: 'This command can only be used inside an active ticket channel.',
            ephemeral: true
          });
        }
        if (!isStaff(interaction.member, interaction)) {
          return interaction.reply({
            content: 'Only staff members can add users to tickets.',
            ephemeral: true
          });
        }

        const targetUser = interaction.options.getUser('user');
        await interaction.channel.permissionOverwrites.edit(targetUser.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          EmbedLinks: true
        });

        return interaction.reply({
          content: `Added <@${targetUser.id}> to this ticket.`
        });
      }

      // /ticket remove <user>
      if (subcommand === 'remove') {
        if (!activeTicket) {
          return interaction.reply({
            content: 'This command can only be used inside an active ticket channel.',
            ephemeral: true
          });
        }
        if (!isStaff(interaction.member, interaction)) {
          return interaction.reply({
            content: 'Only staff members can remove users from tickets.',
            ephemeral: true
          });
        }

        const targetUser = interaction.options.getUser('user');
        if (targetUser.id === activeTicket.authorId) {
          return interaction.reply({
            content: 'You cannot remove the ticket creator from their own ticket.',
            ephemeral: true
          });
        }

        await interaction.channel.permissionOverwrites.delete(targetUser.id).catch(() => null);
        return interaction.reply({
          content: `Removed <@${targetUser.id}> from this ticket.`
        });
      }

      // /ticket rename <name>
      if (subcommand === 'rename') {
        if (!activeTicket) {
          return interaction.reply({
            content: 'This command can only be used inside an active ticket channel.',
            ephemeral: true
          });
        }
        if (!isStaff(interaction.member, interaction)) {
          return interaction.reply({
            content: 'Only staff members can rename tickets.',
            ephemeral: true
          });
        }

        const rawName = interaction.options.getString('name');
        const cleanName = rawName.toLowerCase().replace(/[^a-z0-9-_]/g, '');
        const finalName = `ticket-${cleanName}`;

        await interaction.channel.setName(finalName);
        return interaction.reply({
          content: `Channel renamed to **#${finalName}**.`
        });
      }
    }

    /* ---------------------------------------------------------------------- */
    /* 2. CATEGORY SELECT MENU (TICKET CREATION MODAL TRIGGER)                */
    /* ---------------------------------------------------------------------- */
    if (interaction.isStringSelectMenu()) {
      // /config category navigation select menu
      if (interaction.customId.startsWith('cfg_select_page_')) {
        await interaction.deferUpdate().catch(() => null);
        const botId = interaction.customId.replace('cfg_select_page_', '');
        const targetPage = parseInt(interaction.values[0], 10) || 1;
        const payload = buildConfigPanelPayload(botId, targetPage);
        return interaction.editReply(payload).catch(() => null);
      }

      // Staff Documentation Dropdown Selector (strictly zero emojis)
      if (interaction.customId === 'staff_docs_select') {
        const sectionId = interaction.values[0];
        const payload = buildStaffDocSectionPayload(sectionId);
        return interaction.reply({
          ...payload,
          ephemeral: true
        });
      }

      // Staff Application Position Selector
      if (interaction.customId === 'application_select_role') {
        const selectedRole = interaction.values[0]; // 'ingame_mod' or 'discord_mod'
        const roleName = getRoleDisplayName(selectedRole);

        if (!isPositionOpen(selectedRole)) {
          return interaction.reply({
            content: `${roleName} applications are currently closed by Management. Please check back later.`,
            ephemeral: true
          });
        }

        try {
          const session = {
            role: selectedRole,
            modules: {
              mod1: false,
              mod2: false,
              mod3: false,
              mod4: false
            },
            answers: {
              discord_username: interaction.user.tag,
              discord_user_id: interaction.user.id
            },
            startedAt: Date.now()
          };

          const hubPayload = buildApplicationHubMessage(session);
          await interaction.user.send(hubPayload);

          setActiveSession(interaction.user.id, session);

          return interaction.reply({
            content: `We have dispatched the ${roleName} application to your Direct Messages. Please check your DMs to begin.`,
            ephemeral: true
          });
        } catch (dmErr) {
          return interaction.reply({
            content: `Could not send you a Direct Message. Please enable Direct Messages from server members in your Discord Privacy Settings and try again.`,
            ephemeral: true
          });
        }
      }

      if (interaction.customId === 'ticket_category_select') {
        const selectedValue = interaction.values[0]; // e.g. ticket_cat_general
        const categoryId = selectedValue.replace('ticket_cat_', '');
        const category = CONFIG.CATEGORIES.find(c => c.id === categoryId);

        if (!category) {
          return interaction.reply({
            content: 'Invalid category selected.',
            ephemeral: true
          });
        }

        // Check Desk Status
        const deskData = loadDeskData();
        if (deskData.status === 'closed') {
          return interaction.reply({
            content: 'The Support Desk is currently closed. Please check back when staff are online.',
            ephemeral: true
          });
        }

        if (Array.isArray(deskData.disabledCategories) && deskData.disabledCategories.includes(categoryId)) {
          return interaction.reply({
            content: `${category.label} is currently closed by staff. Please choose another category.`,
            ephemeral: true
          });
        }

        // Check if user already has an open ticket
        const allTickets = loadTicketsData();
        const existingTicket = Object.values(allTickets.active || {}).find(t => t.authorId === interaction.user.id);
        if (existingTicket) {
          return interaction.reply({
            content: `You already have an open ticket in <#${existingTicket.channelId}>. Please resolve your current ticket before opening another.`,
            ephemeral: true
          });
        }

        // Present Modal for Ticket Reason without emojis
        const modal = new ModalBuilder()
          .setCustomId(`modal_open_${categoryId}`)
          .setTitle(`${category.label}`);

        const reasonInput = new TextInputBuilder()
          .setCustomId('ticket_reason')
          .setLabel('Reason for Opening / Summary of Inquiry')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Please describe what you need assistance with in detail...')
          .setMinLength(5)
          .setMaxLength(1000)
          .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
        return;
      }
    }

    /* ---------------------------------------------------------------------- */
    /* 3. MODAL SUBMISSIONS                                                   */
    /* ---------------------------------------------------------------------- */
    if (interaction.isModalSubmit()) {
      // Configuration Credentials Modal Submit (Page 1)
      if (interaction.customId.startsWith('cfg_modal_creds_')) {
        await interaction.deferUpdate().catch(() => null);
        const botId = interaction.customId.replace('cfg_modal_creds_', '');
        const token = interaction.fields.getTextInputValue('token').trim();
        const erlcApiKey = interaction.fields.getTextInputValue('erlcApiKey').trim();

        updateBotInstance(botId, { token, erlcApiKey, status: 'active', setupCompleted: true });

        startCustomerBot(botId).catch(err => {
          console.warn(`[CUSTOMER BOT] Error starting bot ${botId}:`, err.message);
        });

        const payload = buildConfigPanelPayload(botId, 1);
        return interaction.editReply(payload).catch(() => null);
      }

      // Configuration Server Core Modal Submit (Page 1)
      if (interaction.customId.startsWith('cfg_modal_servercore_')) {
        const botId = interaction.customId.replace('cfg_modal_servercore_', '');
        const getVal = id => interaction.fields.fields.get(id)?.value?.trim() || '';
        const serverName = getVal('serverName');
        const joinCode = getVal('joinCode');

        if (serverName) updateBotCustomization(botId, 'serverName', serverName);
        if (joinCode) updateBotCustomization(botId, 'joinCode', joinCode);

        const payload = buildConfigPanelPayload(botId, 1);
        try {
          return await interaction.update(payload);
        } catch (err) {
          return await interaction.editReply(payload).catch(() => null);
        }
      }

      // Configuration Ticket Category Names Modal Submit (Page 2)
      if (interaction.customId.startsWith('cfg_modal_ticketcatnames_')) {
        const botId = interaction.customId.replace('cfg_modal_ticketcatnames_', '');
        const bot = getBotInstance(botId);
        const cust = bot?.customizations || {};
        const currentCats = Array.isArray(cust.ticketCategories) ? [...cust.ticketCategories] : [];

        const newCats = [];
        for (let i = 1; i <= 5; i++) {
          const rawName = interaction.fields.fields.get(`cat_name_${i}`)?.value?.trim();
          if (rawName) {
            const existing = currentCats[i - 1] || {};
            newCats.push({
              id: existing.id || `cat_${i}`,
              name: rawName,
              spawnCategoryId: existing.spawnCategoryId || '',
              pingRoleId: existing.pingRoleId || ''
            });
          }
        }
        if (newCats.length > 0) {
          updateBotCustomization(botId, 'ticketCategories', newCats);
        }
        const payload = buildConfigPanelPayload(botId, 2);
        try {
          return await interaction.update(payload);
        } catch (err) {
          return await interaction.editReply(payload).catch(() => null);
        }
      }

      // Configuration Ticket Category Spawns Modal Submit (Page 2)
      if (interaction.customId.startsWith('cfg_modal_ticketcatspawns_')) {
        const botId = interaction.customId.replace('cfg_modal_ticketcatspawns_', '');
        const bot = getBotInstance(botId);
        const cust = bot?.customizations || {};
        const currentCats = Array.isArray(cust.ticketCategories) ? [...cust.ticketCategories] : [
          { id: "cat_1", name: "General Support", spawnCategoryId: "", pingRoleId: "" },
          { id: "cat_2", name: "High Rank", spawnCategoryId: "", pingRoleId: "" }
        ];

        for (let i = 1; i <= 5; i++) {
          const rawSpawn = interaction.fields.fields.get(`cat_spawn_${i}`)?.value?.trim();
          if (currentCats[i - 1]) {
            currentCats[i - 1].spawnCategoryId = rawSpawn || '';
          }
        }
        updateBotCustomization(botId, 'ticketCategories', currentCats);

        const payload = buildConfigPanelPayload(botId, 2);
        try {
          return await interaction.update(payload);
        } catch (err) {
          return await interaction.editReply(payload).catch(() => null);
        }
      }

      // Configuration Ticket Category Ping Roles Modal Submit (Page 2)
      if (interaction.customId.startsWith('cfg_modal_ticketcatpings_')) {
        const botId = interaction.customId.replace('cfg_modal_ticketcatpings_', '');
        const bot = getBotInstance(botId);
        const cust = bot?.customizations || {};
        const currentCats = Array.isArray(cust.ticketCategories) ? [...cust.ticketCategories] : [
          { id: "cat_1", name: "General Support", spawnCategoryId: "", pingRoleId: "" },
          { id: "cat_2", name: "High Rank", spawnCategoryId: "", pingRoleId: "" }
        ];

        for (let i = 1; i <= 5; i++) {
          const rawPing = interaction.fields.fields.get(`cat_ping_${i}`)?.value?.trim();
          if (currentCats[i - 1]) {
            currentCats[i - 1].pingRoleId = rawPing || '';
          }
        }
        updateBotCustomization(botId, 'ticketCategories', currentCats);

        const payload = buildConfigPanelPayload(botId, 2);
        try {
          return await interaction.update(payload);
        } catch (err) {
          return await interaction.editReply(payload).catch(() => null);
        }
      }

      // Configuration Ticket Banners & Settings Modal Submit (Page 2)
      if (interaction.customId.startsWith('cfg_modal_ticketbanners_')) {
        const botId = interaction.customId.replace('cfg_modal_ticketbanners_', '');
        const getVal = id => interaction.fields.fields.get(id)?.value?.trim() || '';
        const topBannerUrl = getVal('topBannerUrl');
        const bottomBannerUrl = getVal('bottomBannerUrl');
        const transcriptsChannelId = getVal('transcriptsChannelId');
        const ticketCategoryId = getVal('ticketCategoryId');
        const ticketPingRoleId = getVal('ticketPingRoleId');

        updateBotCustomization(botId, 'topBannerUrl', topBannerUrl);
        updateBotCustomization(botId, 'bottomBannerUrl', bottomBannerUrl);
        if (transcriptsChannelId) updateBotCustomization(botId, 'transcriptsChannelId', transcriptsChannelId);
        if (ticketCategoryId) updateBotCustomization(botId, 'ticketCategoryId', ticketCategoryId);
        if (ticketPingRoleId) updateBotCustomization(botId, 'ticketPingRoleId', ticketPingRoleId);

        const payload = buildConfigPanelPayload(botId, 2);
        try {
          return await interaction.update(payload);
        } catch (err) {
          return await interaction.editReply(payload).catch(() => null);
        }
      }

      // Configuration Support Text & Rules Modal Submit (Page 2)
      if (interaction.customId.startsWith('cfg_modal_text_')) {
        const botId = interaction.customId.replace('cfg_modal_text_', '');
        const getVal = id => interaction.fields.fields.get(id)?.value?.trim() || '';
        const panelTitle = getVal('panelTitle');
        const panelDescription = getVal('panelDescription');
        const ticketOpenMessage = getVal('ticketOpenMessage');
        const ticketInsideBannerUrl = getVal('ticketInsideBannerUrl');
        const rulesDescription = getVal('rulesDescription');

        if (panelTitle) updateBotCustomization(botId, 'panelTitle', panelTitle);
        if (panelDescription) updateBotCustomization(botId, 'panelDescription', panelDescription);
        if (ticketOpenMessage !== undefined) updateBotCustomization(botId, 'ticketOpenMessage', ticketOpenMessage);
        if (ticketInsideBannerUrl !== undefined) updateBotCustomization(botId, 'ticketInsideBannerUrl', ticketInsideBannerUrl);
        if (rulesDescription) updateBotCustomization(botId, 'rulesDescription', rulesDescription);

        const payload = buildConfigPanelPayload(botId, 2);
        try {
          return await interaction.update(payload);
        } catch (err) {
          return await interaction.editReply(payload).catch(() => null);
        }
      }

      // Configuration Session Channels & Roles Modal Submit (Page 3)
      if (interaction.customId.startsWith('cfg_modal_sessionchannels_')) {
        const botId = interaction.customId.replace('cfg_modal_sessionchannels_', '');
        const getVal = id => interaction.fields.fields.get(id)?.value?.trim() || '';
        const sessionChannelId = getVal('sessionChannelId');
        const ingameVcId = getVal('ingameVcId');
        const queueVcId = getVal('queueVcId');
        const notificationRoleId = getVal('notificationRoleId');
        const hostRoleId = getVal('hostRoleId');

        if (sessionChannelId) updateBotCustomization(botId, 'sessionChannelId', sessionChannelId);
        if (ingameVcId) updateBotCustomization(botId, 'ingameVcId', ingameVcId);
        if (queueVcId) updateBotCustomization(botId, 'queueVcId', queueVcId);
        if (notificationRoleId) updateBotCustomization(botId, 'notificationRoleId', notificationRoleId);
        if (hostRoleId) updateBotCustomization(botId, 'hostRoleId', hostRoleId);

        const payload = buildConfigPanelPayload(botId, 3);
        try {
          return await interaction.update(payload);
        } catch (err) {
          return await interaction.editReply(payload).catch(() => null);
        }
      }

      // Configuration Session Banners Modal Submit (Page 3)
      if (interaction.customId.startsWith('cfg_modal_sessionbanners_')) {
        const botId = interaction.customId.replace('cfg_modal_sessionbanners_', '');
        const getVal = id => interaction.fields.fields.get(id)?.value?.trim() || '';
        const sessionTopBannerUrl = getVal('sessionTopBannerUrl');
        const sessionShutdownBannerUrl = getVal('sessionShutdownBannerUrl');
        const sessionBottomBannerUrl = getVal('sessionBottomBannerUrl');

        updateBotCustomization(botId, 'sessionTopBannerUrl', sessionTopBannerUrl);
        updateBotCustomization(botId, 'sessionShutdownBannerUrl', sessionShutdownBannerUrl);
        updateBotCustomization(botId, 'sessionBottomBannerUrl', sessionBottomBannerUrl);

        const payload = buildConfigPanelPayload(botId, 3);
        try {
          return await interaction.update(payload);
        } catch (err) {
          return await interaction.editReply(payload).catch(() => null);
        }
      }

      // Configuration Session Embed Text Modal Submit (Page 3)
      if (interaction.customId.startsWith('cfg_modal_sessiontext_')) {
        const botId = interaction.customId.replace('cfg_modal_sessiontext_', '');
        const getVal = id => interaction.fields.fields.get(id)?.value?.trim() || '';
        const sessionStartTitle = getVal('sessionStartTitle');
        const sessionStartDesc = getVal('sessionStartDesc');
        const sessionShutdownTitle = getVal('sessionShutdownTitle');
        const sessionShutdownDesc = getVal('sessionShutdownDesc');

        if (sessionStartTitle) updateBotCustomization(botId, 'sessionStartTitle', sessionStartTitle);
        if (sessionStartDesc) updateBotCustomization(botId, 'sessionStartDesc', sessionStartDesc);
        if (sessionShutdownTitle) updateBotCustomization(botId, 'sessionShutdownTitle', sessionShutdownTitle);
        if (sessionShutdownDesc) updateBotCustomization(botId, 'sessionShutdownDesc', sessionShutdownDesc);

        const payload = buildConfigPanelPayload(botId, 3);
        try {
          return await interaction.update(payload);
        } catch (err) {
          return await interaction.editReply(payload).catch(() => null);
        }
      }

      // Configuration Infraction Modal Submit (Page 4)
      if (interaction.customId.startsWith('cfg_modal_infraction_')) {
        const botId = interaction.customId.replace('cfg_modal_infraction_', '');
        const getVal = id => interaction.fields.fields.get(id)?.value?.trim() || '';
        const infractionsChannelId = getVal('infractionsChannelId');
        const infractionStaffRoleId = getVal('infractionStaffRoleId');
        const infractBannerUrl = getVal('infractBannerUrl');
        const infractRemoveRoleId = getVal('infractRemoveRoleId');
        const infractGiveRoleId = getVal('infractGiveRoleId');

        if (infractionsChannelId !== undefined) updateBotCustomization(botId, 'infractionsChannelId', infractionsChannelId);
        if (infractionStaffRoleId !== undefined) updateBotCustomization(botId, 'infractionStaffRoleId', infractionStaffRoleId);
        if (infractBannerUrl) {
          updateBotCustomization(botId, 'infractBannerUrl', infractBannerUrl);
          updateBotCustomization(botId, 'infractionBannerUrl', infractBannerUrl);
        }
        if (infractRemoveRoleId !== undefined) updateBotCustomization(botId, 'infractRemoveRoleId', infractRemoveRoleId);
        if (infractGiveRoleId !== undefined) updateBotCustomization(botId, 'infractGiveRoleId', infractGiveRoleId);

        const payload = buildConfigPanelPayload(botId, 4);
        try {
          return await interaction.update(payload);
        } catch (err) {
          return await interaction.editReply(payload).catch(() => null);
        }
      }

      // Configuration Promotion Modal Submit (Page 4)
      if (interaction.customId.startsWith('cfg_modal_promotion_')) {
        const botId = interaction.customId.replace('cfg_modal_promotion_', '');
        const getVal = id => interaction.fields.fields.get(id)?.value?.trim() || '';
        const promotionsChannelId = getVal('promotionsChannelId');
        const promotionStaffRoleId = getVal('promotionStaffRoleId');
        const promoteBannerUrl = getVal('promoteBannerUrl');
        const promotionGiveRoleId = getVal('promotionGiveRoleId');

        if (promotionsChannelId !== undefined) updateBotCustomization(botId, 'promotionsChannelId', promotionsChannelId);
        if (promotionStaffRoleId !== undefined) updateBotCustomization(botId, 'promotionStaffRoleId', promotionStaffRoleId);
        if (promoteBannerUrl) {
          updateBotCustomization(botId, 'promoteBannerUrl', promoteBannerUrl);
          updateBotCustomization(botId, 'promotionBannerUrl', promoteBannerUrl);
        }
        if (promotionGiveRoleId !== undefined) updateBotCustomization(botId, 'promotionGiveRoleId', promotionGiveRoleId);

        const payload = buildConfigPanelPayload(botId, 4);
        try {
          return await interaction.update(payload);
        } catch (err) {
          return await interaction.editReply(payload).catch(() => null);
        }
      }

      // Configuration Applications Channels & Text Modal Submit (Page 5)
      if (interaction.customId.startsWith('cfg_modal_apps_')) {
        const botId = interaction.customId.replace('cfg_modal_apps_', '');
        const getVal = id => interaction.fields.fields.get(id)?.value?.trim() || '';
        const reviewChannelId = getVal('reviewChannelId');
        const resultsChannelId = getVal('resultsChannelId');
        const appTitle = getVal('appTitle');
        const appDescription = getVal('appDescription');

        if (reviewChannelId) updateBotCustomization(botId, 'reviewChannelId', reviewChannelId);
        if (resultsChannelId) updateBotCustomization(botId, 'resultsChannelId', resultsChannelId);
        if (appTitle) updateBotCustomization(botId, 'appTitle', appTitle);
        if (appDescription) updateBotCustomization(botId, 'appDescription', appDescription);

        const payload = buildConfigPanelPayload(botId, 5);
        try {
          return await interaction.update(payload);
        } catch (err) {
          return await interaction.editReply(payload).catch(() => null);
        }
      }

      // Configuration Application Banners & Quiz Modal Submit (Page 5)
      if (interaction.customId.startsWith('cfg_modal_appquiz_')) {
        const botId = interaction.customId.replace('cfg_modal_appquiz_', '');
        const getVal = id => interaction.fields.fields.get(id)?.value?.trim() || '';
        const appTopBannerUrl = getVal('appTopBannerUrl');
        const appBottomBannerUrl = getVal('appBottomBannerUrl');
        const appQuizIntroText = getVal('appQuizIntroText');

        if (appTopBannerUrl) updateBotCustomization(botId, 'appTopBannerUrl', appTopBannerUrl);
        if (appBottomBannerUrl) updateBotCustomization(botId, 'appBottomBannerUrl', appBottomBannerUrl);
        if (appQuizIntroText) updateBotCustomization(botId, 'appQuizIntroText', appQuizIntroText);

        const payload = buildConfigPanelPayload(botId, 5);
        try {
          return await interaction.update(payload);
        } catch (err) {
          return await interaction.editReply(payload).catch(() => null);
        }
      }

      // Configuration Server Documentation Modal Submit (Page 6)
      if (interaction.customId.startsWith('cfg_modal_docs_')) {
        const botId = interaction.customId.replace('cfg_modal_docs_', '');
        const getVal = id => interaction.fields.fields.get(id)?.value?.trim() || '';
        const deptChannelId = getVal('deptChannelId');
        const deptBannerUrl = getVal('deptBannerUrl');
        const regulationsChannelId = getVal('regulationsChannelId');
        const regulationsBannerUrl = getVal('regulationsBannerUrl');
        const staffDocsChannelId = getVal('staffDocsChannelId');

        if (deptChannelId) updateBotCustomization(botId, 'deptChannelId', deptChannelId);
        if (deptBannerUrl) updateBotCustomization(botId, 'deptBannerUrl', deptBannerUrl);
        if (regulationsChannelId) updateBotCustomization(botId, 'regulationsChannelId', regulationsChannelId);
        if (regulationsBannerUrl) updateBotCustomization(botId, 'regulationsBannerUrl', regulationsBannerUrl);
        if (staffDocsChannelId) updateBotCustomization(botId, 'staffDocsChannelId', staffDocsChannelId);

        const payload = buildConfigPanelPayload(botId, 6);
        try {
          return await interaction.update(payload);
        } catch (err) {
          return await interaction.editReply(payload).catch(() => null);
        }
      }

      // Configuration Welcome Modal Submit (Page 7)
      if (interaction.customId.startsWith('cfg_modal_welcome_')) {
        const botId = interaction.customId.replace('cfg_modal_welcome_', '');
        const getVal = id => interaction.fields.fields.get(id)?.value?.trim() || '';
        const welcomeChannelId = getVal('welcomeChannelId');
        const welcomeBannerUrl = getVal('welcomeBannerUrl');
        const welcomeText = getVal('welcomeText');

        if (welcomeChannelId) updateBotCustomization(botId, 'welcomeChannelId', welcomeChannelId);
        if (welcomeBannerUrl) updateBotCustomization(botId, 'welcomeBannerUrl', welcomeBannerUrl);
        if (welcomeText) updateBotCustomization(botId, 'welcomeText', welcomeText);

        const payload = buildConfigPanelPayload(botId, 7);
        try {
          return await interaction.update(payload);
        } catch (err) {
          return await interaction.editReply(payload).catch(() => null);
        }
      }

      // Configuration AI Key Modal Submit (Page 8)
      if (interaction.customId.startsWith('cfg_modal_aikey_')) {
        const botId = interaction.customId.replace('cfg_modal_aikey_', '');
        const getVal = id => interaction.fields.fields.get(id)?.value?.trim() || '';
        const aiApiKey = getVal('aiApiKey');
        let aiProvider = getVal('aiProvider').toLowerCase();

        if (!aiProvider && aiApiKey) {
          aiProvider = aiApiKey.startsWith('sk-or-') ? 'openrouter' : (aiApiKey.startsWith('gsk_') ? 'groq' : (aiApiKey.startsWith('AIza') ? 'gemini' : 'openai'));
        }

        updateBotInstance(botId, { aiProvider: aiProvider || 'openrouter', aiApiKey });
        updateBotCustomization(botId, 'aiProvider', aiProvider || 'openrouter');
        updateBotCustomization(botId, 'aiApiKey', aiApiKey);

        const payload = buildConfigPanelPayload(botId, 8);
        try {
          return await interaction.update(payload);
        } catch (err) {
          console.error('[CONFIG MODAL AI KEY ERROR]:', err);
          return await interaction.editReply(payload).catch(() => null);
        }
      }

      // Configuration Ask AI Modal Submit
      if (interaction.customId.startsWith('cfg_modal_askai_')) {
        const botId = interaction.customId.replace('cfg_modal_askai_', '');
        const prompt = interaction.fields.getTextInputValue('prompt').trim();

        await interaction.deferReply({ flags: 64 }).catch(() => null);

        const result = await processAiConfigRequest({
          botId,
          prompt,
          userId: interaction.user.id
        });

        if (result.success) {
          let replyContent = `### AI Configuration Assistant\n> ${result.reply.split('\n').join('\n> ')}`;
          if (result.changes && result.changes.length > 0) {
            replyContent += `\n\n### Applied Changes\n` + result.changes.map(c => `> • **${c.field}**: \`${c.value}\``).join('\n');
          }
          return interaction.editReply({
            content: replyContent
          }).catch(err => console.error('[ASK AI REPLY ERROR]:', err));
        } else {
          return interaction.editReply({
            content: `<:Cross:1396397536478105672> **Configuration Error:** ${result.message}`
          }).catch(err => console.error('[ASK AI ERROR REPLY]:', err));
        }
      }


      // LOA Denial Reason Modal Submit
      if (interaction.customId.startsWith('modal_loa_deny_')) {
        const loaId = interaction.customId.replace('modal_loa_deny_', '');
        const notes = interaction.fields.getTextInputValue('deny_reason');

        const store = loadLoaRecords();
        const record = store.pending?.[loaId] || store.active?.[loaId];
        if (!record) {
          return interaction.reply({
            content: 'LOA record not found or already processed.',
            ephemeral: true
          });
        }

        record.status = 'denied';
        record.reviewedBy = interaction.user.id;
        record.reviewedAt = Date.now();
        record.notes = notes;

        if (!store.history) store.history = {};
        store.history[loaId] = record;
        if (store.pending) delete store.pending[loaId];
        saveLoaRecords(store);

        // Update the submission message in review channel
        if (record.reviewMessageId) {
          try {
            const ch = await interaction.client.channels.fetch(record.reviewChannelId || '1548336007311527996').catch(() => null);
            if (ch) {
              const msg = await ch.messages.fetch(record.reviewMessageId).catch(() => null);
              if (msg) {
                const updatedCard = buildLoaSubmissionCard(record);
                await msg.edit(updatedCard).catch(() => null);
              }
            }
          } catch (e) {}
        }

        // Send Denied DM to applicant
        try {
          const applicant = await client.users.fetch(record.userId).catch(() => null);
          if (applicant) {
            const dmPayload = buildLoaStatusDm({ record, status: 'denied', notes });
            await applicant.send(dmPayload).catch(() => null);
          }
        } catch (dmErr) {
          console.warn('[LOA] Could not DM applicant:', dmErr.message);
        }

        return interaction.reply({
          content: `Leave of Absence request has been **DENIED** and applicant has been notified via Direct Message.`,
          ephemeral: true
        });
      }

      // Handle Ticket Opening Modal
      if (interaction.customId.startsWith('modal_open_')) {
        const categoryId = interaction.customId.replace('modal_open_', '');
        const botInst = getBotForInteraction(interaction);
        const cust = botInst?.customizations || DEFAULT_CUSTOMIZATIONS;
        const configuredCats = Array.isArray(cust?.ticketCategories) ? cust.ticketCategories : [];
        const customCat = configuredCats.find(c => c.id === categoryId);
        const fallbackCat = CONFIG.CATEGORIES.find(c => c.id === categoryId);

        const category = customCat ? {
          id: customCat.id,
          label: customCat.name,
          categoryId: customCat.spawnCategoryId || cust.ticketCategoryId || null,
          pingRoleId: customCat.pingRoleId || cust.ticketPingRoleId || null
        } : (fallbackCat || {
          id: categoryId,
          label: 'Support',
          categoryId: cust.ticketCategoryId || null,
          pingRoleId: cust.ticketPingRoleId || null
        });

        const reason = interaction.fields.getTextInputValue('ticket_reason');

        await interaction.deferReply({ ephemeral: true });

        const cleanUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
        const channelName = `ticket-${cleanUsername || 'inquiry'}`;

        // Build channel permission overwrites safely using interaction.client.user.id
        const botUserId = (interaction.client || client).user.id;
        const permissionOverwrites = [
          {
            id: interaction.guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          },
          {
            id: botUserId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ManageMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          }
        ];

        // Add staff and category ping roles to overwrites
        const addedRoles = new Set();

        // 1. Specific category ping role (e.g. High Rank, General Support)
        if (category.pingRoleId && interaction.guild.roles.cache.has(category.pingRoleId)) {
          permissionOverwrites.push({
            id: category.pingRoleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          });
          addedRoles.add(category.pingRoleId);
        }

        // 2. Fallback ticket ping role from bot configuration
        if (cust.ticketPingRoleId && interaction.guild.roles.cache.has(cust.ticketPingRoleId) && !addedRoles.has(cust.ticketPingRoleId)) {
          permissionOverwrites.push({
            id: cust.ticketPingRoleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          });
          addedRoles.add(cust.ticketPingRoleId);
        }

        // 3. Fallback standard staff roles (only if present in the current guild)
        for (const roleId of CONFIG.STAFF_ROLE_IDS) {
          if (roleId && !roleId.includes('PASTE') && interaction.guild.roles.cache.has(roleId) && !addedRoles.has(roleId)) {
            permissionOverwrites.push({
              id: roleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks
              ]
            });
            addedRoles.add(roleId);
          }
        }

        // Determine parent category folder ID (from dynamic category spawn or bot fallback)
        let parentCategoryId = null;
        const candidateCategoryIds = [
          customCat?.spawnCategoryId,
          category?.categoryId,
          cust?.ticketCategoryId
        ].filter(Boolean);

        for (const catId of candidateCategoryIds) {
          const cleanId = String(catId).trim();
          if (cleanId) {
            const ch = interaction.guild.channels.cache.get(cleanId) || 
                       await interaction.guild.channels.fetch(cleanId).catch(() => null);
            if (ch) {
              parentCategoryId = ch.id;
              break;
            }
          }
        }

        const ticketChannel = await interaction.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: parentCategoryId,
          permissionOverwrites: permissionOverwrites,
          topic: `Author: ${interaction.user.tag} (${interaction.user.id}) | Category: ${category.label}`
        });

        const ticketData = {
          channelId: ticketChannel.id,
          channelName: ticketChannel.name,
          authorId: interaction.user.id,
          authorTag: interaction.user.tag,
          category: category.id,
          categoryLabel: category.label,
          reason: reason,
          claimedBy: null,
          claimedTag: null,
          createdAt: Date.now()
        };

        // Ping the user and valid staff roles
        const staffPings = Array.from(addedRoles).map(r => `<@&${r}>`).join(' ');
        const pingMessage = `<@${interaction.user.id}> ${staffPings}`.trim();
        await ticketChannel.send({ content: pingMessage });

        // Send in-ticket control panel with bot customizations
        const controlPayload = buildTicketControl(ticketData, cust);
        const controlMessage = await ticketChannel.send(controlPayload);

        ticketData.controlMessageId = controlMessage.id;
        saveActiveTicket(ticketChannel.id, ticketData);

        // Pin the embed inside the ticket channel
        try {
          await controlMessage.pin();
          // Small delay to let Discord generate the system pin notice
          await new Promise(r => setTimeout(r, 600));
          // Remove the system "pinned a message" notice to keep channel clean
          const recentMsgs = await ticketChannel.messages.fetch({ limit: 6 }).catch(() => null);
          if (recentMsgs) {
            const pinNotice = recentMsgs.find(m => m.system || m.type === 6);
            if (pinNotice) await pinNotice.delete().catch(() => null);
          }
        } catch (pinErr) {
          console.warn('Could not pin ticket control embed:', pinErr.message);
        }

        return interaction.editReply({
          content: `Your ticket has been created: <#${ticketChannel.id}>`
        });
      }

      // Handle Close Ticket Modal (Staff only, required reason)
      if (interaction.customId === 'modal_close_ticket') {
        if (!isStaff(interaction.member, interaction)) {
          return interaction.reply({
            content: 'Only staff members can close support tickets.',
            ephemeral: true
          });
        }

        const closeReason = interaction.fields.getTextInputValue('close_reason');

        await interaction.reply({
          content: `> Ticket closure initiated by <@${interaction.user.id}>.\n> **Reason:** ${closeReason}`
        });

        await closeTicketWorkflow(interaction.channel, interaction.user, closeReason);
        return;
      }

      // Handle Staff Report Modal (Management tickets)
      if (interaction.customId === 'modal_report_staff') {
        const targetStaff = interaction.fields.getTextInputValue('reported_staff_target');
        const reportReason = interaction.fields.getTextInputValue('reported_staff_reason');

        const reportEmbed = new EmbedBuilder()
          .setTitle('Staff Report Filed')
          .setDescription(
            `> A staff report has been filed by <@${interaction.user.id}>.\n` +
            `> Management has been notified and will review this report privately.`
          )
          .addFields(
            {
              name: 'Reporting User',
              value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`,
              inline: true
            },
            {
              name: 'Reported Staff Member',
              value: `\`${targetStaff}\``,
              inline: true
            },
            {
              name: 'Report Reason & Evidence Details',
              value: `\`\`\`\n${reportReason}\n\`\`\``,
              inline: false
            }
          )
          .setFooter({
            text: 'ERLCX Management Desk • Official Report'
          })
          .setTimestamp();

        await interaction.reply({
          content: 'Your staff report has been officially recorded and posted in this ticket channel.',
          ephemeral: true
        });

        await interaction.channel.send({
          embeds: [reportEmbed]
        });
        return;
      }

      // Handle Edit Reason Modal (from transcript log button)
      if (interaction.customId.startsWith('modal_edit_reason_')) {
        const channelId = interaction.customId.replace('modal_edit_reason_', '');
        const newReason = interaction.fields.getTextInputValue('new_reason');

        const updatedRecord = updateArchivedReason(channelId, newReason);
        if (!updatedRecord) {
          return interaction.reply({
            content: 'Could not find the archived ticket record in history.',
            ephemeral: true
          });
        }

        // Update the log message in the transcripts channel if it exists
        if (CONFIG.TRANSCRIPTS_CHANNEL_ID && updatedRecord.logMessageId) {
          try {
            const logChannel = await interaction.client.channels.fetch(CONFIG.TRANSCRIPTS_CHANNEL_ID).catch(() => null);
            if (logChannel) {
              const logMsg = await logChannel.messages.fetch(updatedRecord.logMessageId).catch(() => null);
              if (logMsg) {
                const existingOpenBtn = logMsg.components?.[0]?.components?.find(c => c.label === 'Open Transcript');
                const existingTranscriptUrl = existingOpenBtn?.url || logMsg.attachments.first()?.url || null;
                const existingBanner = logMsg.embeds?.[0]?.image?.url || CONFIG.BOTTOM_BANNER_URL;

                const refreshedPayload = buildTranscriptLogEmbed({
                  channelName: updatedRecord.channelName || 'ticket',
                  channelId: updatedRecord.channelId,
                  authorId: updatedRecord.authorId,
                  authorTag: updatedRecord.authorTag,
                  closedById: updatedRecord.closedById,
                  claimedById: updatedRecord.claimedBy,
                  openDuration: updatedRecord.duration || 'N/A',
                  closeReason: newReason,
                  transcriptUrl: existingTranscriptUrl,
                  bannerImage: existingBanner
                });
                await logMsg.edit({ embeds: refreshedPayload.embeds, components: refreshedPayload.components });
              }
            }
          } catch (e) {
            console.warn(`Could not edit transcript log message:`, e.message);
          }
        }

        return interaction.reply({
          content: `Close reason for ticket #${updatedRecord.channelName || channelId} updated successfully to:\n>>> ${newReason}`,
          ephemeral: true
        });
      }

      // Module 1 Modal Submit (Rules & Requirements)
      if (interaction.customId === 'modal_app_mod_1') {
        const session = getActiveSession(interaction.user.id);
        if (!session) {
          return interaction.reply({ content: 'No active application session found.', ephemeral: true });
        }
        for (const [key, value] of interaction.fields.fields) {
          session.answers[key] = value.value?.trim() || '';
        }
        session.modules.mod1 = true;
        setActiveSession(interaction.user.id, session);
        const hubPayload = buildApplicationHubMessage(session);
        try {
          await interaction.update(hubPayload);
        } catch {
          if (interaction.message) await interaction.message.edit(hubPayload).catch(() => null);
        }
        return;
      }

      // Module 2 Modal Submit (General Information)
      if (interaction.customId === 'modal_app_mod_2') {
        const session = getActiveSession(interaction.user.id);
        if (!session) {
          return interaction.reply({ content: 'No active application session found.', ephemeral: true });
        }
        for (const [key, value] of interaction.fields.fields) {
          session.answers[key] = value.value?.trim() || '';
        }
        session.modules.mod2 = true;
        setActiveSession(interaction.user.id, session);
        const hubPayload = buildApplicationHubMessage(session);
        try {
          await interaction.update(hubPayload);
        } catch {
          if (interaction.message) await interaction.message.edit(hubPayload).catch(() => null);
        }
        return;
      }

      // Module 3 Modal Submit (Core Knowledge)
      if (interaction.customId === 'modal_app_mod_3') {
        const session = getActiveSession(interaction.user.id);
        if (!session) {
          return interaction.reply({ content: 'No active application session found.', ephemeral: true });
        }
        for (const [key, value] of interaction.fields.fields) {
          session.answers[key] = value.value?.trim() || '';
        }
        session.modules.mod3 = true;
        setActiveSession(interaction.user.id, session);
        const hubPayload = buildApplicationHubMessage(session);
        try {
          await interaction.update(hubPayload);
        } catch {
          if (interaction.message) await interaction.message.edit(hubPayload).catch(() => null);
        }
        return;
      }

      // Module 4 Modal Submit (Realistic Scenarios)
      if (interaction.customId === 'modal_app_mod_4') {
        const session = getActiveSession(interaction.user.id);
        if (!session) {
          return interaction.reply({ content: 'No active application session found.', ephemeral: true });
        }
        for (const [key, value] of interaction.fields.fields) {
          session.answers[key] = value.value?.trim() || '';
        }
        session.modules.mod4 = true;
        setActiveSession(interaction.user.id, session);
        const hubPayload = buildApplicationHubMessage(session);
        try {
          await interaction.update(hubPayload);
        } catch {
          if (interaction.message) await interaction.message.edit(hubPayload).catch(() => null);
        }
        return;
      }

      // Staff Application Review: Approve Modal
      if (interaction.customId.startsWith('modal_app_approve_')) {
        const subId = interaction.customId.replace('modal_app_approve_', '');
        const notes = interaction.fields.getTextInputValue('app_notes')?.trim() || null;
        const submission = getSubmission(subId);

        if (!submission) {
          return interaction.reply({ content: 'Application submission not found.', ephemeral: true });
        }

        updateSubmission(subId, {
          status: 'approved',
          reviewedBy: interaction.user.id,
          reviewedAt: Date.now(),
          notes
        });

        const updatedSubmission = getSubmission(subId);
        const reviewPayload = buildStaffReviewCard(updatedSubmission, 0);
        await interaction.update(reviewPayload);

        // Post public acceptance announcement to results channel (1550413729013829725)
        try {
          const resultsChanId = getResultsChannelId();
          const resultsChan = await interaction.client.channels.fetch(resultsChanId).catch(() => null);
          if (resultsChan && resultsChan.isTextBased()) {
            const resultPayload = buildApplicationResultV2(updatedSubmission);
            try {
              await resultsChan.send(resultPayload);
            } catch (v2Err) {
              console.warn('[Applications] Components V2 failed for results channel, using fallback embed:', v2Err.message);
              const fallbackPayload = buildApplicationResultFallback(updatedSubmission);
              await resultsChan.send(fallbackPayload);
            }
          } else {
            console.warn(`[Applications] Results channel ${resultsChanId} not found or not text-based.`);
          }
        } catch (resErr) {
          console.error('[Applications] Could not post acceptance announcement to results channel:', resErr);
        }

        // Notify applicant via clean, professional Components V2 DM
        try {
          const applicantUser = await client.users.fetch(submission.userId).catch(() => null);
          if (applicantUser) {
            const dmPayload = buildApplicationStatusDmV2({
              status: 'approved',
              role: submission.role,
              notes,
              userId: submission.userId,
              reviewedBy: interaction.user.id
            });
            await applicantUser.send(dmPayload).catch(() => null);
          }
        } catch (dmErr) {
          console.warn('Could not DM applicant on approval:', dmErr.message);
        }
        return;
      }

      // Staff Application Review: Deny Modal
      if (interaction.customId.startsWith('modal_app_deny_')) {
        const subId = interaction.customId.replace('modal_app_deny_', '');
        const notes = interaction.fields.getTextInputValue('app_notes')?.trim() || null;
        const submission = getSubmission(subId);

        if (!submission) {
          return interaction.reply({ content: 'Application submission not found.', ephemeral: true });
        }

        updateSubmission(subId, {
          status: 'denied',
          reviewedBy: interaction.user.id,
          reviewedAt: Date.now(),
          notes
        });

        const updatedSubmission = getSubmission(subId);
        const reviewPayload = buildStaffReviewCard(updatedSubmission, 0);
        await interaction.update(reviewPayload);

        // Post public denial announcement to results channel (1550413729013829725)
        try {
          const resultsChanId = getResultsChannelId();
          const resultsChan = await interaction.client.channels.fetch(resultsChanId).catch(() => null);
          if (resultsChan && resultsChan.isTextBased()) {
            const resultPayload = buildApplicationResultV2(updatedSubmission);
            try {
              await resultsChan.send(resultPayload);
            } catch (v2Err) {
              console.warn('[Applications] Components V2 failed for results channel, using fallback embed:', v2Err.message);
              const fallbackPayload = buildApplicationResultFallback(updatedSubmission);
              await resultsChan.send(fallbackPayload);
            }
          } else {
            console.warn(`[Applications] Results channel ${resultsChanId} not found or not text-based.`);
          }
        } catch (resErr) {
          console.error('[Applications] Could not post denial announcement to results channel:', resErr);
        }

        // Notify applicant via clean, professional Components V2 DM
        try {
          const applicantUser = await client.users.fetch(submission.userId).catch(() => null);
          if (applicantUser) {
            const dmPayload = buildApplicationStatusDmV2({
              status: 'denied',
              role: submission.role,
              notes,
              userId: submission.userId,
              reviewedBy: interaction.user.id
            });
            await applicantUser.send(dmPayload).catch(() => null);
          }
        } catch (dmErr) {
          console.warn('Could not DM applicant on denial:', dmErr.message);
        }
        return;
      }
    }

    /* ---------------------------------------------------------------------- */
    /* 4. BUTTON INTERACTIONS                                                 */
    /* ---------------------------------------------------------------------- */
    if (interaction.isButton()) {
      // Config Navigation Buttons
      if (interaction.customId.startsWith('cfg_nav_prev_')) {
        const parts = interaction.customId.replace('cfg_nav_prev_', '').split('_');
        const botId = parts[0];
        const curPage = parseInt(parts[1], 10) || 1;
        const targetPage = Math.max(1, curPage - 1);
        const payload = buildConfigPanelPayload(botId, targetPage);
        try {
          return await interaction.update(payload);
        } catch (err) {
          console.error('[CONFIG NAV PREV ERROR]:', err);
          return await interaction.editReply(payload).catch(() => null);
        }
      }

      if (interaction.customId.startsWith('cfg_nav_next_')) {
        const parts = interaction.customId.replace('cfg_nav_next_', '').split('_');
        const botId = parts[0];
        const curPage = parseInt(parts[1], 10) || 1;
        const targetPage = Math.min(TOTAL_PAGES, curPage + 1);
        const payload = buildConfigPanelPayload(botId, targetPage);
        try {
          return await interaction.update(payload);
        } catch (err) {
          console.error('[CONFIG NAV NEXT ERROR]:', err);
          return await interaction.editReply(payload).catch(() => null);
        }
      }

      if (interaction.customId.startsWith('cfg_nav_refresh_')) {
        const parts = interaction.customId.replace('cfg_nav_refresh_', '').split('_');
        const botId = parts[0];
        const curPage = parseInt(parts[1], 10) || 1;
        const payload = buildConfigPanelPayload(botId, curPage);
        try {
          return await interaction.update(payload);
        } catch (err) {
          console.error('[CONFIG NAV REFRESH ERROR]:', err);
          return await interaction.editReply(payload).catch(() => null);
        }
      }

      if (interaction.customId.startsWith('cfg_btn_resetbanners_')) {
        const botId = interaction.customId.replace('cfg_btn_resetbanners_', '');
        updateBotCustomization(botId, 'topBannerUrl', null);
        updateBotCustomization(botId, 'bottomBannerUrl', null);
        updateBotCustomization(botId, 'sessionTopBannerUrl', null);
        updateBotCustomization(botId, 'sessionShutdownBannerUrl', null);
        updateBotCustomization(botId, 'sessionBottomBannerUrl', null);
        const payload = buildConfigPanelPayload(botId, 3);
        try {
          return await interaction.update(payload);
        } catch (err) {
          console.error('[RESET BANNERS ERROR]:', err);
          return await interaction.editReply(payload).catch(() => null);
        }
      }

      // ─── CONFIGURATION MODAL OPENERS (8 DOMAIN PAGES) ─────────────────
      // Page 1: Credentials & Server Core Identity
      if (interaction.customId.startsWith('cfg_btn_creds_')) {
        const botId = interaction.customId.replace('cfg_btn_creds_', '');
        return interaction.showModal(buildCredentialsModal(botId)).catch(err => {
          console.warn(`[CONFIG MODAL] showModal error (creds):`, err.message);
        });
      }

      if (interaction.customId.startsWith('cfg_btn_servercore_') || interaction.customId.startsWith('cfg_btn_joincode_')) {
        const botId = interaction.customId.replace('cfg_btn_servercore_', '').replace('cfg_btn_joincode_', '');
        return interaction.showModal(buildServerCoreModal(botId)).catch(err => {
          console.warn(`[CONFIG MODAL] showModal error (servercore):`, err.message);
        });
      }

      // Page 2: Ticket Categories (Names, Spawns, Pings), Banners & Text
      if (interaction.customId.startsWith('cfg_btn_ticketcatnames_')) {
        const botId = interaction.customId.replace('cfg_btn_ticketcatnames_', '');
        return interaction.showModal(buildTicketCategoryNamesModal(botId)).catch(err => {
          console.warn(`[CONFIG MODAL] showModal error (ticketcatnames):`, err.message);
        });
      }

      if (interaction.customId.startsWith('cfg_btn_ticketcatspawns_')) {
        const botId = interaction.customId.replace('cfg_btn_ticketcatspawns_', '');
        return interaction.showModal(buildTicketCategorySpawnsModal(botId)).catch(err => {
          console.warn(`[CONFIG MODAL] showModal error (ticketcatspawns):`, err.message);
        });
      }

      if (interaction.customId.startsWith('cfg_btn_ticketcatpings_')) {
        const botId = interaction.customId.replace('cfg_btn_ticketcatpings_', '');
        return interaction.showModal(buildTicketCategoryPingsModal(botId)).catch(err => {
          console.warn(`[CONFIG MODAL] showModal error (ticketcatpings):`, err.message);
        });
      }

      if (interaction.customId.startsWith('cfg_btn_ticketbanners_')) {
        const botId = interaction.customId.replace('cfg_btn_ticketbanners_', '');
        return interaction.showModal(buildTicketBannersModal(botId)).catch(err => {
          console.warn(`[CONFIG MODAL] showModal error (ticketbanners):`, err.message);
        });
      }

      if (interaction.customId.startsWith('cfg_btn_text_')) {
        const botId = interaction.customId.replace('cfg_btn_text_', '');
        return interaction.showModal(buildSupportTextModal(botId)).catch(err => {
          console.warn(`[CONFIG MODAL] showModal error (text):`, err.message);
        });
      }

      // Page 3: Live Operations & Sessions
      if (interaction.customId.startsWith('cfg_btn_sessionchannels_')) {
        const botId = interaction.customId.replace('cfg_btn_sessionchannels_', '');
        return interaction.showModal(buildSessionChannelsModal(botId)).catch(err => {
          console.warn(`[CONFIG MODAL] showModal error (sessionchannels):`, err.message);
        });
      }

      if (interaction.customId.startsWith('cfg_btn_sessionbanners_')) {
        const botId = interaction.customId.replace('cfg_btn_sessionbanners_', '');
        return interaction.showModal(buildSessionBannersModal(botId)).catch(err => {
          console.warn(`[CONFIG MODAL] showModal error (sessionbanners):`, err.message);
        });
      }

      if (interaction.customId.startsWith('cfg_btn_sessiontext_') || interaction.customId.startsWith('cfg_btn_session_')) {
        const botId = interaction.customId.replace('cfg_btn_sessiontext_', '').replace('cfg_btn_session_', '');
        return interaction.showModal(buildSessionTextModal(botId)).catch(err => {
          console.warn(`[CONFIG MODAL] showModal error (sessiontext):`, err.message);
        });
      }

      // Page 4: Moderation System (Infractions & Promotions)
      if (interaction.customId.startsWith('cfg_btn_infractioncfg_')) {
        const botId = interaction.customId.replace('cfg_btn_infractioncfg_', '');
        return interaction.showModal(buildInfractionConfigModal(botId)).catch(err => {
          console.warn(`[CONFIG MODAL] showModal error (infractioncfg):`, err.message);
        });
      }

      if (interaction.customId.startsWith('cfg_btn_promotioncfg_')) {
        const botId = interaction.customId.replace('cfg_btn_promotioncfg_', '');
        return interaction.showModal(buildPromotionConfigModal(botId)).catch(err => {
          console.warn(`[CONFIG MODAL] showModal error (promotioncfg):`, err.message);
        });
      }

      // Page 5: Staff Applications & In-Game Quiz
      if (interaction.customId.startsWith('cfg_btn_apps_')) {
        const botId = interaction.customId.replace('cfg_btn_apps_', '');
        return interaction.showModal(buildAppsModal(botId)).catch(err => {
          console.warn(`[CONFIG MODAL] showModal error (apps):`, err.message);
        });
      }

      if (interaction.customId.startsWith('cfg_btn_appquizcfg_') || interaction.customId.startsWith('cfg_btn_apptext_')) {
        const botId = interaction.customId.replace('cfg_btn_appquizcfg_', '').replace('cfg_btn_apptext_', '');
        return interaction.showModal(buildAppQuizModal(botId)).catch(err => {
          console.warn(`[CONFIG MODAL] showModal error (appquizcfg):`, err.message);
        });
      }

      // Page 6: Server Documentation & Policies
      if (interaction.customId.startsWith('cfg_btn_docs_')) {
        const botId = interaction.customId.replace('cfg_btn_docs_', '');
        return interaction.showModal(buildDocsModal(botId)).catch(err => {
          console.warn(`[CONFIG MODAL] showModal error (docs):`, err.message);
        });
      }

      // Page 7: Welcome System
      if (interaction.customId.startsWith('cfg_btn_togglewelcome_')) {
        const botId = interaction.customId.replace('cfg_btn_togglewelcome_', '');
        const bot = getBotInstance(botId);
        const curStatus = Boolean(bot?.customizations?.welcomeEnabled);
        updateBotCustomization(botId, 'welcomeEnabled', !curStatus);
        const payload = buildConfigPanelPayload(botId, 7);
        try {
          return await interaction.update(payload);
        } catch (err) {
          return await interaction.editReply(payload).catch(() => null);
        }
      }

      if (interaction.customId.startsWith('cfg_btn_welcome_')) {
        const botId = interaction.customId.replace('cfg_btn_welcome_', '');
        return interaction.showModal(buildWelcomeModal(botId)).catch(err => {
          console.warn(`[CONFIG MODAL] showModal error (welcome):`, err.message);
        });
      }

      // Page 8: AI Configuration Assistant
      if (interaction.customId.startsWith('cfg_btn_aikey_')) {
        const botId = interaction.customId.replace('cfg_btn_aikey_', '');
        return interaction.showModal(buildAiKeyModal(botId)).catch(err => {
          console.warn(`[CONFIG MODAL] showModal error (aikey):`, err.message);
        });
      }

      if (interaction.customId.startsWith('cfg_btn_askai_') || interaction.customId.startsWith('cfg_btn_ai_modal_')) {
        const botId = interaction.customId.replace('cfg_btn_askai_', '').replace('cfg_btn_ai_modal_', '');
        return interaction.showModal(buildAskAiModal(botId)).catch(err => {
          console.warn(`[CONFIG MODAL] showModal error (askai):`, err.message);
        });
      }

      // LOA Review Accept Button
      if (interaction.customId.startsWith('loa_btn_accept_')) {
        if (!isStaff(interaction.member, interaction)) {
          return interaction.reply({
            content: 'You do not have permission to review Leave of Absence requests.',
            ephemeral: true
          });
        }
        const loaId = interaction.customId.replace('loa_btn_accept_', '');
        const store = loadLoaRecords();
        const record = store.pending?.[loaId] || store.active?.[loaId];
        if (!record) {
          return interaction.reply({
            content: 'LOA record not found or already processed.',
            ephemeral: true
          });
        }
        if (record.status !== 'pending') {
          return interaction.reply({
            content: `This LOA request has already been ${record.status}.`,
            ephemeral: true
          });
        }

        record.status = 'approved';
        record.reviewedBy = interaction.user.id;
        record.reviewedAt = Date.now();

        // Move to active
        if (!store.active) store.active = {};
        store.active[loaId] = record;
        if (store.pending) delete store.pending[loaId];
        saveLoaRecords(store);

        // Update nickname: change to 𝖫𝖮𝖠 | @his name stays
        try {
          const guild = interaction.guild;
          const member = await guild.members.fetch(record.userId).catch(() => null);
          if (member) {
            const currentName = member.nickname || member.user.displayName || member.user.username;
            const strippedName = currentName
              .replace(/^[^\w\s]*LOA[^\w\s]*\s*\|\s*/i, '')
              .replace(/^𝖫𝖮𝖠\s*\|\s*/i, '')
              .trim();
            record.originalNickname = strippedName;
            const newNick = `𝖫𝖮𝖠 | ${strippedName}`.slice(0, 32);
            await member.setNickname(newNick).catch(err => {
              console.warn(`[LOA] Could not update nickname for ${member.user.tag}:`, err.message);
            });
            saveLoaRecords(store);
          }
        } catch (nickErr) {
          console.error('[LOA] Error setting member nickname:', nickErr);
        }

        // Update card in review channel
        const updatedCard = buildLoaSubmissionCard(record);
        await interaction.update(updatedCard).catch(async () => {
          if (interaction.message) await interaction.message.edit(updatedCard).catch(() => null);
        });

        // Send Approved DM to applicant
        try {
          const applicant = await client.users.fetch(record.userId).catch(() => null);
          if (applicant) {
            const dmPayload = buildLoaStatusDm({ record, status: 'approved' });
            await applicant.send(dmPayload).catch(() => null);
          }
        } catch (dmErr) {
          console.warn('[LOA] Could not send approval DM:', dmErr.message);
        }
        return;
      }

      // LOA Review Deny Button -> Show Denial Modal
      if (interaction.customId.startsWith('loa_btn_deny_')) {
        if (!isStaff(interaction.member, interaction)) {
          return interaction.reply({
            content: 'You do not have permission to review Leave of Absence requests.',
            ephemeral: true
          });
        }
        const loaId = interaction.customId.replace('loa_btn_deny_', '');
        const modal = new ModalBuilder()
          .setCustomId(`modal_loa_deny_${loaId}`)
          .setTitle('Deny Leave of Absence');

        const reasonInput = new TextInputBuilder()
          .setCustomId('deny_reason')
          .setLabel('Denial Reason / Justification')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Provide reason for denying this Leave of Absence...')
          .setMaxLength(500)
          .setRequired(true);

        const row = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(row);
        await interaction.showModal(modal);
        return;
      }

      // Commands Directory Pagination Buttons
      if (interaction.customId.startsWith('cmd_page_prev_')) {
        const curPage = parseInt(interaction.customId.replace('cmd_page_prev_', ''), 10) || 0;
        const newPage = Math.max(0, curPage - 1);
        const payload = buildCommandsDirectoryPayload(interaction.client, newPage, interaction.guildId);
        return interaction.update(payload).catch(() => null);
      }

      if (interaction.customId.startsWith('cmd_page_next_')) {
        const curPage = parseInt(interaction.customId.replace('cmd_page_next_', ''), 10) || 0;
        const newPage = Math.min(4, curPage + 1);
        const payload = buildCommandsDirectoryPayload(interaction.client, newPage, interaction.guildId);
        return interaction.update(payload).catch(() => null);
      }

      // Application Module 1 Button
      if (interaction.customId === 'app_mod_btn_1') {
        const session = getActiveSession(interaction.user.id);
        if (!session) {
          return interaction.reply({ content: 'No active application session found.', ephemeral: true });
        }
        return interaction.showModal(buildModule1Modal(session));
      }

      // Application Module 2 Button
      if (interaction.customId === 'app_mod_btn_2') {
        const session = getActiveSession(interaction.user.id);
        if (!session) {
          return interaction.reply({ content: 'No active application session found.', ephemeral: true });
        }
        if (!session.modules?.mod1) {
          return interaction.reply({ content: 'Please complete Module 1: Rules & Requirements first.', ephemeral: true });
        }
        return interaction.showModal(buildModule2Modal(session));
      }

      // Application Module 3 Button
      if (interaction.customId === 'app_mod_btn_3') {
        const session = getActiveSession(interaction.user.id);
        if (!session) {
          return interaction.reply({ content: 'No active application session found.', ephemeral: true });
        }
        if (!session.modules?.mod2) {
          return interaction.reply({ content: 'Please complete Module 2: General Information first.', ephemeral: true });
        }
        return interaction.showModal(buildModule3Modal(session));
      }

      // Application Module 4 Button
      if (interaction.customId === 'app_mod_btn_4') {
        const session = getActiveSession(interaction.user.id);
        if (!session) {
          return interaction.reply({ content: 'No active application session found.', ephemeral: true });
        }
        if (!session.modules?.mod3) {
          return interaction.reply({ content: 'Please complete Module 3: Core Knowledge first.', ephemeral: true });
        }
        return interaction.showModal(buildModule4Modal(session));
      }

      // Application Submit Button
      if (interaction.customId === 'app_submit') {
        const session = getActiveSession(interaction.user.id);
        if (!session) {
          return interaction.reply({ content: 'No active application found to submit.', ephemeral: true });
        }
        const { mod1, mod2, mod3, mod4 } = session.modules || {};
        if (!mod1 || !mod2 || !mod3 || !mod4) {
          return interaction.reply({ content: 'Please complete all 4 modules before submitting.', ephemeral: true });
        }

        const submissionId = randomUUID();
        const roleName = getRoleDisplayName(session.role);

        const submission = {
          id: submissionId,
          userId: interaction.user.id,
          userTag: interaction.user.tag,
          userAvatar: interaction.user.displayAvatarURL({ dynamic: true }),
          role: session.role,
          answers: session.answers,
          submittedAt: Date.now(),
          status: 'pending',
          reviewedBy: null,
          reviewedAt: null,
          notes: null
        };

        saveSubmission(submission);
        removeActiveSession(interaction.user.id);

        const confirmedComponents = [
          {
            type: 12,
            items: [{ media: { url: 'attachment://applications_banner.png' } }]
          },
          {
            type: 10,
            content:
              `## ERLCX | Application Submitted\n` +
              `> Your **${roleName}** application has been transmitted to the Executive Team for review.\n\n` +
              `### Application Details\n` +
              `> • **Status:** Submitted & Pending Review\n` +
              `> • **Reference ID:** \`${submissionId.slice(0, 8).toUpperCase()}\`\n` +
              `> • **Notifications:** You will receive a direct message notification here once a decision has been reached.\n\n` +
              `> *Inquiries regarding the status of your application will result in denial. Thank you for applying to ERLCX.*`
          }
        ];

        const confirmedPayload = {
          flags: 32768,
          components: [{ type: 17, components: confirmedComponents }]
        };

        try {
          await interaction.update(confirmedPayload);
        } catch {
          if (interaction.message) await interaction.message.edit(confirmedPayload).catch(() => null);
        }

        // Post to Staff Review Channel (1550446015859925012)
        const reviewChannelId = getReviewChannelId();
        try {
          const reviewChannel = await interaction.client.channels.fetch(reviewChannelId).catch(() => null);
          if (reviewChannel) {
            const reviewPayload = buildStaffReviewCard(submission, 0);
            const sentMsg = await reviewChannel.send(reviewPayload);
            updateSubmission(submissionId, {
              reviewMessageId: sentMsg.id,
              reviewChannelId: reviewChannel.id
            });
          } else {
            console.warn(`Staff review channel ${reviewChannelId} not found.`);
          }
        } catch (err) {
          console.error('Failed to post application to review channel:', err);
        }
        return;
      }

      // Application Cancel Button
      if (interaction.customId === 'app_cancel') {
        removeActiveSession(interaction.user.id);
        const cancelPayload = {
          flags: 32768,
          components: [
            {
              type: 17,
              components: [
                {
                  type: 10,
                  content:
                    `## ERLCX | Application Cancelled\n` +
                    `> Your staff application session has been cancelled.\n` +
                    `> You may start a new application at any time from the server panel.`
                }
              ]
            }
          ]
        };
        try {
          await interaction.update(cancelPayload);
        } catch {
          if (interaction.message) await interaction.message.edit(cancelPayload).catch(() => null);
        }
        return;
      }

      // Open Training Ticket Button (From Acceptance Results Card & DM)
      if (interaction.customId.startsWith('app_training_ticket_') || interaction.customId === 'app_result_btn_ticket' || interaction.customId === 'app_dm_btn_ticket') {
        let targetUserId = null;
        let targetSubId = null;

        if (interaction.customId.startsWith('app_training_ticket_')) {
          const parts = interaction.customId.replace('app_training_ticket_', '').split('_');
          targetUserId = parts[0] || null;
          targetSubId = parts[1] || null;
        }

        // Security / Permission Check: Only the accepted user can open their training ticket
        if (targetUserId && interaction.user.id !== targetUserId) {
          return interaction.reply({
            content: `⚠️ Only the accepted applicant (<@${targetUserId}>) can open their training ticket.`,
            ephemeral: true
          });
        }

        // Find the application submission
        let submission = targetSubId ? getSubmission(targetSubId) : null;
        if (!submission) {
          const appsData = loadApplicationsData();
          const userSubmissions = Object.values(appsData.submissions || {}).filter(
            s => s.userId === interaction.user.id && s.status === 'approved'
          );
          if (userSubmissions.length > 0) {
            submission = userSubmissions.sort((a, b) => (b.reviewedAt || b.submittedAt) - (a.reviewedAt || a.submittedAt))[0];
          }
        }

        if (!submission && !targetUserId) {
          return interaction.reply({
            content: '⚠️ You do not have an approved staff application to open a training ticket.',
            ephemeral: true
          });
        }

        // Resolve Guild context (supports clicking from DM or server)
        const guild = interaction.guild || interaction.client.guilds.cache.get('1541210827967823955') || interaction.client.guilds.cache.first();
        if (!guild) {
          return interaction.reply({
            content: 'Could not resolve server to create your training ticket.',
            ephemeral: true
          });
        }

        // Check if user already has an active training/support ticket
        const allTickets = loadTicketsData();
        const existingTicket = Object.values(allTickets.active || {}).find(
          t => t.authorId === interaction.user.id && (t.category === 'training' || t.category === 'management')
        );
        if (existingTicket) {
          const channelExists = guild.channels.cache.has(existingTicket.channelId) ||
                                await guild.channels.fetch(existingTicket.channelId).catch(() => null);
          if (channelExists) {
            return interaction.reply({
              content: `You already have an open ticket in <#${existingTicket.channelId}>. Please use your existing ticket.`,
              ephemeral: true
            });
          } else {
            deleteActiveTicket(existingTicket.channelId);
          }
        }

        await interaction.deferReply({ ephemeral: true });

        // Category: Management category 1548330987128229989
        const targetManagementCategoryId = '1548330987128229989';
        let parentCategoryId = null;

        const targetCatExists = guild.channels.cache.get(targetManagementCategoryId) ||
                                await guild.channels.fetch(targetManagementCategoryId).catch(() => null);
        if (targetCatExists) {
          parentCategoryId = targetManagementCategoryId;
        } else {
          // Fallback to configured management category
          const mgmtCategory = CONFIG.CATEGORIES.find(c => c.id === 'management');
          const candidateCategoryIds = Array.isArray(mgmtCategory?.categoryIds)
            ? mgmtCategory.categoryIds
            : [mgmtCategory?.categoryId].filter(Boolean);

          for (const catId of candidateCategoryIds) {
            if (catId) {
              const exists = guild.channels.cache.has(catId) ||
                             await guild.channels.fetch(catId).catch(() => null);
              if (exists) {
                parentCategoryId = catId;
                break;
              }
            }
          }
        }

        // Channel Permissions: ONLY the accepted user, bot, and staff/management can view
        const permissionOverwrites = [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          },
          {
            id: (interaction.client || client).user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ManageMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          }
        ];

        // Add staff and management roles
        for (const roleId of CONFIG.STAFF_ROLE_IDS) {
          if (roleId && !roleId.includes('PASTE') && guild.roles.cache.has(roleId)) {
            permissionOverwrites.push({
              id: roleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks
              ]
            });
          }
        }

        const roleName = getRoleDisplayName(submission?.role || 'ingame_mod');
        const cleanUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
        const channelName = `training-${cleanUsername || 'appointee'}`;

        try {
          const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: parentCategoryId,
            permissionOverwrites: permissionOverwrites,
            topic: `Staff Training & Onboarding | Appointee: ${interaction.user.tag} (${interaction.user.id}) | Role: ${roleName}`
          });

          const ticketData = {
            channelId: ticketChannel.id,
            channelName: ticketChannel.name,
            authorId: interaction.user.id,
            authorTag: interaction.user.tag,
            category: 'training',
            categoryLabel: 'Staff Training & Onboarding',
            role: roleName,
            reason: `Staff Orientation, Permission Allocation & In-Game Patrol Training for ${roleName}`,
            reviewedBy: submission?.reviewedBy || null,
            notes: submission?.notes || null,
            submissionId: submission?.id || null,
            claimedBy: null,
            claimedTag: null,
            createdAt: Date.now()
          };

          // Ping applicant and staff
          const staffPings = CONFIG.STAFF_ROLE_IDS
            .filter(r => r && !r.includes('PASTE') && guild.roles.cache.has(r))
            .map(r => `<@&${r}>`)
            .join(' ');

          const pingMessage = `<@${interaction.user.id}> ${staffPings}`.trim();
          await ticketChannel.send({ content: pingMessage });

          // Send Components V2 Training Control Card
          const controlPayload = buildTicketControl(ticketData);
          const controlMessage = await ticketChannel.send(controlPayload);

          ticketData.controlMessageId = controlMessage.id;
          saveActiveTicket(ticketChannel.id, ticketData);

          // Pin the control message and delete system pin notification
          try {
            await controlMessage.pin();
            await new Promise(r => setTimeout(r, 600));
            const recentMsgs = await ticketChannel.messages.fetch({ limit: 6 }).catch(() => null);
            if (recentMsgs) {
              const pinNotice = recentMsgs.find(m => m.system || m.type === 6);
              if (pinNotice) await pinNotice.delete().catch(() => null);
            }
          } catch (pinErr) {
            console.warn('Could not pin training ticket control embed:', pinErr.message);
          }

          return interaction.editReply({
            content: `Your staff training ticket has been created: <#${ticketChannel.id}>`
          });
        } catch (createErr) {
          console.error('Failed to create training ticket channel:', createErr);
          return interaction.editReply({
            content: `Failed to create training ticket channel: ${createErr.message}`
          });
        }
      }

      // Staff Review Pagination: Previous Page
      if (interaction.customId.startsWith('app_page_prev_')) {
        const parts = interaction.customId.replace('app_page_prev_', '').split('_');
        const subId = parts[0];
        const currentPage = parseInt(parts[1], 10) || 0;
        const submission = getSubmission(subId);
        if (!submission) {
          return interaction.reply({ content: 'Application not found.', ephemeral: true });
        }
        const updatedPayload = buildStaffReviewCard(submission, currentPage - 1);
        return interaction.update(updatedPayload);
      }

      // Staff Review Pagination: Next Page
      if (interaction.customId.startsWith('app_page_next_')) {
        const parts = interaction.customId.replace('app_page_next_', '').split('_');
        const subId = parts[0];
        const currentPage = parseInt(parts[1], 10) || 0;
        const submission = getSubmission(subId);
        if (!submission) {
          return interaction.reply({ content: 'Application not found.', ephemeral: true });
        }
        const updatedPayload = buildStaffReviewCard(submission, currentPage + 1);
        return interaction.update(updatedPayload);
      }

      // Staff Review Buttons: Approve & Deny
      if (interaction.customId.startsWith('app_approve_')) {
        const isUserStaff = isStaff(interaction.member, interaction) ||
          interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
        if (!isUserStaff) {
          return interaction.reply({ content: 'Only staff members can review applications.', ephemeral: true });
        }

        const subId = interaction.customId.replace('app_approve_', '');
        const modal = new ModalBuilder()
          .setCustomId(`modal_app_approve_${subId}`)
          .setTitle('Approve Staff Application');

        const notesInput = new TextInputBuilder()
          .setCustomId('app_notes')
          .setLabel('Staff Notes / Instructions (Optional)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Enter welcome notes or next steps for the applicant...')
          .setRequired(false)
          .setMaxLength(1000);

        modal.addComponents(new ActionRowBuilder().addComponents(notesInput));
        return interaction.showModal(modal);
      }

      if (interaction.customId.startsWith('app_deny_')) {
        const isUserStaff = isStaff(interaction.member, interaction) ||
          interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
        if (!isUserStaff) {
          return interaction.reply({ content: 'Only staff members can review applications.', ephemeral: true });
        }

        const subId = interaction.customId.replace('app_deny_', '');
        const modal = new ModalBuilder()
          .setCustomId(`modal_app_deny_${subId}`)
          .setTitle('Deny Staff Application');

        const notesInput = new TextInputBuilder()
          .setCustomId('app_notes')
          .setLabel('Denial Reason / Feedback (Optional)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Enter feedback or areas of improvement...')
          .setRequired(false)
          .setMaxLength(1000);

        modal.addComponents(new ActionRowBuilder().addComponents(notesInput));
        return interaction.showModal(modal);
      }

      // Rules Button (shows rules and marks user as having read them)
      if (interaction.customId === 'ticket_btn_rules') {
        markUserReadRules(interaction.user.id);
        const botInst = getBotInstanceForGuild(interaction.guildId);
        const rulesPayload = buildRulesEmbed(botInst?.customizations);
        return interaction.reply(rulesPayload);
      }

      // Report Staff Button (inside management tickets)
      if (interaction.customId === 'ticket_btn_report_staff') {
        const modal = new ModalBuilder()
          .setCustomId('modal_report_staff')
          .setTitle('Report Staff Member');

        const staffNameInput = new TextInputBuilder()
          .setCustomId('reported_staff_target')
          .setLabel('Staff Member (Username or ID)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Enter username, mention, or ID of staff member...')
          .setMinLength(2)
          .setMaxLength(100)
          .setRequired(true);

        const reasonInput = new TextInputBuilder()
          .setCustomId('reported_staff_reason')
          .setLabel('Reason & Incident Details')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Describe what occurred, broken rules, links to proof, etc...')
          .setMinLength(5)
          .setMaxLength(1500)
          .setRequired(true);

        const row1 = new ActionRowBuilder().addComponents(staffNameInput);
        const row2 = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(row1, row2);

        await interaction.showModal(modal);
        return;
      }

      // Session Notification Role Toggle
      if (interaction.customId === 'session_btn_notify') {
        const roleId = CONFIG.SESSION.NOTIFICATION_ROLE_ID;
        const member = interaction.member;

        if (!member) {
          return interaction.reply({
            content: 'Could not resolve member data.',
            ephemeral: true
          });
        }

        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId).catch(() => null);
          return interaction.reply({
            content: `Removed <@&${roleId}>. You will no longer receive session alerts.`,
            ephemeral: true
          });
        } else {
          await member.roles.add(roleId).catch(() => null);
          return interaction.reply({
            content: `Added <@&${roleId}>. You will now receive session notifications!`,
            ephemeral: true
          });
        }
      }

      // Welcome Member Count Display Button
      if (interaction.customId === 'welcome_member_count') {
        const count = interaction.guild?.memberCount || 1;
        return interaction.reply({
          content: `### <:People:1547025501703372820> Server Member Count\n> **${interaction.guild.name}** currently has **${count.toLocaleString()}** members.`,
          flags: 64
        });
      }

      // Session Vote Casting (Vote Button)
      if (interaction.customId.startsWith('session_vote_cast_')) {
        const voteId = interaction.customId.replace('session_vote_cast_', '');
        const vote = getSessionVote(voteId);

        if (!vote) {
          return interaction.reply({
            content: 'Could not find session vote record.',
            flags: 64
          });
        }

        if (vote.status !== 'active') {
          return interaction.reply({
            content: 'This session vote has already concluded.',
            flags: 64
          });
        }

        const userId = interaction.user.id;
        const voterIndex = vote.voters.indexOf(userId);
        let feedback = '';

        if (voterIndex === -1) {
          vote.voters.push(userId);
          feedback = `Your vote has been recorded. (${vote.voters.length}/${vote.requiredVotes} votes)`;
        } else {
          vote.voters.splice(voterIndex, 1);
          feedback = `Your vote has been removed. (${vote.voters.length}/${vote.requiredVotes} votes)`;
        }

        saveSessionVote(vote);
        await interaction.reply({ content: feedback, flags: 64 });

        // Update vote container message
        try {
          const voteChannel = await interaction.client.channels.fetch(vote.channelId).catch(() => null);
          if (voteChannel && vote.messageId) {
            const voteMsg = await voteChannel.messages.fetch(vote.messageId).catch(() => null);
            if (voteMsg) {
              await voteMsg.edit(buildSessionVotePayload(vote));
            }
          }
        } catch (e) {
          console.warn('Could not update session vote message:', e.message);
        }

        // Check if required votes reached
        if (vote.voters.length >= vote.requiredVotes && vote.status === 'active' && !vote.completionNotified) {
          vote.status = 'completed';
          vote.completionNotified = true;
          saveSessionVote(vote);

          // Update vote message to Goal Reached
          try {
            const voteChannel = await interaction.client.channels.fetch(vote.channelId).catch(() => null);
            if (voteChannel && vote.messageId) {
              const voteMsg = await voteChannel.messages.fetch(vote.messageId).catch(() => null);
              if (voteMsg) {
                await voteMsg.edit(buildSessionVotePayload(vote));
              }
            }
          } catch {}

          // Automatically post live session panel to #sessions and clean up offline panel
          try {
            const sessionChannelId = CONFIG.SESSION.CHANNEL_ID || vote.channelId;
            await activateLiveSessionPanel(interaction.client, sessionChannelId);
          } catch (panelErr) {
            console.error('Failed to auto-post session panel on vote completion:', panelErr);
          }



          // Send redesigned DM to the host with action buttons inside the card
          try {
            const host = await client.users.fetch(vote.hostId);
            const hostPayload = buildHostVoteCompletedPayload(vote);
            await host.send(hostPayload).catch(async (v2Err) => {
              console.warn('Components V2 in DM fallback triggered:', v2Err.message);
              const fallbackEmbed = new EmbedBuilder()
                .setColor(0x38BDF8)
                .setImage(CONFIG.SESSION.VOTE_TOP_BANNER_URL)
                .setTitle('Session Vote Completed — Action Required')
                .setDescription(
                  `> The session vote in **ERLCX** has reached its goal of **${vote.requiredVotes} votes** in <#${vote.channelId}>.\n\n` +
                  `Choose an action below to proceed with the session startup:`
                );
              const fallbackRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`vote_host_start_${vote.id}`)
                  .setLabel('Start Session')
                  .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                  .setCustomId(`vote_host_postpone_${vote.id}`)
                  .setLabel('Postpone Session')
                  .setStyle(ButtonStyle.Secondary)
              );
              await host.send({ embeds: [fallbackEmbed], components: [fallbackRow] });
            });
          } catch (dmErr) {
            console.warn('Could not DM session host:', dmErr.message);
          }
        }
        return;
      }

      // Host Decision: Start Session
      if (interaction.customId.startsWith('vote_host_start_')) {
        const voteId = interaction.customId.replace('vote_host_start_', '');
        const vote = getSessionVote(voteId);

        if (!vote) {
          return interaction.reply({
            content: 'Could not find session vote record.',
            flags: 64
          });
        }

        if (interaction.user.id !== vote.hostId) {
          return interaction.reply({
            content: 'Only the host who initiated the vote can start the session.',
            flags: 64
          });
        }

        if (vote.status === 'started') {
          return interaction.reply({
            content: 'This session has already been started.',
            flags: 64
          });
        }

        vote.status = 'started';
        saveSessionVote(vote);

        await interaction.reply({
          content: `Session officially started. All voters have been pinged in <#${vote.channelId}>.`,
          flags: 64
        });

        // Ping all voters in the session channel with Join Server button
        try {
          const voteChannel = await interaction.client.channels.fetch(vote.channelId).catch(() => null);
          if (voteChannel) {
            const voterPings = vote.voters.map(id => `<@${id}>`).join(' ');
            const joinCode = CONFIG.SESSION.DEFAULT_JOIN_CODE || 'olrpp';
            const joinUrl = `https://policeroleplay.community/join?code=${encodeURIComponent(joinCode)}`;

            const joinRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('Join Server ↗')
                .setURL(joinUrl)
            );

            await voteChannel.send({
              content: `${voterPings}\n### Session Starting Now\n> The session vote has succeeded and <@${vote.hostId}> has officially started the session. All voters, please join up and get in-game now.`,
              components: [joinRow]
            });

            if (vote.messageId) {
              const voteMsg = await voteChannel.messages.fetch(vote.messageId).catch(() => null);
              if (voteMsg) {
                await voteMsg.delete().catch(() => {});
              }
            }
          }
        } catch (err) {
          console.error('Error announcing session start:', err);
        }
        return;
      }

      // Host Decision: Postpone Session
      if (interaction.customId.startsWith('vote_host_postpone_')) {
        const voteId = interaction.customId.replace('vote_host_postpone_', '');
        const vote = getSessionVote(voteId);

        if (!vote) {
          return interaction.reply({
            content: 'Could not find session vote record.',
            flags: 64
          });
        }

        if (interaction.user.id !== vote.hostId) {
          return interaction.reply({
            content: 'Only the host who initiated the vote can postpone the session.',
            flags: 64
          });
        }

        vote.status = 'postponed';
        saveSessionVote(vote);

        await interaction.reply({
          content: `Session has been marked as postponed. Notice sent to <#${vote.channelId}>.`,
          flags: 64
        });

        try {
          const voteChannel = await interaction.client.channels.fetch(vote.channelId).catch(() => null);
          if (voteChannel) {
            await voteChannel.send({
              content: `### Session Postponed\n> <@${vote.hostId}> has postponed the session. Stay tuned for future announcements.`
            });

            if (vote.messageId) {
              const voteMsg = await voteChannel.messages.fetch(vote.messageId).catch(() => null);
              if (voteMsg) {
                await voteMsg.edit(buildSessionVotePayload(vote));
              }
            }
          }
        } catch (err) {
          console.error('Error announcing session postponement:', err);
        }
        return;
      }

      // Giveaway Entry Toggle Button
      if (interaction.customId.startsWith('giveaway_enter_')) {
        try {
          const rawId = interaction.customId.replace('giveaway_enter_', '').trim();
          let giveaway = (rawId && rawId !== 'null' && rawId !== 'msg') ? getGiveaway(rawId) : null;

          // Fallback 1: Resolve by message ID
          if (!giveaway && interaction.message?.id) {
            giveaway = getGiveaway(interaction.message.id);
          }

          // Fallback 2: Resolve active giveaway in this channel
          if (!giveaway) {
            giveaway = findActiveGiveaway(null, interaction.channelId);
          }

          // Fallback 3: Automatically recover giveaway record from message components if missing from storage
          if (!giveaway && interaction.message) {
            giveaway = recoverGiveawayFromMessage(interaction.message);
          }

          if (!giveaway) {
            if (!interaction.replied && !interaction.deferred) {
              return interaction.reply({
                content: 'Could not find giveaway record. This giveaway may have been removed.',
                ephemeral: true
              }).catch(() => null);
            }
            return;
          }

          // Ensure giveaway.id is aligned with the actual Discord message
          if (interaction.message?.id && giveaway.id !== interaction.message.id) {
            giveaway.id = interaction.message.id;
            saveGiveaway(giveaway);
          }

          if (giveaway.ended) {
            if (!interaction.replied && !interaction.deferred) {
              return interaction.reply({
                content: 'This giveaway has already concluded.',
                ephemeral: true
              }).catch(() => null);
            }
            return;
          }

          giveaway.entries = Array.isArray(giveaway.entries) ? giveaway.entries : [];
          const userId = interaction.user.id;
          const entryIndex = giveaway.entries.indexOf(userId);
          let feedback = '';

          if (entryIndex === -1) {
            giveaway.entries.push(userId);
            feedback = `${GIVEAWAY_EMOJI} You have successfully entered the giveaway for **${giveaway.prize}**! (${giveaway.entries.length} total entries)`;
          } else {
            giveaway.entries.splice(entryIndex, 1);
            feedback = `Your entry for **${giveaway.prize}** has been withdrawn. (${giveaway.entries.length} total entries)`;
          }

          saveGiveaway(giveaway);

          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: feedback, ephemeral: true }).catch(() => null);
          } else {
            await interaction.followUp({ content: feedback, ephemeral: true }).catch(() => null);
          }

          // Update giveaway card in channel
          try {
            const updatedCard = buildGiveawayCard(giveaway, false);
            if (interaction.message) {
              await interaction.message.edit(updatedCard).catch(() => null);
            } else {
              const channel = await interaction.client.channels.fetch(giveaway.channelId).catch(() => null);
              if (channel) {
                const msg = await channel.messages.fetch(giveaway.id).catch(() => null);
                if (msg) {
                  await msg.edit(updatedCard).catch(() => null);
                }
              }
            }
          } catch (updateErr) {
            console.warn('Could not update giveaway card:', updateErr.message);
          }
        } catch (handlerErr) {
          console.error('Error handling giveaway entry interaction:', handlerErr);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: 'An error occurred while entering the giveaway. Please try again.',
              ephemeral: true
            }).catch(() => null);
          }
        }
        return;
      }

      // Department Buttons - Send Direct Message with department banner and invite link
      if (interaction.customId.startsWith('dept_btn_')) {
        const deptId = interaction.customId.replace('dept_btn_', '');
        const dept = findDepartment(deptId);

        if (!dept) {
          return interaction.reply({
            content: 'Department record not found.',
            flags: 64
          });
        }

        const dmData = buildDepartmentDmPayload(dept);
        let dmSuccess = false;

        try {
          await interaction.user.send(dmData.v2Payload);
          dmSuccess = true;
        } catch {
          try {
            await interaction.user.send(dmData.fallbackPayload);
            dmSuccess = true;
          } catch (dmErr) {
            console.warn(`Could not DM user ${interaction.user.tag}:`, dmErr.message);
          }
        }

        if (dmSuccess) {
          return interaction.reply({
            content: `> 📬 **Direct Message Sent**\n-# Check your DMs for the **${dept.name}** invitation and details!`,
            flags: 64
          });
        } else {
          return interaction.reply({
            content: `> ⚠️ **Could Not Send DM**\n-# Please enable **Direct Messages from server members** in your Privacy & Safety settings to receive department details. Alternatively, click here: [${dept.name} Server](${dept.inviteUrl})`,
            flags: 64
          });
        }
      }

      // Category Buttons from Ticket Panel
      if (interaction.customId.startsWith('ticket_btn_')) {
        const categoryId = interaction.customId.replace('ticket_btn_', '');
        
        // Find category from bot instance customizations or fallback to CONFIG.CATEGORIES
        const botInst = getBotForInteraction(interaction);
        const cust = botInst?.customizations || DEFAULT_CUSTOMIZATIONS;
        const configuredCats = Array.isArray(cust?.ticketCategories) ? cust.ticketCategories : [];
        const customCat = configuredCats.find(c => c.id === categoryId);
        const fallbackCat = CONFIG.CATEGORIES.find(c => c.id === categoryId);

        const category = customCat ? {
          id: customCat.id,
          label: customCat.name,
          categoryId: customCat.spawnCategoryId || cust.ticketCategoryId || null,
          pingRoleId: customCat.pingRoleId || cust.ticketPingRoleId || null
        } : (fallbackCat || null);

        if (!category) {
          return interaction.reply({
            content: 'Invalid category selected.',
            ephemeral: true
          });
        }

        // MANDATORY CHECK: User must click and read Rules before opening a ticket
        if (!hasUserReadRules(interaction.user.id)) {
          return interaction.reply({
            content: '⚠️ **You must read the ticket guidelines before opening a ticket!**\nPlease click the blue **Rules** button on the panel to review our rules, then select your category.',
            ephemeral: true
          });
        }

        // Check if this category is currently closed by staff
        if (isCategoryDisabled(categoryId) || isCategoryDisabled(category.label?.toLowerCase())) {
          return interaction.reply({
            content: `**${category.label}** is currently closed by staff. Please check back later.`,
            ephemeral: true
          });
        }

        // Check if user already has an open ticket (and verify channel still exists in Discord)
        const allTickets = loadTicketsData();
        const existingTicket = Object.values(allTickets.active || {}).find(t => t.authorId === interaction.user.id);
        if (existingTicket) {
          const channelExists = interaction.guild.channels.cache.has(existingTicket.channelId) || 
                                await interaction.guild.channels.fetch(existingTicket.channelId).catch(() => null);
          if (channelExists) {
            return interaction.reply({
              content: `You already have an open ticket in <#${existingTicket.channelId}>. Please resolve your current ticket before opening another.`,
              ephemeral: true
            });
          } else {
            // Channel was manually deleted in Discord! Auto-clean from storage
            deleteActiveTicket(existingTicket.channelId);
          }
        }

        // Show Modal (Discord modal title max 45 chars)
        const modalTitle = `${category.label} Support`.slice(0, 45);
        const modal = new ModalBuilder()
          .setCustomId(`modal_open_${categoryId}`)
          .setTitle(modalTitle);

        const reasonInput = new TextInputBuilder()
          .setCustomId('ticket_reason')
          .setLabel('Reason for Opening / Summary of Inquiry')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Please describe what you need assistance with in detail...')
          .setMinLength(5)
          .setMaxLength(1000)
          .setRequired(true);

        const row = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
        return;
      }

      const activeTicket = getActiveTicket(interaction.channel.id);

      // Claim Button
      if (interaction.customId === 'ticket_claim') {
        if (!activeTicket) {
          return interaction.reply({
            content: 'Ticket metadata could not be found.',
            ephemeral: true
          });
        }
        if (!isStaff(interaction.member, interaction)) {
          return interaction.reply({
            content: 'Only staff members can claim tickets.',
            ephemeral: true
          });
        }

        activeTicket.claimedBy = interaction.user.id;
        activeTicket.claimedTag = interaction.user.tag;
        saveActiveTicket(interaction.channel.id, activeTicket);

        const botInst = getBotForInteraction(interaction);
        const cust = botInst?.customizations || DEFAULT_CUSTOMIZATIONS;

        const updatedControl = buildTicketControl(activeTicket, cust);
        await interaction.update(updatedControl);

        const claimEmbed = new EmbedBuilder()
          .setDescription(`> <@${interaction.user.id}> has claimed this ticket.`);

        await interaction.channel.send({
          embeds: [claimEmbed]
        });
        return;
      }

      // Unclaim Button
      if (interaction.customId === 'ticket_unclaim') {
        if (!activeTicket) {
          return interaction.reply({
            content: 'Ticket metadata could not be found.',
            ephemeral: true
          });
        }
        if (!isStaff(interaction.member, interaction)) {
          return interaction.reply({
            content: 'Only staff members can unclaim tickets.',
            ephemeral: true
          });
        }

        if (activeTicket.claimedBy !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({
            content: 'Only the assigned handler or an administrator can unclaim this ticket.',
            ephemeral: true
          });
        }

        activeTicket.claimedBy = null;
        activeTicket.claimedTag = null;
        saveActiveTicket(interaction.channel.id, activeTicket);

        const botInst = getBotForInteraction(interaction);
        const cust = botInst?.customizations || DEFAULT_CUSTOMIZATIONS;

        const updatedControl = buildTicketControl(activeTicket, cust);
        await interaction.update(updatedControl);

        const unclaimEmbed = new EmbedBuilder()
          .setDescription(`> This ticket has been unclaimed and returned to staff queue.`);

        await interaction.channel.send({
          embeds: [unclaimEmbed]
        });
        return;
      }

      // Close Request Button (Staff only with mandatory reason modal)
      if (interaction.customId === 'ticket_close_request') {
        if (!isStaff(interaction.member, interaction)) {
          return interaction.reply({
            content: 'Only staff members can close support tickets.',
            ephemeral: true
          });
        }

        const modal = new ModalBuilder()
          .setCustomId('modal_close_ticket')
          .setTitle('Close Support Ticket');

        const reasonInput = new TextInputBuilder()
          .setCustomId('close_reason')
          .setLabel('Reason for Closing')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Enter the resolution or reason for closing this ticket...')
          .setMinLength(3)
          .setMaxLength(1000)
          .setRequired(true);

        const row = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
        return;
      }

      // Edit Reason Button on Transcript Log Embed
      if (interaction.customId.startsWith('ticket_edit_reason_')) {
        const channelId = interaction.customId.replace('ticket_edit_reason_', '');
        if (!isStaff(interaction.member, interaction)) {
          return interaction.reply({
            content: 'Only staff members can edit ticket close reasons.',
            ephemeral: true
          });
        }

        const ticketsData = loadTicketsData();
        const record = (ticketsData.history || []).find(h => h.channelId === channelId);

        const modal = new ModalBuilder()
          .setCustomId(`modal_edit_reason_${channelId}`)
          .setTitle('Edit Close Reason');

        const reasonInput = new TextInputBuilder()
          .setCustomId('new_reason')
          .setLabel('Updated Close Reason')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(record?.closeReason || '')
          .setMaxLength(500)
          .setRequired(true);

        const row = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
        return;
      }
    }
  } catch (error) {
    if (error.code === 10062 || error.code === 40060) {
      // Ignore expired interactions or duplicate acknowledgments from concurrent instances
      return;
    }
    console.error('Error handling interaction:', error);
    try {
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({
          content: `An error occurred: ${error.message || 'Unknown error'}`
        }).catch(() => null);
      } else if (!interaction.replied) {
        await interaction.reply({
          content: `An error occurred: ${error.message || 'Unknown error'}`,
          flags: 64
        }).catch(() => null);
      }
    } catch {
      // Ignore secondary reply failures
    }
  }
}

client.on(Events.InteractionCreate, handleInteraction);
setInteractionHandler(handleInteraction);

/* ========================================================================== */
/*                      PROCESS & CLIENT ERROR LISTENERS                      */
/* ========================================================================== */

client.on(Events.Error, error => {
  if (error.code === 10062 || error.code === 40060) return;
  console.warn('Discord client error:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
  if (reason?.code === 10062 || reason?.code === 40060) return;
  console.warn('Unhandled Rejection:', reason?.message || reason);
});

process.on('uncaughtException', (err, origin) => {
  if (err?.code === 10062 || err?.code === 40060) return;
  console.error(`Uncaught Exception (${origin}):`, err);
});

/* ========================================================================== */
/*                             CLIENT LOGIN                                   */
/* ========================================================================== */

if (!process.env.DISCORD_TOKEN) {
  console.warn("WARNING: DISCORD_TOKEN is not set in .env. Please set your token and run again.");
} else {
  client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("Failed to connect to Discord:", err.message);
  });
}
