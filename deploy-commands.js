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
    .setDescription('Orlando Ticket System management commands')
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
    .setDescription('Orlando ER:LC Session commands')
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
        .setDescription('Start an official Orlando ER:LC Session Vote')
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
    )
    .addSubcommand(sub =>
      sub
        .setName('info')
        .setDescription('Post the session ended/info announcement card without buttons into #sessions')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel to post the session info card into (defaults to #sessions)')
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
    .setDescription('Orlando Staff Application System')
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
    ),
  new SlashCommandBuilder()
    .setName('commands')
    .setDescription('Display the official Orlando Roleplay interactive command directory'),
  new SlashCommandBuilder()
    .setName('command')
    .setDescription('Display the official Orlando Roleplay interactive command directory'),
  new SlashCommandBuilder()
    .setName('refont')
    .setDescription('Convert text into custom Mathematical Sans-Serif font (𝖳𝗁𝗂𝗌 𝖥𝗈𝗇𝗍)')
    .addStringOption(opt =>
      opt
        .setName('text')
        .setDescription('Text to convert into 𝖳𝗁𝗂𝗌 𝖥𝗈𝗇𝗍')
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

export async function deployCommands() {
  try {
    console.log(`Started refreshing application (/) commands...`);

    // 1. Clear global application commands to eliminate all duplicate command listings
    console.log(`Clearing global application commands to eliminate duplicate listings...`);
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: [] }
    );
    console.log(`Successfully cleared global commands.`);

    // 2. Register directly to guilds for instant updates without caching delays
    const targetGuilds = ['1530147023754367006', '1541210827967823955'];
    if (GUILD_ID && GUILD_ID.trim() !== '' && !targetGuilds.includes(GUILD_ID)) {
      targetGuilds.push(GUILD_ID);
    }

    for (const gId of targetGuilds) {
      try {
        console.log(`Registering guild commands to Guild: ${gId}`);
        await rest.put(
          Routes.applicationGuildCommands(CLIENT_ID, gId),
          { body: commands }
        );
        console.log(`Successfully registered guild slash commands to Guild ${gId}.`);
      } catch (gErr) {
        console.warn(`Could not register commands to guild ${gId}:`, gErr.message);
      }
    }
  } catch (error) {
    console.error('Error deploying slash commands:', error);
  }
}

// Auto-run if executed directly via `node deploy-commands.js`
if (process.argv[1]?.endsWith('deploy-commands.js')) {
  deployCommands();
}
