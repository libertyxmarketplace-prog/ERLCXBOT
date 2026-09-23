import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import dotenv from 'dotenv';
import { CONFIG } from './config.js';

dotenv.config();

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error("Missing DISCORD_TOKEN or CLIENT_ID in your .env file!");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('ERLCX Ticket System management commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    // 1. /ticket panel [channel]
    .addSubcommand(sub =>
      sub
        .setName('panel')
        .setDescription('Send the main ticket panel to a channel')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel to post the ticket panel into (defaults to current channel)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    // 2. /ticket close [reason]
    .addSubcommand(sub =>
      sub
        .setName('close')
        .setDescription('Close the current ticket and archive transcript')
        .addStringOption(opt =>
          opt
            .setName('reason')
            .setDescription('Reason for closing the ticket')
            .setRequired(false)
        )
    )
    // 3. /ticket claim
    .addSubcommand(sub =>
      sub
        .setName('claim')
        .setDescription('Claim this ticket as the assigned staff handler')
    )
    // 4. /ticket unclaim
    .addSubcommand(sub =>
      sub
        .setName('unclaim')
        .setDescription('Unclaim this ticket and return it to awaiting staff')
    )
    // 5. /ticket add <user>
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a user to the current ticket channel')
        .addUserOption(opt =>
          opt
            .setName('user')
            .setDescription('User to add to the ticket')
            .setRequired(true)
        )
    )
    // 6. /ticket remove <user>
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a user from the current ticket channel')
        .addUserOption(opt =>
          opt
            .setName('user')
            .setDescription('User to remove from the ticket')
            .setRequired(true)
        )
    )
    // 7. /ticket rename <name>
    .addSubcommand(sub =>
      sub
        .setName('rename')
        .setDescription('Rename the ticket channel')
        .addStringOption(opt =>
          opt
            .setName('name')
            .setDescription('New name for the ticket channel (without ticket- prefix)')
            .setRequired(true)
        )
    )
    // 8. /ticket status <online|busy|closed>
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Change the support desk operational status')
        .addStringOption(opt =>
          opt
            .setName('status')
            .setDescription('Select status')
            .setRequired(true)
            .addChoices(
              { name: 'Online - Actively responding', value: 'online' },
              { name: 'Busy - Slower response times', value: 'busy' },
              { name: 'Closed - Desk currently offline', value: 'closed' }
            )
        )
    )
    // 9. /ticket category <category> <state>
    .addSubcommand(sub =>
      sub
        .setName('category')
        .setDescription('Toggle individual category availability')
        .addStringOption(opt =>
          opt
            .setName('category')
            .setDescription('Category to toggle')
            .setRequired(true)
            .addChoices(
              ...CONFIG.CATEGORIES.map(c => ({
                name: c.label,
                value: c.id
              }))
            )
        )
        .addStringOption(opt =>
          opt
            .setName('state')
            .setDescription('Enable or disable this category')
            .setRequired(true)
            .addChoices(
              { name: 'Enable / Available', value: 'enable' },
              { name: 'Disable / Unavailable', value: 'disable' }
            )
        )
    ),
  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a user to the current ticket channel')
    .addUserOption(opt =>
      opt
        .setName('user')
        .setDescription('User to add to the ticket')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a user from the current ticket channel')
    .addUserOption(opt =>
      opt
        .setName('user')
        .setDescription('User to remove from the ticket')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('session')
    .setDescription('ERLCX ER:LC Session commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addSubcommand(sub =>
      sub
        .setName('panel')
        .setDescription('Send the live ER:LC Session Information panel to a channel')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel to post the session panel into (defaults to current channel)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('vote')
        .setDescription('Start an official ERLCX ER:LC Session Vote')
        .addIntegerOption(opt =>
          opt
            .setName('required')
            .setDescription('Number of votes required')
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('duration')
            .setDescription('Session vote duration timeframe')
            .setRequired(true)
            .addChoices(
              { name: '30 Minutes', value: '30m' },
              { name: '1 Hour', value: '1h' },
              { name: '2 Hours', value: '2h' },
              { name: '3 Hours', value: '3h' },
              { name: '5 Hours', value: '5h' },
              { name: '12 Hours', value: '12h' },
              { name: '24 Hours', value: '24h' }
            )
        )
        .addRoleOption(opt =>
          opt
            .setName('role')
            .setDescription('Role to ping for this vote (defaults to Session Notification)')
            .setRequired(false)
        )
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel to send the vote to (defaults to current channel)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('shutdown')
        .setDescription('Shut down the active session and post the session ended panel')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel to post the session ended panel into (defaults to #sessions)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    ),
  new SlashCommandBuilder()
    .setName('say')
    .setDescription('Send a message as the bot without showing author')
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addStringOption(opt =>
      opt
        .setName('message')
        .setDescription('The message text to send')
        .setRequired(true)
    )
    .addChannelOption(opt =>
      opt
        .setName('channel')
        .setDescription('Channel to send the message into (defaults to current channel)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages from this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addIntegerOption(opt =>
      opt
        .setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage community giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(sub =>
      sub
        .setName('start')
        .setDescription('Start a new giveaway')
        .addStringOption(opt =>
          opt
            .setName('prize')
            .setDescription('What is being given away')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('duration')
            .setDescription('Duration of the giveaway (e.g. 30s, 10m, 1h, 1d)')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt
            .setName('winners')
            .setDescription('Number of winners (default: 1)')
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(false)
        )
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel to host the giveaway in (default: current channel)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addRoleOption(opt =>
          opt
            .setName('role')
            .setDescription('Role to ping for this giveaway (optional)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('end')
        .setDescription('End an active giveaway')
        .addStringOption(opt =>
          opt
            .setName('giveaway')
            .setDescription('Giveaway message ID or prize keyword (leave empty for latest active)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('reroll')
        .setDescription('Reroll new winner(s) for a concluded giveaway')
        .addStringOption(opt =>
          opt
            .setName('giveaway')
            .setDescription('Giveaway message ID or prize keyword (leave empty for latest concluded)')
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt
            .setName('winners')
            .setDescription('Number of winners to reroll (default: 1)')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false)
        )
    ),
  new SlashCommandBuilder()
    .setName('application')
    .setDescription('ERLCX Staff Application System')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('panel')
        .setDescription('Send the official staff application panel')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel to send application panel into (defaults to current)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('setreview')
        .setDescription('Set the channel where submitted applications are sent for review')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel for staff application reviews')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('setresults')
        .setDescription('Set the channel where accepted/denied application results are announced')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel for public staff application results')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    ),
  new SlashCommandBuilder()
    .setName('commands')
    .setDescription('Display the official ERLCX interactive command directory'),
  new SlashCommandBuilder()
    .setName('refont')
    .setDescription('Convert text into custom Mathematical Sans-Serif font (𝖳𝗁𝗂𝗌 𝖥𝗈𝗇𝗍)')
    .addStringOption(opt =>
      opt
        .setName('text')
        .setDescription('Text to convert into 𝖳𝗁𝗂𝗌 𝖥𝗈𝗇𝗍')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('media')
    .setDescription('Publish a showcase media post with credit and notification ping')
    .addAttachmentOption(opt =>
      opt
        .setName('image')
        .setDescription('Upload the media image or video')
        .setRequired(true)
    )
    .addUserOption(opt =>
      opt
        .setName('credit')
        .setDescription('Credit a user for the photo (defaults to yourself)')
        .setRequired(false)
    )
    .addRoleOption(opt =>
      opt
        .setName('ping')
        .setDescription('Role to ping for this media post (optional)')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName('title')
        .setDescription('Add a showcase title (optional)')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName('caption')
        .setDescription('Add a caption or description (optional)')
        .setRequired(false)
    )
    .addChannelOption(opt =>
      opt
        .setName('channel')
        .setDescription('Channel to post the media into (defaults to current channel)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('department')
    .setDescription('ERLCX Departments System')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('panel')
        .setDescription('Send the official department information panel')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel to send department panel into (defaults to current)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    ),
  new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Manage or test the ERLCX Welcome system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('test')
        .setDescription('Send a test welcome card into the welcome channel')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Optional specific channel to send test welcome into')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Check whether the welcome system is currently enabled or disabled')
    )
    .addSubcommand(sub =>
      sub
        .setName('enable')
        .setDescription('Enable the welcome system for new member joins')
    )
    .addSubcommand(sub =>
      sub
        .setName('disable')
        .setDescription('Disable the welcome system for new member joins')
    ),
  new SlashCommandBuilder()
    .setName('staffdocs')
    .setDescription('ERLCX Staff Documentation System')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('panel')
        .setDescription('Send the official staff documentation hub with dropdown menu')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel to send documentation hub into (defaults to current)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    ),
  new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Announce an official staff member rank promotion')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(opt =>
      opt
        .setName('user')
        .setDescription('Staff member being promoted')
        .setRequired(true)
    )
    .addRoleOption(opt =>
      opt
        .setName('role')
        .setDescription('New Discord staff role to award to the member')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName('rank')
        .setDescription('New staff rank / title (if not selecting a role)')
        .setRequired(false)
    )
    .addRoleOption(opt =>
      opt
        .setName('old_role')
        .setDescription('Previous staff role to remove (optional)')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName('old_rank')
        .setDescription('Previous rank / title (optional)')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName('reason')
        .setDescription('Merits or reason for promotion (optional)')
        .setRequired(false)
    )
    .addChannelOption(opt =>
      opt
        .setName('channel')
        .setDescription('Channel to post announcement into (defaults to #promotions or current)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('infract')
    .setDescription('Issue and log an official staff disciplinary infraction')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(opt =>
      opt
        .setName('user')
        .setDescription('Staff member receiving the infraction')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('type')
        .setDescription('Infraction classification level')
        .setRequired(true)
        .addChoices(
          { name: 'Written Warning', value: 'Written Warning' },
          { name: 'Strike 1', value: 'Strike 1' },
          { name: 'Strike 2', value: 'Strike 2' },
          { name: 'Strike 3', value: 'Strike 3' },
          { name: 'Demotion', value: 'Demotion' },
          { name: 'Suspension', value: 'Suspension' }
        )
    )
    .addStringOption(opt =>
      opt
        .setName('reason')
        .setDescription('Violation reason or policy broken')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('proof')
        .setDescription('Link to evidence clip or case documentation (optional)')
        .setRequired(false)
    )
    .addChannelOption(opt =>
      opt
        .setName('channel')
        .setDescription('Channel to post infraction into (defaults to #infractions or current)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('loa')
    .setDescription('Submit an official Leave of Absence request')
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addSubcommand(sub =>
      sub
        .setName('request')
        .setDescription('Submit a Leave of Absence request for management review')
        .addStringOption(opt =>
          opt
            .setName('start')
            .setDescription('Start date or timeframe (e.g. today, 2026-09-20)')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('end')
            .setDescription('End date or duration (e.g. 5 days, 1 week, 2026-09-27)')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('reason')
            .setDescription('Reason for your leave of absence')
            .setRequired(true)
        )
    ),
  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Open the interactive bot configuration control panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(opt =>
      opt
        .setName('page')
        .setDescription('Page number to open directly (1 to 8)')
        .setMinValue(1)
        .setMaxValue(8)
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName('bot_id')
        .setDescription('Specific Bot Identification Number to configure (Admins only)')
        .setRequired(false)
    ),
].map(cmd => cmd.toJSON());

export const adminOnlyCommands = [
  new SlashCommandBuilder()
    .setName('retrigger')
    .setDescription('Retrigger, refresh, or reboot a customer bot instance (Owner Only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt
        .setName('bot_id')
        .setDescription('Bot Identification Number to retrigger (e.g. BOT-1049)')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('banbot')
    .setDescription('Ban and lock a customer bot instance (Owner Only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt
        .setName('bot_id')
        .setDescription('Bot Identification Number to ban')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('unbanbot')
    .setDescription('Unban and restore a customer bot instance (Owner Only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt
        .setName('bot_id')
        .setDescription('Bot Identification Number to unban')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('listbots')
    .setDescription('List all customer bot instances, status, and Bot IDs (Owner Only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('createbot')
    .setDescription('Generate a new bot instance and Bot Identification Number (Owner Only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt =>
      opt
        .setName('user')
        .setDescription('Customer Discord user to assign the bot instance to')
        .setRequired(false)
    )
].map(cmd => cmd.toJSON());

// Feature commands for customer bots (NO banbot, NO createbot, etc.)
export const customerCommands = commands;

// Slim ERLCX-only commands: just /config, /banbot, and /createbot
export const erlcxMasterCommands = [
  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Open the interactive bot configuration control panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(opt =>
      opt
        .setName('page')
        .setDescription('Page number to open directly (1 to 8)')
        .setMinValue(1)
        .setMaxValue(8)
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName('bot_id')
        .setDescription('Specific Bot Identification Number to configure (Admins only)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('banbot')
    .setDescription('Ban and lock a customer bot instance (Owner Only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt
        .setName('bot_id')
        .setDescription('Bot Identification Number to ban')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('createbot')
    .setDescription('Generate a new bot instance and Bot Identification Number (Owner Only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt =>
      opt
        .setName('user')
        .setDescription('Customer Discord user to assign the bot instance to')
        .setRequired(false)
    ),
].map(cmd => cmd.toJSON());

export const configOnlyCommand = [
  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure your bot instance, credentials, and settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(opt =>
      opt
        .setName('page')
        .setDescription('Page number to open directly (1 to 8)')
        .setMinValue(1)
        .setMaxValue(8)
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName('bot_id')
        .setDescription('Specific Bot ID to configure (e.g. LC-74921)')
        .setRequired(false)
    )
].map(cmd => cmd.toJSON());

// Master ERLCX bot commands: ONLY bot management and config (/listbots, /banbot, /unbanbot, /createbot, /config)
export const masterCommands = [...configOnlyCommand, ...adminOnlyCommands];

export async function deployCommands(customToken = null, customClientId = null, customGuildId = null, setupOnly = false, isMaster = false) {
  const token = customToken || process.env.DISCORD_TOKEN;
  const clientId = customClientId || process.env.CLIENT_ID;

  if (!token || !clientId) {
    console.error("Missing DISCORD_TOKEN or CLIENT_ID!");
    return;
  }

  const restClient = new REST({ version: '10' }).setToken(token);
  const cmds = setupOnly ? configOnlyCommand : (isMaster ? masterCommands : customerCommands);

  try {
    // 1. Deploy Global Slash Commands (visible across ALL servers with NO duplicates)
    console.log(`[DEPLOY] Registering ${cmds.length} GLOBAL slash commands for Client: ${clientId}...`);
    await restClient.put(
      Routes.applicationCommands(clientId),
      { body: cmds }
    );
    console.log(`[DEPLOY] Successfully registered ${cmds.length} global slash commands across all servers!`);

    // 2. Clear any lingering guild-scoped commands to prevent duplicate commands in Discord's menu
    const guildToClean = customGuildId || process.env.GUILD_ID;
    if (guildToClean && guildToClean.trim() !== '') {
      try {
        await restClient.put(
          Routes.applicationGuildCommands(clientId, guildToClean),
          { body: [] }
        );
        console.log(`[DEPLOY] Cleared legacy guild-scoped commands for Guild: ${guildToClean} to prevent duplicates.`);
      } catch {}
    }
  } catch (error) {
    console.error('[DEPLOY] Error deploying slash commands:', error);
  }
}

// Auto-run if executed directly via `node deploy-commands.js`
if (process.argv[1]?.endsWith('deploy-commands.js')) {
  deployCommands(null, null, null, false, true);
}
