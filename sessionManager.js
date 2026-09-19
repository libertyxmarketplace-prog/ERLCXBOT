import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import { CONFIG } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION_PANELS_FILE = path.join(__dirname, 'data', 'session_panels.json');

/**
 * Returns a permanent bottom banner payload using the local assets/bottom-banner.png file.
 * This prevents Discord's expiring CDN URL errors completely.
 */
function getBottomBannerPayload() {
  const bannerFile = path.join(__dirname, 'assets', 'bottom-banner.png');
  if (fs.existsSync(bannerFile)) {
    return {
      url: 'attachment://bottom-banner.png',
      attachment: new AttachmentBuilder(bannerFile, { name: 'bottom-banner.png' })
    };
  }
  return {
    url: CONFIG.SESSION.BOTTOM_BANNER_URL,
    attachment: null
  };
}

// Cache Roblox user info to prevent rate limits
let cachedOwnerName = null;
let lastOwnerFetch = 0;

function readJsonFile(filePath, defaultData) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
      return defaultData;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return defaultData;
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error saving ${filePath}:`, err);
  }
}

export function loadSessionPanels() {
  return readJsonFile(SESSION_PANELS_FILE, { panels: [] });
}

export function saveSessionPanels(data) {
  writeJsonFile(SESSION_PANELS_FILE, data);
}

export function addSessionPanel(channelId, messageId) {
  const data = loadSessionPanels();
  data.panels = data.panels.filter(p => p.messageId !== messageId);
  data.panels.push({ channelId, messageId, createdAt: Date.now() });
  saveSessionPanels(data);
}

/**
 * Fetches the Roblox display name / username for a given Owner ID.
 */
async function fetchRobloxOwnerName(ownerId) {
  if (!ownerId) return 'Server Host';
  const now = Date.now();
  if (cachedOwnerName && now - lastOwnerFetch < 1000 * 60 * 60) {
    return cachedOwnerName;
  }

  try {
    const res = await fetch(`https://users.roblox.com/v1/users/${ownerId}`);
    if (res.ok) {
      const data = await res.json();
      cachedOwnerName = data.displayName || data.name || 'Server Host';
      lastOwnerFetch = now;
      return cachedOwnerName;
    }
  } catch (err) {
    console.warn('Could not fetch Roblox owner:', err.message);
  }

  return cachedOwnerName || 'Server Host';
}

/**
 * Fetches real-time server information from ER:LC API.
 */
export async function fetchErlcServerData() {
  const { API_KEY, API_BASE } = CONFIG.SESSION;

  try {
    const headers = { 'Server-Key': API_KEY };

    const [serverRes, playersRes, queueRes] = await Promise.all([
      fetch(`${API_BASE}/server`, { headers }).catch(() => null),
      fetch(`${API_BASE}/server/players`, { headers }).catch(() => null),
      fetch(`${API_BASE}/server/queue`, { headers }).catch(() => null)
    ]);

    const serverData = serverRes && serverRes.ok ? await serverRes.json().catch(() => null) : null;
    const playersData = playersRes && playersRes.ok ? await playersRes.json().catch(() => []) : [];
    const queueData = queueRes && queueRes.ok ? await queueRes.json().catch(() => []) : [];

    if (!serverData || serverData.code || serverData.message) {
      return {
        online: false,
        name: 'Orlando Roleplay',
        ownerName: 'Orlando Management',
        joinCode: CONFIG.SESSION.DEFAULT_JOIN_CODE,
        currentPlayers: 0,
        maxPlayers: 50,
        queue: 0,
        staffCount: 0
      };
    }

    const ownerName = await fetchRobloxOwnerName(serverData.OwnerId);
    const playersList = Array.isArray(playersData) ? playersData : [];
    const queueList = Array.isArray(queueData) ? queueData : [];

    // Count staff active in-game (permissions other than Normal)
    const staffCount = playersList.filter(
      p => p.Permission && p.Permission !== 'Normal'
    ).length;

    const currentPlayers = typeof serverData.CurrentPlayers === 'number'
      ? serverData.CurrentPlayers
      : playersList.length;

    return {
      online: currentPlayers > 0,
      name: serverData.Name || 'Orlando Roleplay',
      ownerName: ownerName || 'shots',
      joinCode: serverData.JoinKey || CONFIG.SESSION.DEFAULT_JOIN_CODE,
      currentPlayers: currentPlayers,
      maxPlayers: serverData.MaxPlayers || 50,
      queue: queueList.length,
      staffCount: staffCount
    };
  } catch (err) {
    console.error('Failed to fetch ER:LC server data:', err);
    return {
      online: false,
      name: 'Orlando Roleplay',
      ownerName: 'Orlando Management',
      joinCode: CONFIG.SESSION.DEFAULT_JOIN_CODE,
      currentPlayers: 0,
      maxPlayers: 50,
      queue: 0,
      staffCount: 0
    };
  }
}

/**
 * Builds the modern Discord Components V2 Session Information Panel
 * exactly matching the provided visual reference.
 */
export function buildSessionPanel(sessionData) {
  const {
    online,
    name,
    ownerName,
    joinCode,
    currentPlayers,
    maxPlayers,
    queue,
    staffCount
  } = sessionData;

  const joinUrl = `https://policeroleplay.community/join?code=${encodeURIComponent(joinCode || 'olrpp')}`;

  const containerComponents = [
    // 1. Top Banner (Sessions Header)
    {
      type: 12,
      items: [
        {
          media: {
            url: CONFIG.SESSION.TOP_BANNER_URL
          }
        }
      ]
    },
    // 2. Title & Description Blockquote
    {
      type: 10,
      content: `### Session Information\n> Orlando Roleplay live operations & staff patrols.`
    },
    // 3. Row: Server Name
    {
      type: 9, // Section
      components: [
        {
          type: 10,
          content: '**Server Name**\n-# Join with this private server name.'
        }
      ],
      accessory: {
        type: 2,
        style: 2, // Secondary Gray Pill
        label: name.length > 80 ? name.slice(0, 77) + '...' : name,
        disabled: true,
        custom_id: 'session_info_name'
      }
    },
    // 4. Row: Server Owner
    {
      type: 9, // Section
      components: [
        {
          type: 10,
          content: '**Server Owner**\n-# Host of this in-game private server.'
        }
      ],
      accessory: {
        type: 2,
        style: 2, // Secondary Gray Pill
        label: ownerName.length > 80 ? ownerName.slice(0, 77) + '...' : ownerName,
        disabled: true,
        custom_id: 'session_info_owner'
      }
    },
    // 5. Row: Server Code
    {
      type: 9, // Section
      components: [
        {
          type: 10,
          content: '**Server Code**\n-# Enter this code on the join page.'
        }
      ],
      accessory: {
        type: 2,
        style: 2, // Secondary Gray Pill
        label: joinCode || 'olrpp',
        disabled: true,
        custom_id: 'session_info_code'
      }
    },
    // Horizontal divider line between Server Code and Players
    {
      type: 14,
      divider: true,
      spacing: 1
    },
    // 6. Row: Players
    {
      type: 9, // Section
      components: [
        {
          type: 10,
          content: '**Players**\n-# How many players are in-game right now.'
        }
      ],
      accessory: {
        type: 2,
        style: 2, // Secondary Gray Pill
        label: `${currentPlayers}/${maxPlayers}`,
        disabled: true,
        custom_id: 'session_info_players'
      }
    },
    // 7. Row: Queue
    {
      type: 9, // Section
      components: [
        {
          type: 10,
          content: '**Queue**\n-# Players currently waiting to get in.'
        }
      ],
      accessory: {
        type: 2,
        style: 2, // Secondary Gray Pill
        label: `${queue}`,
        disabled: true,
        custom_id: 'session_info_queue'
      }
    },
    // 8. Row: Staff
    {
      type: 9, // Section
      components: [
        {
          type: 10,
          content: '**Staff**\n-# Staff members active in-game.'
        }
      ],
      accessory: {
        type: 2,
        style: 2, // Secondary Gray Pill
        label: `${staffCount}`,
        disabled: true,
        custom_id: 'session_info_staff'
      }
    },
    // 9. Interactive Action Row
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 2, // Secondary
          label: 'Session Notification',
          custom_id: 'session_btn_notify'
        },
        {
          type: 2,
          style: 5, // Link
          label: 'Join Server ↗',
          url: joinUrl
        },
        {
          type: 2,
          style: online ? 3 : 4, // 3 = Success (Green), 4 = Danger (Red)
          label: online ? 'Server Online' : 'Server Offline',
          disabled: true,
          custom_id: 'session_status_pill'
        }
      ]
    }
  ];

  const bannerInfo = getBottomBannerPayload();
  const files = bannerInfo.attachment ? [bannerInfo.attachment] : [];

  // 10. Bottom Banner Image
  if (bannerInfo.url) {
    containerComponents.push({
      type: 12,
      items: [
        {
          media: {
            url: bannerInfo.url
          }
        }
      ]
    });
  }

  // 11. Footer with relative timestamp
  containerComponents.push({
    type: 10,
    content: `-# Last updated: <t:${Math.floor(Date.now() / 1000)}:R>`
  });

  return {
    flags: 32768, // IS_COMPONENTS_V2
    components: [
      {
        type: 17, // Container
        components: containerComponents
      }
    ],
    files
  };
}

// Voice channel stat tracker to prevent hitting Discord's 2-per-10m channel edit rate limit
let lastIngameRename = 0;
let lastQueueRename = 0;
const VC_RENAME_COOLDOWN = 5 * 60 * 1000; // 5 minutes

/**
 * Updates in-game and queue stats voice channels based on ER:LC API data.
 */
export async function updateVoiceChannelStats(client, sessionData) {
  if (!client || !sessionData) return;
  const now = Date.now();

  const ingameVcId = CONFIG.SESSION?.INGAME_VC_ID || '1550318371340550254';
  const queueVcId = CONFIG.SESSION?.QUEUE_VC_ID || '1550318480136470638';

  // 1. In-game voice channel: `ingame X/Y`
  const targetIngameName = `ingame ${sessionData.currentPlayers}/${sessionData.maxPlayers}`;
  if (now - lastIngameRename >= VC_RENAME_COOLDOWN) {
    try {
      const ingameVc = await client.channels.fetch(ingameVcId).catch(() => null);
      if (ingameVc && ingameVc.name !== targetIngameName) {
        await ingameVc.setName(targetIngameName, 'Auto ER:LC player count update');
        lastIngameRename = now;
        console.log(`[VC Stat] Updated In-Game VC (${ingameVcId}) to: "${targetIngameName}"`);
      }
    } catch (err) {
      console.warn(`[VC Stat] Failed to update In-Game VC:`, err.message);
    }
  }

  // 2. Queue voice channel: `in queu: X`
  const targetQueueName = `in queu: ${sessionData.queue}`;
  if (now - lastQueueRename >= VC_RENAME_COOLDOWN) {
    try {
      const queueVc = await client.channels.fetch(queueVcId).catch(() => null);
      if (queueVc && queueVc.name !== targetQueueName) {
        await queueVc.setName(targetQueueName, 'Auto ER:LC queue count update');
        lastQueueRename = now;
        console.log(`[VC Stat] Updated Queue VC (${queueVcId}) to: "${targetQueueName}"`);
      }
    } catch (err) {
      console.warn(`[VC Stat] Failed to update Queue VC:`, err.message);
    }
  }
}

/**
 * Updates all live session panels with fresh data from ER:LC API,
 * as well as the dynamic voice channel stats.
 */
export async function updateAllSessionPanels(client) {
  const sessionData = await fetchErlcServerData();

  // Always update dynamic voice channel stats
  await updateVoiceChannelStats(client, sessionData);

  const panelStore = loadSessionPanels();
  if (!panelStore.panels || panelStore.panels.length === 0) return;

  const sessionPayload = buildSessionPanel(sessionData);

  const validPanels = [];
  for (const panel of panelStore.panels) {
    try {
      const channel = await client.channels.fetch(panel.channelId).catch(() => null);
      if (!channel) continue;

      const msg = await channel.messages.fetch(panel.messageId).catch(() => null);
      if (!msg) continue;

      await msg.edit(sessionPayload);
      validPanels.push(panel);
    } catch (err) {
      console.warn(`Could not update session panel ${panel.messageId}:`, err.message);
    }
  }

  saveSessionPanels({ panels: validPanels });
}

const SESSION_VOTES_FILE = path.join(__dirname, 'data', 'session_votes.json');

export function loadSessionVotes() {
  return readJsonFile(SESSION_VOTES_FILE, { votes: {} });
}

export function saveSessionVotes(data) {
  writeJsonFile(SESSION_VOTES_FILE, data);
}

export function getSessionVote(voteId) {
  const store = loadSessionVotes();
  return store.votes[voteId] || null;
}

export function saveSessionVote(vote) {
  const store = loadSessionVotes();
  store.votes[vote.id] = vote;
  saveSessionVotes(store);
}

/**
 * Builds the Discord Components V2 Session Vote Container
 */
export function buildSessionVotePayload(vote) {
  const currentVotes = vote.voters.length;
  const isGoalReached = currentVotes >= vote.requiredVotes;

  const containerComponents = [
    // 1. Top Banner Image
    {
      type: 12,
      items: [
        {
          media: {
            url: CONFIG.SESSION.VOTE_TOP_BANNER_URL
          }
        }
      ]
    },
    // 2. Title & Professional Description (No emojis, no bullet dots)
    {
      type: 10,
      content: `### Orlando Roleplay — Session Vote\n> Cast your vote below to begin today's session.`
    },
    // 3. Row: Session Votes (Pill on the far right)
    {
      type: 9, // Section
      components: [
        {
          type: 10,
          content: '**Session Votes**\n-# Total community votes submitted so far.'
        }
      ],
      accessory: {
        type: 2,
        style: isGoalReached ? 3 : 2, // Green if reached, gray if in progress
        label: `${currentVotes}/${vote.requiredVotes} Votes`,
        disabled: true,
        custom_id: 'session_vote_tally'
      }
    },
    // Horizontal divider line
    {
      type: 14,
      divider: true,
      spacing: 1
    },
    // 4. Row: Target Goal
    {
      type: 9, // Section
      components: [
        {
          type: 10,
          content: '**Target Goal**\n-# Votes required for session launch.'
        }
      ],
      accessory: {
        type: 2,
        style: 2,
        label: `${vote.requiredVotes} Votes`,
        disabled: true,
        custom_id: 'session_vote_goal'
      }
    },
    // 5. Row: Time Window
    {
      type: 9, // Section
      components: [
        {
          type: 10,
          content: '**Time Window**\n-# Voting duration period.'
        }
      ],
      accessory: {
        type: 2,
        style: 2,
        label: vote.durationLabel || '1 Hour',
        disabled: true,
        custom_id: 'session_vote_time'
      }
    },
    // 6. Row: Session Host
    {
      type: 9, // Section
      components: [
        {
          type: 10,
          content: '**Session Host**\n-# Staff member organizing this session.'
        }
      ],
      accessory: {
        type: 2,
        style: 2,
        label: vote.hostName || 'Staff Member',
        disabled: true,
        custom_id: 'session_vote_host'
      }
    },
    // 7. Action Row: Vote (No Emoji) & Session Notification (Custom Emoji)
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 2, // Secondary Gray
          label: 'Vote',
          custom_id: `session_vote_cast_${vote.id}`,
          disabled: vote.status !== 'active'
        },
        {
          type: 2,
          style: 2, // Secondary Gray
          label: 'Session Notification',
          emoji: { id: '1547025580535451708', name: 'Notification' },
          custom_id: 'session_btn_notify'
        }
      ]
    }
  ];

  // 8. Bottom Banner Image
  if (CONFIG.SESSION.VOTE_BOTTOM_BANNER_URL) {
    containerComponents.push({
      type: 12,
      items: [
        {
          media: {
            url: CONFIG.SESSION.VOTE_BOTTOM_BANNER_URL
          }
        }
      ]
    });
  }

  // 9. Dynamic relative timestamp footer
  containerComponents.push({
    type: 10,
    content: `-# Started: <t:${Math.floor(vote.createdAt / 1000)}:R> • Expires: <t:${Math.floor(vote.expiresAt / 1000)}:R>`
  });

  return {
    flags: 32768, // IS_COMPONENTS_V2
    components: [
      {
        type: 17, // Container
        components: containerComponents
      }
    ]
  };
}

const SESSION_STATE_FILE = path.join(__dirname, 'data', 'session_state.json');

export function loadSessionState() {
  return readJsonFile(SESSION_STATE_FILE, { offlineMessageId: null });
}

export function saveSessionState(state) {
  writeJsonFile(SESSION_STATE_FILE, state);
}

/**
 * Builds the Discord Components V2 Session Ended / Server Closed Panel
 * matching the user reference image.
 */
export function buildSessionEndedPanel(sessionData = null) {
  const currentPlayers = sessionData?.currentPlayers ?? 0;
  const maxPlayers = sessionData?.maxPlayers ?? 50;

  const containerComponents = [
    // 1. Top Banner Image
    {
      type: 12,
      items: [
        {
          media: {
            url: CONFIG.SESSION.TOP_BANNER_URL
          }
        }
      ]
    },
    // 2. Session Ended Announcement Text
    {
      type: 10,
      content: [
        'A **Orlando Roleplay** session has now ended! Thank you to **everyone** who joined, created realistic scenes, and made today\'s **roleplay enjoyable**!\n',
        'The **server** is now **closed**. We hope you **enjoyed the session**, stay tuned for the next session **startup**!'
      ].join('\n')
    },
    // Horizontal divider line
    {
      type: 14,
      divider: true,
      spacing: 1
    },
    // 3. Action Row: Get Session Notification & Unclickable In-Game Count Pill
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 2, // Secondary Gray
          label: 'Get Session Notification!',
          emoji: { id: '1547025580535451708', name: 'Notification' },
          custom_id: 'session_btn_notify'
        },
        {
          type: 2,
          style: 2, // Secondary Gray
          label: `${currentPlayers}/${maxPlayers} In-Game`,
          disabled: true,
          custom_id: 'session_offline_players'
        }
      ]
    }
  ];

  const bannerInfo = getBottomBannerPayload();
  const files = bannerInfo.attachment ? [bannerInfo.attachment] : [];

  // 4. Bottom Banner Image
  if (bannerInfo.url) {
    containerComponents.push({
      type: 12,
      items: [
        {
          media: {
            url: bannerInfo.url
          }
        }
      ]
    });
  }

  return {
    flags: 32768, // IS_COMPONENTS_V2
    components: [
      {
        type: 17, // Container
        accent_color: 689405, // Modern blue (#0a84fd)
        components: containerComponents
      }
    ],
    files
  };
}

/**
 * Builds the Orlando Session Info announcement card matching the user's reference image:
 * Top banner, Orlando session ended text, and bottom banner — without any buttons.
 */
export function buildSessionInfoCard() {
  const bannerInfo = getBottomBannerPayload();
  const files = bannerInfo.attachment ? [bannerInfo.attachment] : [];

  const containerComponents = [
    // 1. Top Banner Image
    {
      type: 12,
      items: [
        {
          media: {
            url: CONFIG.SESSION.TOP_BANNER_URL
          }
        }
      ]
    },
    // 2. Session Ended Announcement Text
    {
      type: 10,
      content: [
        'A **Orlando Roleplay** session has now ended! Thank you to **everyone** who joined, created realistic scenes, and made today\'s **roleplay enjoyable**!\n',
        'The **server** is now **closed**. We hope you **enjoyed the session**, stay tuned for the next session **startup**!'
      ].join('\n')
    }
  ];

  // 3. Bottom Banner Image
  if (bannerInfo.url) {
    containerComponents.push({
      type: 12,
      items: [
        {
          media: {
            url: bannerInfo.url
          }
        }
      ]
    });
  }

  return {
    flags: 32768, // IS_COMPONENTS_V2
    components: [
      {
        type: 17, // Container
        accent_color: 689405, // Modern blue (#0a84fd)
        components: containerComponents
      }
    ],
    files
  };
}

/**
 * Ensures the session channel displays the Session Ended / Offline panel
 * whenever there are no active live session panels.
 */
export async function ensureSessionOfflineState(client) {
  const channelId = CONFIG.SESSION.CHANNEL_ID;
  if (!channelId) return;

  const panelsData = loadSessionPanels();
  const hasLivePanelsInChannel = (panelsData.panels || []).some(p => p.channelId === channelId);
  if (hasLivePanelsInChannel) return; // Active session panel is showing

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const state = loadSessionState();
  const sessionData = await fetchErlcServerData();
  const endedPayload = buildSessionEndedPanel(sessionData);

  if (state.offlineMessageId) {
    const existingMsg = await channel.messages.fetch(state.offlineMessageId).catch(() => null);
    if (existingMsg) {
      await existingMsg.edit(endedPayload).catch(() => null);
      return;
    }
  }

  try {
    const sent = await channel.send(endedPayload);
    state.offlineMessageId = sent.id;
    saveSessionState(state);
  } catch (err) {
    console.error('Failed to post session ended panel in ensureSessionOfflineState:', err);
  }
}

/**
 * Handles shutting down a session in a channel:
 * Deletes any active live session panels, posts the Session Ended panel,
 * and updates persistent state.
 */
export async function shutdownSession(client, targetChannelId = null) {
  const channelId = targetChannelId || CONFIG.SESSION.CHANNEL_ID;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) throw new Error(`Could not find channel with ID ${channelId}`);

  // 1. Delete all active live session panels in this channel
  const panelsData = loadSessionPanels();
  const remainingPanels = [];
  for (const p of panelsData.panels || []) {
    if (p.channelId === channelId) {
      try {
        const msg = await channel.messages.fetch(p.messageId).catch(() => null);
        if (msg) await msg.delete().catch(() => {});
      } catch {}
    } else {
      remainingPanels.push(p);
    }
  }
  saveSessionPanels({ panels: remainingPanels });

  // 2. Delete existing offline message if any (so the new ended message is fresh at the bottom)
  const state = loadSessionState();
  if (state.offlineMessageId) {
    try {
      const oldOfflineMsg = await channel.messages.fetch(state.offlineMessageId).catch(() => null);
      if (oldOfflineMsg) await oldOfflineMsg.delete().catch(() => {});
    } catch {}
    state.offlineMessageId = null;
  }

  // 3. Fetch latest server player count & post Session Ended panel
  const sessionData = await fetchErlcServerData();
  const endedPayload = buildSessionEndedPanel(sessionData);
  const sentMsg = await channel.send(endedPayload);

  state.offlineMessageId = sentMsg.id;
  saveSessionState(state);

  return sentMsg;
}

/**
 * Posts the Live Session Information panel in the channel,
 * deleting the offline/ended panel if it exists.
 */
export async function activateLiveSessionPanel(client, targetChannelId = null) {
  const channelId = targetChannelId || CONFIG.SESSION.CHANNEL_ID;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) throw new Error(`Could not find channel with ID ${channelId}`);

  // 1. Delete offline/ended panel if present
  const state = loadSessionState();
  if (state.offlineMessageId) {
    try {
      const offlineMsg = await channel.messages.fetch(state.offlineMessageId).catch(() => null);
      if (offlineMsg) await offlineMsg.delete().catch(() => {});
    } catch {}
    state.offlineMessageId = null;
    saveSessionState(state);
  }

  // 2. Fetch latest data and post live panel
  const sessionData = await fetchErlcServerData();
  const sessionPayload = buildSessionPanel(sessionData);
  const sentMsg = await channel.send(sessionPayload);

  addSessionPanel(channel.id, sentMsg.id);
  return sentMsg;
}

/**
 * Builds the redesigned clean DM payload for the host when a session vote is completed.
 * Uses Components V2 so the buttons are placed cleanly inside the card,
 * with the vote banner at the top, without clutter.
 */
export function buildHostVoteCompletedPayload(vote) {
  const containerComponents = [
    // 1. Top Banner Image
    {
      type: 12,
      items: [
        {
          media: {
            url: CONFIG.SESSION.VOTE_TOP_BANNER_URL
          }
        }
      ]
    },
    // 2. Clean, professional Title & Description
    {
      type: 10,
      content: [
        '### Session Vote Completed — Action Required',
        `> The session vote in **Orlando Roleplay** has reached its goal of **${vote.requiredVotes} votes** in <#${vote.channelId}>.\n`,
        'Choose an action below to proceed with the session startup:'
      ].join('\n')
    },
    // 3. Action Row with buttons INSIDE the container
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 3, // Success Green
          label: 'Start Session',
          custom_id: `vote_host_start_${vote.id}`
        },
        {
          type: 2,
          style: 2, // Secondary Gray
          label: 'Postpone Session',
          custom_id: `vote_host_postpone_${vote.id}`
        }
      ]
    }
  ];

  // 4. Bottom Banner Image
  if (CONFIG.SESSION.VOTE_BOTTOM_BANNER_URL) {
    containerComponents.push({
      type: 12,
      items: [
        {
          media: {
            url: CONFIG.SESSION.VOTE_BOTTOM_BANNER_URL
          }
        }
      ]
    });
  }

  return {
    flags: 32768, // IS_COMPONENTS_V2
    components: [
      {
        type: 17, // Container
        accent_color: 689405, // Modern blue (#0a84fd)
        components: containerComponents
      }
    ]
  };
}



