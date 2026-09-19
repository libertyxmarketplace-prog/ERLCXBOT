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
  buildCommandsDirectoryPayload
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
  getMusicQueue
} from './musicManager.js';
import { generateTranscript } from './transcript.js';
import {
  fetchErlcServerData,
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
  buildApplicationStatusDmV2
} from './applicationManager.js';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel, Partials.Message]
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

      const payload = buildTicketPanel();
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
  console.log(` Orlando Support Bot logged in as ${client.user.tag}`);
  console.log(` Loaded ${CONFIG.CATEGORIES.length} Support Categories`);
  console.log(`=============================================`);

  // Refresh live panels on bot boot
  await updateAllLivePanels(client);
  await updateAllSessionPanels(client);
  await ensureSessionOfflineState(client);

  // Auto-refresh live session panels every 60 seconds
  setInterval(async () => {
    try {
      await updateAllSessionPanels(client);
    } catch (e) {
      console.warn('Session auto-update error:', e.message);
    }
  }, 60 * 1000);

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
  } catch {}
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
    const welcomeChannelId = CONFIG.WELCOME.CHANNEL_ID;
    if (!welcomeChannelId) return;

    const channel = member.guild.channels.cache.get(welcomeChannelId) ||
      await member.guild.channels.fetch(welcomeChannelId).catch(() => null);

    if (!channel) {
      console.warn(`Welcome channel ${welcomeChannelId} not found in guild ${member.guild.name}`);
      return;
    }

    const payload = buildWelcomePayload(member);
    await channel.send(payload);
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

    // -testwelcome / -welcome
    if (command === 'testwelcome' || command === 'welcome') {
      if (!isStaff(message.member)) return;
      const targetChannel = message.guild.channels.cache.get(CONFIG.WELCOME.CHANNEL_ID) || message.channel;
      const payload = buildWelcomePayload(message.member);
      await targetChannel.send(payload);
      return sendCleanFeedback(`Sent test welcome message to <#${targetChannel.id}>!`);
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
      const payload = buildCommandsDirectoryPayload(client, 0);
      return message.channel.send(payload);
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

    // -resume
    if (command === 'resume') {
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
  } catch (err) {
    console.error('Error handling prefix command:', err);
  }
});

/* ========================================================================== */
/*                           INTERACTION ROUTING                              */
/* ========================================================================== */

client.on(Events.InteractionCreate, async interaction => {
  try {
    /* ---------------------------------------------------------------------- */
    /* 1. SLASH COMMANDS                                                      */
    /* ---------------------------------------------------------------------- */
    if (interaction.isChatInputCommand()) {
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
            await activateLiveSessionPanel(client, targetChannel.id);

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
            || (CONFIG.SESSION.CHANNEL_ID ? await client.channels.fetch(CONFIG.SESSION.CHANNEL_ID).catch(() => null) : null)
            || interaction.channel;

          try {
            await shutdownSession(client, targetChannel.id);
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
            || (CONFIG.SESSION.CHANNEL_ID ? await client.channels.fetch(CONFIG.SESSION.CHANNEL_ID).catch(() => null) : null)
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
            await endGiveaway(client, giveaway.id);
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
            const newWinners = await rerollGiveaway(client, giveaway.id, winnersCount);
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
          const panelPayload = buildApplicationPanel();

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
        return;
      }

      // /commands or /command
      if (interaction.commandName === 'commands' || interaction.commandName === 'command') {
        const payload = buildCommandsDirectoryPayload(client, 0);
        return interaction.reply(payload);
      }

      // /refont <text>
      if (interaction.commandName === 'refont') {
        const text = interaction.options.getString('text');
        const styled = toSansSerif(text || '');
        return interaction.reply({ content: styled });
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

        const panelPayload = buildTicketPanel();

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

        if (activeTicket.controlMessageId) {
          const controlMsg = await interaction.channel.messages.fetch(activeTicket.controlMessageId).catch(() => null);
          if (controlMsg) await controlMsg.edit(buildTicketControl(activeTicket)).catch(() => null);
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

        if (activeTicket.controlMessageId) {
          const controlMsg = await interaction.channel.messages.fetch(activeTicket.controlMessageId).catch(() => null);
          if (controlMsg) await controlMsg.edit(buildTicketControl(activeTicket)).catch(() => null);
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
      // Handle Ticket Opening Modal
      if (interaction.customId.startsWith('modal_open_')) {
        const categoryId = interaction.customId.replace('modal_open_', '');
        const category = CONFIG.CATEGORIES.find(c => c.id === categoryId) || {
          id: categoryId,
          label: 'Support',
          categoryId: null
        };

        const reason = interaction.fields.getTextInputValue('ticket_reason');

        await interaction.deferReply({ ephemeral: true });

        const cleanUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
        const channelName = `ticket-${cleanUsername || 'inquiry'}`;

        // Build channel permission overwrites
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
            id: client.user.id,
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

        // Add staff roles to channel overwrites
        for (const roleId of CONFIG.STAFF_ROLE_IDS) {
          if (roleId && !roleId.includes('PASTE') && interaction.guild.roles.cache.has(roleId)) {
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

        // Determine parent category ID (supports Orlando server and testing server)
        let parentCategoryId = null;
        const candidateCategoryIds = Array.isArray(category.categoryIds)
          ? category.categoryIds
          : [category.categoryId].filter(Boolean);

        for (const catId of candidateCategoryIds) {
          if (catId) {
            const exists = interaction.guild.channels.cache.has(catId) || 
                           await interaction.guild.channels.fetch(catId).catch(() => null);
            if (exists) {
              parentCategoryId = catId;
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
        const staffPings = CONFIG.STAFF_ROLE_IDS
          .filter(r => r && !r.includes('PASTE') && interaction.guild.roles.cache.has(r))
          .map(r => `<@&${r}>`)
          .join(' ');

        const pingMessage = `<@${interaction.user.id}> ${staffPings}`.trim();
        await ticketChannel.send({ content: pingMessage });

        // Send in-ticket control panel
        const controlPayload = buildTicketControl(ticketData);
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
            text: 'Orlando RP Management Desk • Official Report'
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
            const logChannel = await client.channels.fetch(CONFIG.TRANSCRIPTS_CHANNEL_ID).catch(() => null);
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
          const resultsChan = await client.channels.fetch(resultsChanId).catch(() => null);
          if (resultsChan && resultsChan.isTextBased()) {
            const resultPayload = buildApplicationResultV2(updatedSubmission);
            await resultsChan.send(resultPayload);
          }
        } catch (resErr) {
          console.warn('Could not post acceptance announcement to results channel:', resErr.message);
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
      // Commands Directory Pagination Buttons
      if (interaction.customId.startsWith('cmd_page_prev_')) {
        const curPage = parseInt(interaction.customId.replace('cmd_page_prev_', ''), 10) || 0;
        const newPage = Math.max(0, curPage - 1);
        const payload = buildCommandsDirectoryPayload(client, newPage);
        return interaction.update(payload);
      }

      if (interaction.customId.startsWith('cmd_page_next_')) {
        const curPage = parseInt(interaction.customId.replace('cmd_page_next_', ''), 10) || 0;
        const newPage = Math.min(3, curPage + 1);
        const payload = buildCommandsDirectoryPayload(client, newPage);
        return interaction.update(payload);
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
              `## Orlando Roleplay | Application Submitted\n` +
              `> Your **${roleName}** application has been transmitted to the Executive Team for review.\n\n` +
              `### Application Details\n` +
              `> • **Status:** Submitted & Pending Review\n` +
              `> • **Reference ID:** \`${submissionId.slice(0, 8).toUpperCase()}\`\n` +
              `> • **Notifications:** You will receive a direct message notification here once a decision has been reached.\n\n` +
              `> *Inquiries regarding the status of your application will result in denial. Thank you for applying to Orlando Roleplay.*`
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
          const reviewChannel = await client.channels.fetch(reviewChannelId).catch(() => null);
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
                    `## Orlando Roleplay | Application Cancelled\n` +
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
        const guild = interaction.guild || client.guilds.cache.get('1541210827967823955') || client.guilds.cache.first();
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
            id: client.user.id,
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
        const rulesPayload = buildRulesEmbed();
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
          const voteChannel = await client.channels.fetch(vote.channelId).catch(() => null);
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
            const voteChannel = await client.channels.fetch(vote.channelId).catch(() => null);
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
            await activateLiveSessionPanel(client, sessionChannelId);
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
                  `> The session vote in **Orlando Roleplay** has reached its goal of **${vote.requiredVotes} votes** in <#${vote.channelId}>.\n\n` +
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
          const voteChannel = await client.channels.fetch(vote.channelId).catch(() => null);
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
          const voteChannel = await client.channels.fetch(vote.channelId).catch(() => null);
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
              const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
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

      // Category Buttons from Ticket Panel (General, Management)
      if (interaction.customId.startsWith('ticket_btn_')) {
        const categoryId = interaction.customId.replace('ticket_btn_', '');
        const category = CONFIG.CATEGORIES.find(c => c.id === categoryId);

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
        if (isCategoryDisabled(categoryId)) {
          return interaction.reply({
            content: `**${category.label} Support** is currently closed by staff. Please check back later.`,
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

        // Show Modal
        const modal = new ModalBuilder()
          .setCustomId(`modal_open_${categoryId}`)
          .setTitle(`${category.label} Support`);

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

        const updatedControl = buildTicketControl(activeTicket);
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

        const updatedControl = buildTicketControl(activeTicket);
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
    console.error('Error handling interaction:', error);
    if (interaction.deferred && !interaction.replied) {
      await interaction.editReply({
        content: `An error occurred: ${error.message || 'Unknown error'}`
      }).catch(() => null);
    } else if (!interaction.replied) {
      await interaction.reply({
        content: `An error occurred: ${error.message || 'Unknown error'}`,
        ephemeral: true
      }).catch(() => null);
    }
  }
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
