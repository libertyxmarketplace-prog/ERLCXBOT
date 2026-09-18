import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
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
 * Builds the inside-ticket control card using Components V2 Container:
 * - Top Banner inside at top
 * - Title without emdashes (Orlando Support | Category)
 * - Claim and Close buttons INSIDE the container
 */
export function buildTicketControl(ticketData) {
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
