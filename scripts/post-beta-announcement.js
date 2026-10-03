import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { buildBetaTesterWelcomePayload } from '../betaTesterWelcome.js';

// Private beta tester announcement channel (LibertyX server)
const BETA_CHANNEL_ID = '1552532418727125002';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  try {
    const channel = await client.channels.fetch(BETA_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${BETA_CHANNEL_ID} is not accessible or is not a text channel.`);
    }

    const payload = buildBetaTesterWelcomePayload({ userId: null, serverName: 'LibertyX' });
    const sent = await channel.send(payload);

    console.log(`[BETA ANNOUNCEMENT] Posted to #${channel.name} (${channel.id}) — message ${sent.id}`);
  } catch (err) {
    console.error('[BETA ANNOUNCEMENT] Failed to post:', err.message);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(process.env.DISCORD_TOKEN);
