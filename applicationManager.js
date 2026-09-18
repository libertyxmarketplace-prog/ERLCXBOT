import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { CONFIG } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APPLICATIONS_FILE = path.join(__dirname, 'data', 'applications.json');

const ACCENT_COLOR = 0x0a84fd;

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
    console.error(`Error writing ${filePath}:`, err);
  }
}

export function loadApplicationsData() {
  return readJsonFile(APPLICATIONS_FILE, {
    submissions: {},
    activeSessions: {},
    openPositions: {
      ingame_mod: true,
      discord_mod: true
    },
    reviewChannelId: CONFIG.APPLICATIONS?.REVIEW_CHANNEL_ID || '1550446015859925012'
  });
}

export function saveApplicationsData(data) {
  writeJsonFile(APPLICATIONS_FILE, data);
}

export function isPositionOpen(role) {
  const store = loadApplicationsData();
  if (!store.openPositions) return true;
  return store.openPositions[role] !== false;
}

export function setPositionOpen(role, isOpen) {
  const store = loadApplicationsData();
  if (!store.openPositions) store.openPositions = { ingame_mod: true, discord_mod: true };
  store.openPositions[role] = isOpen;
  saveApplicationsData(store);
}

export function setAllPositionsOpen(isOpen) {
  const store = loadApplicationsData();
  store.openPositions = {
    ingame_mod: isOpen,
    discord_mod: isOpen
  };
  saveApplicationsData(store);
}

export function getActiveSession(userId) {
  const store = loadApplicationsData();
  return store.activeSessions?.[userId] || null;
}

export function setActiveSession(userId, session) {
  const store = loadApplicationsData();
  if (!store.activeSessions) store.activeSessions = {};
  store.activeSessions[userId] = session;
  saveApplicationsData(store);
}

export function removeActiveSession(userId) {
  const store = loadApplicationsData();
  if (store.activeSessions) {
    delete store.activeSessions[userId];
    saveApplicationsData(store);
  }
}

export function saveSubmission(submission) {
  const store = loadApplicationsData();
  if (!store.submissions) store.submissions = {};
  store.submissions[submission.id] = submission;
  saveApplicationsData(store);
}

export function getSubmission(submissionId) {
  const store = loadApplicationsData();
  return store.submissions?.[submissionId] || null;
}

export function updateSubmission(submissionId, updates) {
  const store = loadApplicationsData();
  if (store.submissions?.[submissionId]) {
    store.submissions[submissionId] = {
      ...store.submissions[submissionId],
      ...updates
    };
    saveApplicationsData(store);
    return store.submissions[submissionId];
  }
  return null;
}

export function setReviewChannel(channelId) {
  const store = loadApplicationsData();
  store.reviewChannelId = channelId;
  saveApplicationsData(store);
}

export function getReviewChannelId() {
  const store = loadApplicationsData();
  return store.reviewChannelId || CONFIG.APPLICATIONS?.REVIEW_CHANNEL_ID || '1550446015859925012';
}

export function setResultsChannel(channelId) {
  const store = loadApplicationsData();
  store.resultsChannelId = channelId;
  saveApplicationsData(store);
}

export function getResultsChannelId() {
  const store = loadApplicationsData();
  return store.resultsChannelId || CONFIG.APPLICATIONS?.RESULTS_CHANNEL_ID || '1550413729013829725';
}

export function getRoleDisplayName(role) {
  if (role === 'ingame_mod') return 'In-Game Moderator';
  if (role === 'discord_mod') return 'Discord Moderator';
  return 'Staff Member';
}

/* ========================================================================== */
/*                         PUBLIC APPLICATION PANEL                           */
/* ========================================================================== */

/**
 * Builds the official Application Panel using Discord Components V2 Container
 * featuring the top banner and String Select Menu (strictly no emojis).
 */
export function buildApplicationPanel() {
  const bannerPath = path.join(__dirname, 'assets', 'applications_banner.png');
  const files = [];

  let topBannerMediaUrl = CONFIG.APPLICATIONS?.TOP_BANNER_URL || null;
  if (fs.existsSync(bannerPath)) {
    files.push(new AttachmentBuilder(bannerPath, { name: 'applications_banner.png' }));
    topBannerMediaUrl = 'attachment://applications_banner.png';
  }

  const isIngameOpen = isPositionOpen('ingame_mod');
  const isDiscordOpen = isPositionOpen('discord_mod');

  const containerComponents = [];

  // 1. Top Banner
  if (topBannerMediaUrl) {
    containerComponents.push({
      type: 12,
      items: [
        {
          media: {
            url: topBannerMediaUrl
          }
        }
      ]
    });
  }

  // 2. Title and Clean Content (No Emojis)
  containerComponents.push({
    type: 10,
    content:
      `## Orlando Roleplay | Staff Application\n` +
      `> Welcome to the official Orlando Roleplay Staff Application portal.\n` +
      `> Holding a staff position is a privilege that requires consistent activity, professionalism, and accountability. As a staff member, you represent Orlando Roleplay at all times.\n\n` +
      `### Application Requirements\n` +
      `> • Must be at least 14 years of age.\n` +
      `> • Discord and Roblox accounts must be at least 30 days old.\n` +
      `> • Working microphone with willingness to communicate verbally.\n` +
      `> • Minimum sentence requirements must be met; low effort answers are rejected.\n` +
      `> • The use of AI is strictly prohibited and results in a permanent blacklist.\n\n` +
      `### Select Your Position\n` +
      `> Choose your desired staff position from the dropdown menu below to begin.`
  });

  // 3. String Select Menu (NO EMOJIS)
  containerComponents.push({
    type: 1,
    components: [
      {
        type: 3,
        custom_id: 'application_select_role',
        placeholder: 'Select a Staff Position to Apply For...',
        options: [
          {
            label: isIngameOpen ? 'In-Game Moderator' : 'In-Game Moderator (Closed)',
            value: 'ingame_mod',
            description: isIngameOpen
              ? 'Supervise live ER:LC sessions, answer mod calls, enforce in-game rules.'
              : 'In-Game Moderator applications are currently closed.'
          },
          {
            label: isDiscordOpen ? 'Discord Moderator' : 'Discord Moderator (Closed)',
            value: 'discord_mod',
            description: isDiscordOpen
              ? 'Moderate Discord text channels, assist support tickets, maintain order.'
              : 'Discord Moderator applications are currently closed.'
          }
        ]
      }
    ]
  });

  // 4. Bottom Banner
  if (CONFIG.SESSION?.BOTTOM_BANNER_URL) {
    containerComponents.push({
      type: 12,
      items: [
        {
          media: {
            url: CONFIG.SESSION.BOTTOM_BANNER_URL
          }
        }
      ]
    });
  }

  return {
    flags: 32768,
    components: [
      {
        type: 17,
        components: containerComponents
      }
    ],
    files
  };
}

/* ========================================================================== */
/*               DM APPLICATION DASHBOARD (COMPONENTS V2 CONTAINER)          */
/* ========================================================================== */

/**
 * Builds the DM Hub using Discord Components V2 Container (type 17).
 * - Application banner is placed at the VERY TOP.
 * - Text inside.
 * - Buttons are INSIDE the container card.
 * - Module 1 button is GRAY (style 2).
 * - When a module is done, it turns GREEN (style 3).
 * - Submit Application and Cancel Application ONLY appear when Step 4 is finished!
 */
export function buildApplicationHubMessage(session) {
  const roleName = getRoleDisplayName(session.role);
  const bannerPath = path.join(__dirname, 'assets', 'applications_banner.png');
  const files = [];

  let topBannerMediaUrl = 'attachment://applications_banner.png';
  if (fs.existsSync(bannerPath)) {
    files.push(new AttachmentBuilder(bannerPath, { name: 'applications_banner.png' }));
  }

  const mod1Done = Boolean(session.modules?.mod1);
  const mod2Done = Boolean(session.modules?.mod2);
  const mod3Done = Boolean(session.modules?.mod3);
  const mod4Done = Boolean(session.modules?.mod4);
  const allDone = mod1Done && mod2Done && mod3Done && mod4Done;

  const containerComponents = [];

  // 1. Top Banner (At the very top!)
  containerComponents.push({
    type: 12,
    items: [
      {
        media: {
          url: topBannerMediaUrl
        }
      }
    ]
  });

  // 2. Title & Description
  containerComponents.push({
    type: 10,
    content:
      `## Orlando Roleplay | ${roleName} Application\n` +
      `> Welcome to the official **Orlando Roleplay Staff Application**.\n` +
      `> Holding a staff position is a privilege requiring consistent activity and professionalism.\n\n` +
      `### Module Progress\n` +
      `> 1. Rules & Requirements: **${mod1Done ? 'Completed' : 'Ready'}**\n` +
      `> 2. General Information: **${mod2Done ? 'Completed' : mod1Done ? 'Ready' : 'Locked'}**\n` +
      `> 3. Core Knowledge: **${mod3Done ? 'Completed' : mod2Done ? 'Ready' : 'Locked'}**\n` +
      `> 4. Realistic Scenarios: **${mod4Done ? 'Completed' : mod3Done ? 'Ready' : 'Locked'}**\n\n` +
      (allDone
        ? `All modules have been completed! Review your answers and click **Submit Application** below to finish.`
        : `Click on the next available module button below to fill in your responses.`)
  });

  // 3. Module Buttons Row (INSIDE container)
  // Rules & Requirements is Gray (style: 2) initially, Green (style: 3) once completed!
  containerComponents.push({
    type: 1,
    components: [
      {
        type: 2,
        style: mod1Done ? 3 : 2, // 3 = Green (Done), 2 = Gray
        label: mod1Done ? 'Rules & Requirements (Done)' : '1. Rules & Requirements',
        custom_id: 'app_mod_btn_1'
      },
      {
        type: 2,
        style: mod2Done ? 3 : 2,
        label: mod2Done ? 'General Information (Done)' : '2. General Information',
        custom_id: 'app_mod_btn_2',
        disabled: !mod1Done
      },
      {
        type: 2,
        style: mod3Done ? 3 : 2,
        label: mod3Done ? 'Core Knowledge (Done)' : '3. Core Knowledge',
        custom_id: 'app_mod_btn_3',
        disabled: !mod2Done
      },
      {
        type: 2,
        style: mod4Done ? 3 : 2,
        label: mod4Done ? 'Realistic Scenarios (Done)' : '4. Realistic Scenarios',
        custom_id: 'app_mod_btn_4',
        disabled: !mod3Done
      }
    ]
  });

  // 4. Submit & Cancel Row (ONLY APPEARS WHEN USER FINISHES STEP 4!)
  if (allDone) {
    containerComponents.push({
      type: 1,
      components: [
        {
          type: 2,
          style: 2, // Secondary Gray (as requested!)
          label: 'Submit Application',
          custom_id: 'app_submit'
        },
        {
          type: 2,
          style: 4, // Danger Red
          label: 'Cancel Application',
          custom_id: 'app_cancel'
        }
      ]
    });
  }

  // 5. Bottom accent strip
  if (CONFIG.SESSION?.BOTTOM_BANNER_URL) {
    containerComponents.push({
      type: 12,
      items: [
        {
          media: {
            url: CONFIG.SESSION.BOTTOM_BANNER_URL
          }
        }
      ]
    });
  }

  return {
    flags: 32768,
    components: [
      {
        type: 17,
        components: containerComponents
      }
    ],
    files
  };
}

/* ========================================================================== */
/*                MODAL BUILDERS (LABELS STRICTLY <= 45 CHARACTERS)           */
/* ========================================================================== */

/**
 * Module 1 Modal: Rules & Requirements
 * Every label is strictly <= 45 chars to prevent "Invalid string length" error!
 */
export function buildModule1Modal(session) {
  const modal = new ModalBuilder()
    .setCustomId('modal_app_mod_1')
    .setTitle('1. Rules & Requirements');

  if (session.role === 'ingame_mod') {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('rule_regulations')
          .setLabel('Read In-Game & Discord Regulations?') // 36 chars
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Type "Yes" or "No"')
          .setValue(session.answers?.rule_regulations || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('current_age')
          .setLabel('Current Age (Must be 14 or older)') // 33 chars
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Enter your current age')
          .setValue(session.answers?.current_age || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('functional_mic')
          .setLabel('Working Microphone for Voice Duties?') // 36 chars
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Type "Yes" or "No"')
          .setValue(session.answers?.functional_mic || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('recording_software')
          .setLabel('Recording Software (OBS/Medal/GeForce)?') // 40 chars
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Type "Yes" or "No"')
          .setValue(session.answers?.recording_software || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('urgent_availability')
          .setLabel('Urgent Availability Outside Shift Hours?') // 40 chars
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Yes / No / Dependent on availability')
          .setValue(session.answers?.urgent_availability || '')
          .setRequired(true)
      )
    );
  } else {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('rule_regulations')
          .setLabel('Read Discord Guidelines & Terms of Service?') // 43 chars
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Type "Yes" or "No"')
          .setValue(session.answers?.rule_regulations || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('current_age')
          .setLabel('Current Age (Must be 14 or older)') // 33 chars
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Enter your current age')
          .setValue(session.answers?.current_age || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('functional_mic')
          .setLabel('Working Microphone for Staff Meetings?') // 38 chars
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Type "Yes" or "No"')
          .setValue(session.answers?.functional_mic || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('timezone')
          .setLabel('Your Timezone') // 13 chars
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. EST, CST, GMT, PST')
          .setValue(session.answers?.timezone || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('weekly_schedule')
          .setLabel('Weekly Schedule & Available Mod Hours') // 37 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Days of week, active hours, estimated weekly time')
          .setValue(session.answers?.weekly_schedule || '')
          .setRequired(true)
      )
    );
  }

  return modal;
}

/**
 * Module 2 Modal: General Information
 * Every label is strictly <= 45 chars to prevent "Invalid string length" error!
 */
export function buildModule2Modal(session) {
  const modal = new ModalBuilder()
    .setCustomId('modal_app_mod_2')
    .setTitle('2. General Information');

  if (session.role === 'ingame_mod') {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('roblox_profile')
          .setLabel('Roblox Username & Roblox User ID') // 32 chars
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. Username (123456789)')
          .setValue(session.answers?.roblox_profile || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('schedule_timezone')
          .setLabel('Timezone & Weekly Availability') // 30 chars
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. EST, 15 hrs/week, Mon-Fri 4-9 PM')
          .setValue(session.answers?.schedule_timezone || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('background_erlc')
          .setLabel('ER:LC Background & Interests (3 Sentences)') // 42 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Minimum of 3 complete sentences about your background')
          .setValue(session.answers?.background_erlc || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('previous_history')
          .setLabel('Past Moderation History (4 Sentences)') // 37 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Servers, highest rank, departure reason, skills gained')
          .setValue(session.answers?.previous_history || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('why_orlando')
          .setLabel('Why Orlando Roleplay? (4 Sentences)') // 35 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Why choose Orlando RP and what sets you apart')
          .setValue(session.answers?.why_orlando || '')
          .setRequired(true)
      )
    );
  } else {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('motivation')
          .setLabel('Motivation for Orlando Staff (3 Sentences)') // 42 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Why you want to moderate Orlando Discord')
          .setValue(session.answers?.motivation || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('discord_exp')
          .setLabel('Past Discord Mod History & Bots (4 Sentences)') // 44 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Servers, ranks, Carl, Dyno, AutoMod experience')
          .setValue(session.answers?.discord_exp || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('candidate_strengths')
          .setLabel('Unique Traits & Assets (4 Sentences)') // 36 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Patience, de-escalation, communication skills')
          .setValue(session.answers?.candidate_strengths || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('handling_bias')
          .setLabel('Handling Bias & Impartiality (4 Sentences)') // 42 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('How you handle friends violating rules')
          .setValue(session.answers?.handling_bias || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('prior_infractions')
          .setLabel('Prior Disciplinary History (3 Sentences)') // 39 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Warns, mutes, kicks, bans received and lessons learned')
          .setValue(session.answers?.prior_infractions || '')
          .setRequired(true)
      )
    );
  }

  return modal;
}

/**
 * Module 3 Modal: Core Knowledge
 * Every label is strictly <= 45 chars to prevent "Invalid string length" error!
 */
export function buildModule3Modal(session) {
  const modal = new ModalBuilder()
    .setCustomId('modal_app_mod_3')
    .setTitle('3. Core Knowledge');

  if (session.role === 'ingame_mod') {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('def_frp')
          .setLabel('Define FailRP & Actions (3 Sentences)') // 37 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Scenario example and corrective actions you would take')
          .setValue(session.answers?.def_frp || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('def_rdm_vdm')
          .setLabel('Define RDM & VDM + Evidence (3 Sentences)') // 41 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Definitions and required evidentiary threshold')
          .setValue(session.answers?.def_rdm_vdm || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('def_meta_power')
          .setLabel('Define Metagaming & Powergaming (3 Sentences)') // 44 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Provide in-game examples of each and resolution')
          .setValue(session.answers?.def_meta_power || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('def_nlr_ltarp')
          .setLabel('Define NLR & LTARP vs LTAP (3 Sentences)') // 40 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Respawn rules and difference in severity')
          .setValue(session.answers?.def_nlr_ltarp || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('key_commands')
          .setLabel('Key Commands (:h, :m, :pm, vehicle, mute)') // 41 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Explain what each command does and when to use it')
          .setValue(session.answers?.key_commands || '')
          .setRequired(true)
      )
    );
  } else {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('scenario_toxicity')
          .setLabel('Toxic Arguments in Chat (3 Sentences)') // 37 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Step-by-step de-escalation procedure')
          .setValue(session.answers?.scenario_toxicity || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('scenario_raid')
          .setLabel('Mass-Ping Raid Containment (3 Sentences)') // 40 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Immediate lockdown and cleanup actions')
          .setValue(session.answers?.scenario_raid || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('scenario_automod_bypass')
          .setLabel('Automod Bypass Handling (3 Sentences)') // 37 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Detection, documentation, and punishment steps')
          .setValue(session.answers?.scenario_automod_bypass || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('scenario_ticket_dispute')
          .setLabel('Ticket Accusing Staff (3 Sentences)') // 35 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('How you handle ticket complaints professionally')
          .setValue(session.answers?.scenario_ticket_dispute || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('scenario_banter')
          .setLabel('Banter vs Real Harassment (3 Sentences)') // 39 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Where you draw the line and when to intervene')
          .setValue(session.answers?.scenario_banter || '')
          .setRequired(true)
      )
    );
  }

  return modal;
}

/**
 * Module 4 Modal: Realistic Scenarios
 * Every label is strictly <= 45 chars to prevent "Invalid string length" error!
 */
export function buildModule4Modal(session) {
  const modal = new ModalBuilder()
    .setCustomId('modal_app_mod_4')
    .setTitle('4. Realistic Scenarios');

  if (session.role === 'ingame_mod') {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('scenario_mod_parking')
          .setLabel('Where to park before !mod? (2 Sentences)') // 40 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Vehicle positioning before answering requests')
          .setValue(session.answers?.scenario_mod_parking || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('scenario_rdm_dispute')
          .setLabel('Unproven RDM Investigation (4 Sentences)') // 40 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Investigation procedure when neither has video proof')
          .setValue(session.answers?.scenario_rdm_dispute || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('scenario_exploits')
          .setLabel('Exploiter Response Protocol (3 Sentences)') // 41 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Verification to punishment logging steps')
          .setValue(session.answers?.scenario_exploits || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('scenario_staff_abuse')
          .setLabel('Colleague Command Abuse (4 Sentences)') // 37 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Handling discretely without causing a public scene')
          .setValue(session.answers?.scenario_staff_abuse || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('verification_affirmation')
          .setLabel('Affirmation: No AI & all info is true') // 38 chars
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Type "Yes, I agree"')
          .setValue(session.answers?.verification_affirmation || '')
          .setRequired(true)
      )
    );
  } else {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('protocol_punishments')
          .setLabel('Sanction Progression (3 Sentences)') // 34 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Progression: Warn, Mute, Kick, Ban and escalation')
          .setValue(session.answers?.protocol_punishments || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('protocol_selfpromo')
          .setLabel('Unauthorized Self-Promo (2 Sentences)') // 37 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('How you handle unauthorized promotional links')
          .setValue(session.answers?.protocol_selfpromo || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('scenario_ticket_heated')
          .setLabel('Heated Ticket Conversations (3 Sentences)') // 41 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Maintaining professional decorum under pressure')
          .setValue(session.answers?.scenario_ticket_heated || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('scenario_incident_escalation')
          .setLabel('Critical Incident Escalation (3 Sentences)') // 42 chars
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('When and how you alert Upper Management')
          .setValue(session.answers?.scenario_incident_escalation || '')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('verification_affirmation')
          .setLabel('Affirmation: No AI & all info is true') // 38 chars
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Type "Yes, I agree"')
          .setValue(session.answers?.verification_affirmation || '')
          .setRequired(true)
      )
    );
  }

  return modal;
}

/* ========================================================================== */
/*                 STAFF REVIEW CARD WITH ARROW PAGINATION                    */
/* ========================================================================== */

/**
 * Builds the staff review card with arrow pagination (strictly using the two arrow emojis).
 */
export function buildStaffReviewCard(submission, page = 0) {
  const roleName = getRoleDisplayName(submission.role);
  const totalPages = 4;
  const safePage = Math.max(0, Math.min(totalPages - 1, page));

  const statusColors = {
    pending: ACCENT_COLOR,
    approved: 0x22c55e,
    denied: 0xef4444
  };

  const statusLabels = {
    pending: 'PENDING REVIEW',
    approved: `APPROVED by <@${submission.reviewedBy}>`,
    denied: `DENIED by <@${submission.reviewedBy}>`
  };

  const pageTitles = [
    'Page 1: Rules & Requirements',
    'Page 2: General Information',
    'Page 3: Core Knowledge',
    'Page 4: Realistic Scenarios'
  ];

  const embed = new EmbedBuilder()
    .setColor(statusColors[submission.status] || ACCENT_COLOR)
    .setAuthor({
      name: `Staff Application Review • ${roleName}`,
      iconURL: submission.userAvatar || undefined
    })
    .setTitle(`Application #${submission.id.slice(0, 8).toUpperCase()} — ${submission.userTag}`)
    .setDescription(
      `**Applicant:** <@${submission.userId}> (${submission.userTag})\n` +
      `**User ID:** \`${submission.userId}\`\n` +
      `**Role Applied:** **${roleName}**\n` +
      `**Submitted:** <t:${Math.floor(submission.submittedAt / 1000)}:f> (<t:${Math.floor(submission.submittedAt / 1000)}:R>)\n` +
      `**Status:** ${statusLabels[submission.status] || submission.status.toUpperCase()}\n` +
      (submission.notes ? `**Staff Notes:** ${submission.notes}\n` : '') +
      `\n### ${pageTitles[safePage]}`
    )
    .setFooter({
      text: `Orlando Staff Applications • Page ${safePage + 1} of ${totalPages} • ID: ${submission.id.slice(0, 8)}`
    })
    .setTimestamp();

  const ans = submission.answers || {};

  // Build fields for current page
  if (safePage === 0) {
    if (submission.role === 'ingame_mod') {
      embed.addFields(
        { name: 'Read In-Game & Discord Regulations?', value: ans.rule_regulations || 'N/A', inline: true },
        { name: 'Age', value: ans.current_age || 'N/A', inline: true },
        { name: 'Working Microphone?', value: ans.functional_mic || 'N/A', inline: true },
        { name: 'Recording Software?', value: ans.recording_software || 'N/A', inline: true },
        { name: 'Emergency Availability?', value: ans.urgent_availability || 'N/A', inline: true }
      );
    } else {
      embed.addFields(
        { name: 'Read Guidelines & Terms?', value: ans.rule_regulations || 'N/A', inline: true },
        { name: 'Age', value: ans.current_age || 'N/A', inline: true },
        { name: 'Working Microphone?', value: ans.functional_mic || 'N/A', inline: true },
        { name: 'Timezone', value: ans.timezone || 'N/A', inline: true },
        { name: 'Weekly Schedule & Availability', value: ans.weekly_schedule || 'N/A', inline: false }
      );
    }
  } else if (safePage === 1) {
    if (submission.role === 'ingame_mod') {
      embed.addFields(
        { name: 'Roblox Profile', value: ans.roblox_profile || 'N/A', inline: true },
        { name: 'Timezone & Availability', value: ans.schedule_timezone || 'N/A', inline: true },
        { name: 'About Yourself & ER:LC Background', value: ans.background_erlc || 'N/A', inline: false },
        { name: 'Previous Moderation History', value: ans.previous_history || 'N/A', inline: false },
        { name: 'Why Orlando Roleplay Specifically?', value: ans.why_orlando || 'N/A', inline: false }
      );
    } else {
      embed.addFields(
        { name: 'Motivation for Orlando Discord', value: ans.motivation || 'N/A', inline: false },
        { name: 'Previous Discord Experience & Bots', value: ans.discord_exp || 'N/A', inline: false },
        { name: 'Unique Traits & Assets', value: ans.candidate_strengths || 'N/A', inline: false },
        { name: 'Handling Bias & Impartiality', value: ans.handling_bias || 'N/A', inline: false },
        { name: 'Prior Infractions History', value: ans.prior_infractions || 'N/A', inline: false }
      );
    }
  } else if (safePage === 2) {
    if (submission.role === 'ingame_mod') {
      embed.addFields(
        { name: 'FailRP Definition & Corrective Actions', value: ans.def_frp || 'N/A', inline: false },
        { name: 'RDM & VDM + Evidentiary Standards', value: ans.def_rdm_vdm || 'N/A', inline: false },
        { name: 'Metagaming & Powergaming Examples', value: ans.def_meta_power || 'N/A', inline: false },
        { name: 'NLR & LTARP vs LTAP', value: ans.def_nlr_ltarp || 'N/A', inline: false },
        { name: 'Key Admin Commands Proficiency', value: ans.key_commands || 'N/A', inline: false }
      );
    } else {
      embed.addFields(
        { name: 'Handling Toxic Arguments in Chat', value: ans.scenario_toxicity || 'N/A', inline: false },
        { name: 'Mass-Ping Raid & Phishing Containment', value: ans.scenario_raid || 'N/A', inline: false },
        { name: 'Automod Bypass & Hidden Toxicity', value: ans.scenario_automod_bypass || 'N/A', inline: false },
        { name: 'Ticket Dispute & Abuse Allegation', value: ans.scenario_ticket_dispute || 'N/A', inline: false },
        { name: 'Banter vs Real Harassment Distinction', value: ans.scenario_banter || 'N/A', inline: false }
      );
    }
  } else if (safePage === 3) {
    if (submission.role === 'ingame_mod') {
      embed.addFields(
        { name: 'Mod Call Parking Location & Protocol', value: ans.scenario_mod_parking || 'N/A', inline: false },
        { name: 'Unproven RDM Investigation Procedure', value: ans.scenario_rdm_dispute || 'N/A', inline: false },
        { name: 'Exploiter Response Protocol', value: ans.scenario_exploits || 'N/A', inline: false },
        { name: 'Handling Colleague Command Abuse', value: ans.scenario_staff_abuse || 'N/A', inline: false },
        { name: 'Affirmation & Verification', value: ans.verification_affirmation || 'N/A', inline: false }
      );
    } else {
      embed.addFields(
        { name: 'Sanction Progression (Warn, Mute, Kick, Ban)', value: ans.protocol_punishments || 'N/A', inline: false },
        { name: 'Unauthorized Self-Promo / Invite Links', value: ans.protocol_selfpromo || 'N/A', inline: false },
        { name: 'De-escalating Heated Ticket Conversations', value: ans.scenario_ticket_heated || 'N/A', inline: false },
        { name: 'Critical Incident Escalation', value: ans.scenario_incident_escalation || 'N/A', inline: false },
        { name: 'Affirmation & Verification', value: ans.verification_affirmation || 'N/A', inline: false }
      );
    }
  }

  // Row 1: Arrow Pagination
  const leftEmojiId = CONFIG.APPLICATIONS?.ARROW_LEFT_EMOJI_ID || '1550446757396348958';
  const rightEmojiId = CONFIG.APPLICATIONS?.ARROW_RIGHT_EMOJI_ID || '1550446417376448593';

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`app_page_prev_${submission.id}_${safePage}`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(leftEmojiId)
      .setDisabled(safePage === 0),
    new ButtonBuilder()
      .setCustomId(`app_page_info_${submission.id}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel(`${safePage + 1} / ${totalPages}`)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`app_page_next_${submission.id}_${safePage}`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(rightEmojiId)
      .setDisabled(safePage === totalPages - 1)
  );

  // Row 2: Decisions
  const isPending = submission.status === 'pending';
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`app_approve_${submission.id}`)
      .setLabel('Approve')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!isPending),
    new ButtonBuilder()
      .setCustomId(`app_deny_${submission.id}`)
      .setLabel('Deny')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!isPending)
  );

  return { embeds: [embed], components: [row1, row2] };
}

/**
 * Builds the modern Discord Components V2 result card posted into the public results channel
 * (1550413729013829725) when an application is accepted.
 */
export function buildApplicationResultV2(submission) {
  const roleName = getRoleDisplayName(submission.role);
  const bannerPath = path.join(__dirname, 'assets', 'applications_banner.png');
  const files = [];

  let topBannerMediaUrl = 'attachment://applications_banner.png';
  if (fs.existsSync(bannerPath)) {
    files.push(new AttachmentBuilder(bannerPath, { name: 'applications_banner.png' }));
  }

  const containerComponents = [
    // 1. Top Banner
    {
      type: 12,
      items: [
        {
          media: {
            url: topBannerMediaUrl
          }
        }
      ]
    },
    // 2. Title & Introductory Text
    {
      type: 10,
      content:
        `## Orlando Roleplay | Staff Application Result\n` +
        `> Please join us in welcoming our newest staff member to the **Orlando Roleplay** team!\n`
    },
    // 3. Candidate Section with Green Status Pill
    {
      type: 9,
      components: [
        {
          type: 10,
          content: `**Appointed Staff Member**\n<@${submission.userId}> • \`${submission.userTag || submission.userId}\``
        }
      ],
      accessory: {
        type: 2,
        style: 3, // Success Green Pill
        label: 'Accepted',
        disabled: true,
        custom_id: 'app_result_status_pill'
      }
    },
    // 4. Role Section with Gray Position Pill
    {
      type: 9,
      components: [
        {
          type: 10,
          content: `**Staff Division & Position**\nOfficial appointment to **${roleName}**.`
        }
      ],
      accessory: {
        type: 2,
        style: 2, // Secondary Gray Pill
        label: roleName,
        disabled: true,
        custom_id: 'app_result_role_pill'
      }
    },
    // 5. Details & Next Steps Text
    {
      type: 10,
      content:
        `### Verification & Onboarding\n` +
        `> • **Decision:** **Accepted** by <@${submission.reviewedBy}>\n` +
        `> • **Date Approved:** <t:${Math.floor((submission.reviewedAt || Date.now()) / 1000)}:f>\n` +
        (submission.notes ? `> • **Executive Notes:** ${submission.notes}\n` : '') +
        `\n### Next Steps\n` +
        `> Please head over to <#1548146597743960146> and open a ticket to claim your staff permissions and schedule your staff orientation & patrol training.`
    },
    // 6. Action Row with Buttons INSIDE Container
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 3, // Success Green
          label: 'Accepted',
          disabled: true,
          custom_id: 'app_result_btn_status'
        },
        {
          type: 2,
          style: 2, // Secondary Gray
          label: roleName,
          disabled: true,
          custom_id: 'app_result_btn_role'
        },
        {
          type: 2,
          style: 2, // Secondary Gray
          label: 'Open Training Ticket',
          custom_id: 'app_result_btn_ticket'
        }
      ]
    },
    // 7. Micro Footer
    {
      type: 10,
      content: `-# Orlando Roleplay Staff Administration • Official Acceptance Announcement`
    }
  ];

  // 8. Bottom Banner Accent Strip
  if (CONFIG.SESSION?.BOTTOM_BANNER_URL) {
    containerComponents.push({
      type: 12,
      items: [
        {
          media: {
            url: CONFIG.SESSION.BOTTOM_BANNER_URL
          }
        }
      ]
    });
  }

  return {
    flags: 32768,
    components: [
      {
        type: 17,
        components: containerComponents
      }
    ],
    files
  };
}

/**
 * Builds the modern Discord Components V2 direct message sent to the applicant
 * upon review (Acceptance or Denial) with banner at top and buttons inside the card.
 */
export function buildApplicationStatusDmV2({ status, role, notes, userId, reviewedBy }) {
  const roleName = getRoleDisplayName(role);
  const bannerPath = path.join(__dirname, 'assets', 'applications_banner.png');
  const files = [];

  let topBannerMediaUrl = 'attachment://applications_banner.png';
  if (fs.existsSync(bannerPath)) {
    files.push(new AttachmentBuilder(bannerPath, { name: 'applications_banner.png' }));
  }

  const isApproved = status === 'approved';

  const containerComponents = [
    // 1. Top Banner
    {
      type: 12,
      items: [
        {
          media: {
            url: topBannerMediaUrl
          }
        }
      ]
    },
    // 2. Title & Status Content
    {
      type: 10,
      content:
        `## Orlando Roleplay | Application Status\n` +
        (isApproved
          ? `> Congratulations <@${userId}>! Your staff application for **${roleName}** has been **Accepted**.\n\n` +
            `### Application Summary\n` +
            `> • **Assigned Position:** **${roleName}**\n` +
            `> • **Status:** **Accepted**\n` +
            `> • **Reviewed By:** <@${reviewedBy}>\n` +
            `> • **Decision Date:** <t:${Math.floor(Date.now() / 1000)}:f>\n` +
            (notes ? `> • **Staff Notes:** ${notes}\n\n` : '\n') +
            `### Next Steps & Staff Training\n` +
            `> Please open a ticket in <#1548146597743960146> to claim your in-game & Discord staff roles and schedule your staff orientation & training session.\n\n` +
            `> *Welcome to the Orlando Roleplay Staff Team.*`
          : `> Hello <@${userId}>, thank you for taking the time to apply for **${roleName}**.\n` +
            `> After review by Leadership, your staff application has been **Denied** at this time.\n\n` +
            `### Application Summary\n` +
            `> • **Applied Position:** **${roleName}**\n` +
            `> • **Status:** **DENIED**\n` +
            `> • **Reviewed By:** <@${reviewedBy}>\n` +
            `> • **Decision Date:** <t:${Math.floor(Date.now() / 1000)}:f>\n` +
            (notes ? `> • **Staff Feedback:** ${notes}\n\n` : '\n') +
            `> *You are welcome to re-apply in the future once you meet all server requirements and have gained more experience.*`)
    },
    // 3. Status Section Pill
    {
      type: 9,
      components: [
        {
          type: 10,
          content: isApproved
            ? '**Executive Decision**\n-# Verified and accepted by Orlando Roleplay Leadership.'
            : '**Executive Decision**\n-# Reviewed and closed by Orlando Roleplay Leadership.'
        }
      ],
      accessory: {
        type: 2,
        style: isApproved ? 3 : 4, // 3 = Success Green, 4 = Danger Red
        label: isApproved ? 'Accepted' : 'Denied',
        disabled: true,
        custom_id: 'app_dm_status_pill'
      }
    },
    // 4. Action Row with Buttons INSIDE Container
    {
      type: 1,
      components: isApproved
        ? [
            {
              type: 2,
              style: 3, // Green
              label: 'Accepted',
              disabled: true,
              custom_id: 'app_dm_btn_status'
            },
            {
              type: 2,
              style: 2, // Gray
              label: roleName,
              disabled: true,
              custom_id: 'app_dm_btn_role'
            },
            {
              type: 2,
              style: 2, // Gray
              label: 'Open Training Ticket',
              custom_id: 'app_dm_btn_ticket'
            }
          ]
        : [
            {
              type: 2,
              style: 4, // Red
              label: 'Denied',
              disabled: true,
              custom_id: 'app_dm_btn_status'
            },
            {
              type: 2,
              style: 2, // Gray
              label: roleName,
              disabled: true,
              custom_id: 'app_dm_btn_role'
            }
          ]
    },
    // 5. Micro Footer
    {
      type: 10,
      content: `-# Orlando Roleplay Staff Management • Official Status Notification`
    }
  ];

  // 6. Bottom Banner Accent Strip
  if (CONFIG.SESSION?.BOTTOM_BANNER_URL) {
    containerComponents.push({
      type: 12,
      items: [
        {
          media: {
            url: CONFIG.SESSION.BOTTOM_BANNER_URL
          }
        }
      ]
    });
  }

  return {
    flags: 32768,
    components: [
      {
        type: 17,
        components: containerComponents
      }
    ],
    files
  };
}

