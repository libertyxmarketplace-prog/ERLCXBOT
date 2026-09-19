import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} from 'discord.js';
import fs from 'fs';
import { CONFIG } from './config.js';
import { loadDeskData, isReportStaffDisabled } from './storage.js';

/**
 * Builds the ticket panel using Discord Components V2 Container (type 17):
 * - Banner at top (type 12)
 * - TextDisplay (type 10)
 * - Section (type 9) with blue Rules button touching the far right wall
 * - ActionRow (type 1) with General and Management buttons
 * - Bottom blue accent strip (type 12)
 */
export function buildTicketPanel(deskData = null) {
  const desk = deskData || loadDeskData();
  const disabledList = Array.isArray(desk?.disabledCategories) ? desk.disabledCategories : [];
  const isGeneralDisabled = disabledList.includes('general');
  const isManagementDisabled = disabledList.includes('management');

  const containerComponents = [
    // 1. Top Banner Image inside container
    {
      type: 12,
      items: [
        {
          media: {
            url: CONFIG.TOP_BANNER_URL
          }
        }
      ]
    },
    // 2. Title and Description inside container (no bullet dot)
    {
      type: 10,
      content: `## ${CONFIG.PANEL_TITLE}\n${CONFIG.PANEL_DESCRIPTION}`
    },
    // 3. Section with Blue Rules Button touching the far right wall
    {
      type: 9,
      components: [
        {
          type: 10,
          content: '**Please review ticket guidelines before opening.**'
        }
      ],
      accessory: {
        type: 2,
        style: 1, // Primary (Blue!)
        label: 'Rules',
        custom_id: 'ticket_btn_rules'
      }
    },
    // 4. Action Row with General & Management category buttons
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 2, // Secondary (Gray)
          label: isGeneralDisabled ? 'General (Closed)' : 'General',
          custom_id: 'ticket_btn_general',
          disabled: isGeneralDisabled
        },
        {
          type: 2,
          style: 2, // Secondary (Gray)
          label: isManagementDisabled ? 'Management (Closed)' : 'Management',
          custom_id: 'ticket_btn_management',
          disabled: isManagementDisabled
        }
      ]
    }
  ];

  // 5. Bottom blue accent strip inside container
  if (CONFIG.BOTTOM_BANNER_URL) {
    containerComponents.push({
      type: 12,
      items: [
        {
          media: {
            url: CONFIG.BOTTOM_BANNER_URL
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
        components: containerComponents
      }
    ]
  };
}

/**
 * Builds the rich rules embed displayed when a user clicks the blue Rules button.
 */
export function buildRulesEmbed() {
  const embed = new EmbedBuilder()
    .setTitle(CONFIG.RULES_CONTENT.title)
    .setDescription(CONFIG.RULES_CONTENT.description)
    .setFooter({
      text: "Orlando Roleplay • Rules verified. You may now select a category."
    })
    .setTimestamp();

  return {
    embeds: [embed],
    ephemeral: true
  };
}

/**
 * Builds the inside-ticket control card for staff onboarding and training using Components V2 Container:
 * - Top Banner inside at top
 * - Onboarding information, assigned position, reasons & next steps
 * - Claim, Close and Position pill controls
 */
export function buildTrainingTicketControl(ticketData) {
  const isClaimed = Boolean(ticketData.claimedBy);
  const handlerText = isClaimed ? `<@${ticketData.claimedBy}>` : 'None (Awaiting Management)';
  const statusText = isClaimed ? '**Claimed**' : '**Unclaimed**';
  const roleName = ticketData.role || 'Staff Member';

  const containerComponents = [
    // 1. Top Banner inside ticket container
    {
      type: 12,
      items: [
        {
          media: {
            url: CONFIG.TOP_BANNER_URL
          }
        }
      ]
    },
    // 2. Title and Onboarding Header
    {
      type: 10,
      content:
        `## Orlando Support | Staff Training & Onboarding\n` +
        `> Welcome <@${ticketData.authorId}> to the **Orlando Roleplay** staff team!\n` +
        `> This private onboarding channel has been prepared for your staff orientation and in-game training.`
    },
    // 3. Section with Green Accepted Status Pill
    {
      type: 9,
      components: [
        {
          type: 10,
          content:
            `**Appointed Staff Member**\n` +
            `• **Applicant:** <@${ticketData.authorId}> (\`${ticketData.authorTag || ticketData.authorId}\`)\n` +
            `• **Assigned Position:** **${roleName}**\n` +
            `• **Handler:** ${handlerText} (${statusText})`
        }
      ],
      accessory: {
        type: 2,
        style: 3, // Success Green
        label: 'Accepted',
        disabled: true,
        custom_id: 'ticket_training_status_pill'
      }
    },
    // 4. Ticket Purpose & Onboarding Reason
    {
      type: 10,
      content:
        `### Ticket Purpose & Onboarding Reason\n` +
        `> • **Primary Reason:** Staff Orientation, Permission Allocation & In-Game Patrol Training for **${roleName}**.\n` +
        (ticketData.reviewedBy ? `> • **Approved By:** <@${ticketData.reviewedBy}>\n` : '') +
        (ticketData.notes ? `> • **Management Notes:** ${ticketData.notes}\n` : '') +
        `\n### Next Steps & Instructions\n` +
        `> **1. Role & Permissions:** Management will assign your in-game & Discord staff permissions.\n` +
        `> **2. Staff Orientation:** A Management member will walk you through the staff guidelines and expectations.\n` +
        `> **3. Patrol Training:** Your practical in-game patrol training session will be scheduled directly here.\n\n` +
        `*Please reply below with your Roblox username and your availability for training.*`
    },
    // 5. Action Row with Claim, Close and Position Pill
    {
      type: 1,
      components: [
        isClaimed
          ? {
              type: 2,
              style: 2, // Secondary
              label: 'Unclaim',
              custom_id: 'ticket_unclaim'
            }
          : {
              type: 2,
              style: 3, // Success (Green)
              label: 'Claim',
              custom_id: 'ticket_claim'
            },
        {
          type: 2,
          style: 4, // Danger (Red)
          label: 'Close Ticket',
          custom_id: 'ticket_close_request'
        },
        {
          type: 2,
          style: 2, // Secondary Gray Pill
          label: roleName,
          disabled: true,
          custom_id: 'ticket_training_role_pill'
        }
      ]
    }
  ];

  // 6. Bottom Banner Accent Strip
  if (CONFIG.BOTTOM_BANNER_URL) {
    containerComponents.push({
      type: 12,
      items: [
        {
          media: {
            url: CONFIG.BOTTOM_BANNER_URL
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
        components: containerComponents
      }
    ]
  };
}

/**
 * Builds the ticket control panel using Discord Components V2 Container (type 17):
 * - Banner at top (type 12)
 * - Title without emdashes (Orlando Support | Category)
 * - Claim and Close buttons INSIDE the container
 */
export function buildTicketControl(ticketData) {
  if (ticketData?.category === 'training') {
    return buildTrainingTicketControl(ticketData);
  }

  const isClaimed = Boolean(ticketData.claimedBy);
  const handlerText = isClaimed ? `<@${ticketData.claimedBy}>` : 'None (Awaiting Staff)';
  const statusText = isClaimed ? '**Claimed**' : '**Unclaimed**';
  const reasonText = ticketData.reason ? ticketData.reason : '*No reason provided.*';

  const categoryName = ticketData.categoryLabel || 'Support';

  const containerComponents = [
    // 1. Top Banner inside ticket container
    {
      type: 12,
      items: [
        {
          media: {
            url: CONFIG.TOP_BANNER_URL
          }
        }
      ]
    },
    // 2. Ticket information without emdashes
    {
      type: 10,
      content: 
        `## Orlando Support | ${categoryName}\n` +
        `> Welcome <@${ticketData.authorId}>. Our support team has been notified.\n` +
        `> Please provide all relevant details regarding your inquiry while a staff member responds.\n\n` +
        `**Opened By:** <@${ticketData.authorId}> (${ticketData.authorTag})\n` +
        `**Assigned Handler:** ${handlerText}\n` +
        `**Status:** ${statusText}\n` +
        `**Reason:** ${reasonText}`
    },
    // 3. Action Row with Claim and Close buttons INSIDE the container
    {
      type: 1,
      components: [
        isClaimed
          ? {
              type: 2,
              style: 2, // Secondary
              label: 'Unclaim',
              custom_id: 'ticket_unclaim'
            }
          : {
              type: 2,
              style: 3, // Success (Green)
              label: 'Claim',
              custom_id: 'ticket_claim'
            },
        {
          type: 2,
          style: 4, // Danger (Red)
          label: 'Close',
          custom_id: 'ticket_close_request'
        }
      ]
    }
  ];

  // 4. Section with Red Report Staff Button on far right wall (Management tickets only, if enabled)
  if (ticketData.category === 'management' && !isReportStaffDisabled()) {
    containerComponents.push({
      type: 9, // Section
      components: [
        {
          type: 10,
          content: '**Reporting a staff member? Click here to file an official report.**'
        }
      ],
      accessory: {
        type: 2,
        style: 4, // Danger (Red!)
        label: 'Report Staff',
        custom_id: 'ticket_btn_report_staff'
      }
    });
  }

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

/**
 * Builds the close confirmation prompt.
 */
export function buildCloseConfirmation() {
  const confirmEmbed = new EmbedBuilder()
    .setTitle("Close Ticket Confirmation")
    .setDescription(
      "> Are you sure you want to close this ticket?\n" +
      "> Upon confirmation, an archive transcript will be generated and the channel will close in 5 seconds."
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_close_confirm')
      .setLabel('Confirm Close')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket_close_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    embeds: [confirmEmbed],
    components: [row]
  };
}

/**
 * Builds the closed ticket log embed for transcripts channel.
 */
export function buildTranscriptLogEmbed({
  channelName,
  channelId,
  authorId,
  authorTag,
  closedById,
  claimedById,
  openDuration,
  closeReason,
  transcriptUrl = null,
  bannerImage = null
}) {
  const embed = new EmbedBuilder()
    .setTitle(`Ticket Archive | #${channelName}`)
    .setDescription(
      `> Support inquiry channel has been closed and archived.\n` +
      `> Official transcript record generated and stored.`
    )
    .addFields(
      {
        name: "Ticket Author",
        value: `<@${authorId}> (${authorTag || 'User'})`,
        inline: true
      },
      {
        name: "Handled By",
        value: claimedById ? `<@${claimedById}>` : "Unclaimed",
        inline: true
      },
      {
        name: "Closed By",
        value: `<@${closedById}>`,
        inline: true
      },
      {
        name: "Channel Reference",
        value: `#${channelName} (\`${channelId}\`)`,
        inline: true
      },
      {
        name: "Duration",
        value: openDuration || 'N/A',
        inline: true
      },
      {
        name: "Status",
        value: "Archived",
        inline: true
      },
      {
        name: "Closure Reason",
        value: closeReason ? `>>> ${closeReason}` : ">>> No reason provided.",
        inline: false
      }
    )
    .setFooter({
      text: `Orlando Support Desk • ID: ${channelId}`
    })
    .setTimestamp();

  const finalBanner = bannerImage || CONFIG.BOTTOM_BANNER_URL;
  if (finalBanner) {
    embed.setImage(finalBanner);
  }

  const row = new ActionRowBuilder();

  if (transcriptUrl) {
    row.addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Open Transcript')
        .setURL(transcriptUrl)
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_edit_reason_${channelId}`)
      .setLabel('Edit Reason')
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

/**
 * Builds the official Welcome message and member count display button.
 */
export function buildWelcomePayload(member) {
  const memberCount = member.guild?.memberCount || 1;
  const content = `${CONFIG.WELCOME.WELCOME_EMOJI} Welcome to ${CONFIG.WELCOME.SERVER_NAME}, <@${member.id}>. Navigate the server through <#${CONFIG.WELCOME.NAVIGATE_CHANNEL_ID}>`;

  const memberBtn = new ButtonBuilder()
    .setCustomId('welcome_member_count')
    .setStyle(ButtonStyle.Secondary)
    .setLabel(`${memberCount.toLocaleString()} Members`)
    .setEmoji({ id: CONFIG.WELCOME.PEOPLE_EMOJI_ID, name: CONFIG.WELCOME.PEOPLE_EMOJI_NAME })
    .setDisabled(true);

  const row = new ActionRowBuilder().addComponents(memberBtn);

  return {
    content,
    components: [row]
  };
}

/**
 * Transforms normal Latin alphanumeric text into Mathematical Sans-Serif font (𝖳𝗁𝗂𝗌 𝖥𝗈𝗇𝗍).
 */
export function toSansSerif(text) {
  if (!text) return '';
  return text.replace(/[A-Za-z0-9]/g, char => {
    const code = char.charCodeAt(0);
    // A-Z -> U+1D5A0
    if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D5A0 + code - 65);
    // a-z -> U+1D5BA
    if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D5BA + code - 97);
    // 0-9 -> U+1D7E2
    if (code >= 48 && code <= 57) return String.fromCodePoint(0x1D7E2 + code - 48);
    return char;
  });
}

// Registered application command IDs by guild for authentic blue clickable slash command pills
const GUILD_COMMAND_MAPS = {
  // Guild 1: 1541210827967823955
  '1541210827967823955': {
    ticket: '1550289751058284544',
    add: '1550289751058284545',
    remove: '1550289751058284546',
    session: '1550289751058284547',
    purge: '1550292662727352423',
    say: '1550301620980686849',
    giveaway: '1550314106790350950',
    application: '1550444075444998165',
    commands: '1550686187792900147',
    refont: '1550686187792900149'
  },
  // Guild 2: 1530147023754367006
  '1530147023754367006': {
    ticket: '1550289749351211018',
    add: '1550289749351211019',
    remove: '1550289749351211020',
    session: '1550289749351211021',
    purge: '1550292659447529532',
    say: '1550301619864731788',
    giveaway: '1550314105728929852',
    application: '1550444074023260240',
    commands: '1550686186178216078',
    refont: '1550686186178216080'
  }
};

/**
 * Resolves a clickable blue slash command mention string </name subcommand:id>.
 */
export function getCommandMention(client, name, subcommand = '', guildId = null) {
  let cmdId = null;

  // 1. Direct guild lookup from known ID maps
  if (guildId && GUILD_COMMAND_MAPS[guildId]) {
    cmdId = GUILD_COMMAND_MAPS[guildId][name];
  }

  // 2. Client guild cache lookup
  if (!cmdId && guildId && client?.guilds?.cache?.has(guildId)) {
    const guild = client.guilds.cache.get(guildId);
    const found = guild.commands?.cache?.find(c => c.name === name);
    if (found) cmdId = found.id;
  }

  // 3. Client global application commands cache
  if (!cmdId && client?.application?.commands?.cache) {
    const found = client.application.commands.cache.find(c => c.name === name);
    if (found) cmdId = found.id;
  }

  // 4. Fallback defaults (prioritizing 1541210827967823955)
  if (!cmdId) {
    cmdId = GUILD_COMMAND_MAPS['1541210827967823955']?.[name] || GUILD_COMMAND_MAPS['1530147023754367006']?.[name];
  }

  if (subcommand) {
    return `</${name} ${subcommand}:${cmdId || '0'}>`;
  }
  return `</${name}:${cmdId || '0'}>`;
}

/**
 * Builds the remodeled /commands directory with clickable blue slash command pills,
 * bottom banner image, and clean gray arrow pagination.
 */
export function buildCommandsDirectoryPayload(client, page = 0, guildId = null) {
  const totalPages = 4;
  const safePage = Math.max(0, Math.min(totalPages - 1, page));

  const leftEmojiId = CONFIG.APPLICATIONS?.ARROW_LEFT_EMOJI_ID || '1550446757396348958';
  const rightEmojiId = CONFIG.APPLICATIONS?.ARROW_RIGHT_EMOJI_ID || '1550446417376448593';

  const categoryTitles = [
    'Support Desk & Ticket Operations',
    'ER:LC Live Sessions & Announcements',
    'Community Giveaways & Applications',
    'Voice Channel Music & System Utilities'
  ];

  let pageContent = '';

  if (safePage === 0) {
    pageContent = [
      `### ${categoryTitles[0]}`,
      `> Complete command suite for support desk management, transcripts, and tickets.\n`,
      `• ${getCommandMention(client, 'ticket', 'panel', guildId)} • Deploy the live auto-updating ticket panel`,
      `• ${getCommandMention(client, 'ticket', 'status', guildId)} • Update operational status (\`online\`, \`busy\`, \`closed\`)`,
      `• ${getCommandMention(client, 'ticket', 'category', guildId)} • Toggle individual categories on or off`,
      `• ${getCommandMention(client, 'ticket', 'close', guildId)} • Archive ticket, dispatch HTML transcript, and log`,
      `• ${getCommandMention(client, 'ticket', 'claim', guildId)} • Claim active ticket as assigned staff handler`,
      `• ${getCommandMention(client, 'ticket', 'unclaim', guildId)} • Return ticket to public staff queue`,
      `• ${getCommandMention(client, 'ticket', 'add', guildId)} • Grant a user access to the ticket channel`,
      `• ${getCommandMention(client, 'ticket', 'remove', guildId)} • Revoke a user's ticket channel access`,
      `• ${getCommandMention(client, 'ticket', 'rename', guildId)} • Rename current ticket channel`,
      `• ${getCommandMention(client, 'purge', '', guildId)} • Bulk-delete messages in a channel`,
      `• ${getCommandMention(client, 'say', '', guildId)} • Dispatch clean staff announcements\n`,
      `**Quick Prefix Commands:**`,
      `> \`-close [reason]\` • Fast-close ticket with mandatory transcript`,
      `> \`-open\` • Reopen or unlock a closed ticket channel`
    ].join('\n');
  } else if (safePage === 1) {
    pageContent = [
      `### ${categoryTitles[1]}`,
      `> Real-time private server session announcements, polling, and voting.\n`,
      `• ${getCommandMention(client, 'session', 'startup', guildId)} • Announce server session startup with join code & VC`,
      `• ${getCommandMention(client, 'session', 'shutdown', guildId)} • Announce official session shutdown & closure`,
      `• ${getCommandMention(client, 'session', 'cancel', guildId)} • Cancel pending session countdown with reason`,
      `• ${getCommandMention(client, 'session', 'delay', guildId)} • Postpone session start time with custom countdown`,
      `• ${getCommandMention(client, 'session', 'setcode', guildId)} • Update in-game ER:LC private server join code`,
      `• ${getCommandMention(client, 'session', 'vote', guildId)} • Launch interactive community session quorum vote`,
      `• ${getCommandMention(client, 'session', 'panel', guildId)} • Deploy live auto-updating server stats embed`,
      `• ${getCommandMention(client, 'session', 'post', guildId)} • Dispatch raw session information banner\n`,
      `**Quick Prefix Commands:**`,
      `> \`-startup [code] [vc]\` • Quick-start live patrol session`,
      `> \`-shutdown\` • Conclude session and log closure`,
      `> \`-cancel [reason]\` • Cancel active session countdown`,
      `> \`-delay <duration>\` • Postpone session startup`
    ].join('\n');
  } else if (safePage === 2) {
    pageContent = [
      `### ${categoryTitles[2]}`,
      `> Automated giveaways with DM notifications and full staff application evaluation.\n`,
      `• ${getCommandMention(client, 'giveaway', 'start', guildId)} • Start a clean modern giveaway`,
      `• ${getCommandMention(client, 'giveaway', 'end', guildId)} • End giveaway, pick winners, and send winner DMs`,
      `• ${getCommandMention(client, 'giveaway', 'reroll', guildId)} • Reroll new winner(s) with automated winner DMs\n`,
      `• ${getCommandMention(client, 'application', 'panel', guildId)} • Deploy official staff application panel`,
      `• ${getCommandMention(client, 'application', 'setreview', guildId)} • Set staff application evaluation channel\n`,
      `**Giveaway Prefix Commands:**`,
      `> \`-gstart <time> <winners> [@role] <prize>\` • Start giveaway`,
      `> \`-gend [id/keyword]\` • End giveaway immediately`,
      `> \`-greroll [id/keyword]\` • Reroll giveaway winner`
    ].join('\n');
  } else if (safePage === 3) {
    pageContent = [
      `### ${categoryTitles[3]}`,
      `> High-fidelity voice channel music playback and utility formatting tools.\n`,
      `• ${getCommandMention(client, 'commands', '', guildId)} • Display this interactive command directory`,
      `• ${getCommandMention(client, 'refont', '', guildId)} • Convert text into Mathematical Sans-Serif font\n`,
      `**Voice Channel Music Commands:**`,
      `> \`-join\` • Summon bot into your current voice channel`,
      `> \`-play <url or search query>\` • Stream YouTube / web audio`,
      `> \`-volume <1-100>\` • Adjust audio playback volume level`,
      `> \`-pause\` • Pause current playing track`,
      `> \`-resume\` • Resume paused track`,
      `> \`-replay\` • Restart current playing song from start`,
      `> \`-loop\` • Toggle loop mode for the current track`,
      `> \`-leave\` • Stop music and disconnect from voice\n`,
      `**Font Formatting Prefix:**`,
      `> \`-refont <text>\` • Automatically outputs in \`𝖳𝗁𝗂𝗌 𝖥𝗈𝗇𝗍\``
    ].join('\n');
  }

  const embed = new EmbedBuilder()
    .setColor(0x2B6CB0)
    .setTitle('Orlando Roleplay — Command Directory')
    .setDescription(
      `> **Section ${safePage + 1} of ${totalPages}** • **${categoryTitles[safePage]}**\n` +
      `> Click any blue command mention below to trigger it directly in Discord!\n\n` +
      pageContent
    )
    .setFooter({
      text: `Orlando Roleplay Systems • Page ${safePage + 1} of ${totalPages}`
    });

  const bannerPath = './assets/bottom-banner.png';
  let bannerFile = null;
  if (fs.existsSync(bannerPath)) {
    bannerFile = new AttachmentBuilder(bannerPath, { name: 'bottom-banner.png' });
    embed.setImage('attachment://bottom-banner.png');
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cmd_page_prev_${safePage}`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(leftEmojiId)
      .setDisabled(safePage === 0),
    new ButtonBuilder()
      .setCustomId('cmd_page_info')
      .setStyle(ButtonStyle.Secondary)
      .setLabel(`Page ${safePage + 1} of ${totalPages}`)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`cmd_page_next_${safePage}`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(rightEmojiId)
      .setDisabled(safePage === totalPages - 1)
  );

  return {
    embeds: [embed],
    components: [row],
    files: bannerFile ? [bannerFile] : []
  };
}

