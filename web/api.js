import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import {
  createBotInstance,
  getBotInstance,
  loadBotInstances,
  updateBotInstance,
  DEFAULT_CUSTOMIZATIONS
} from '../botManager.js';
import { activeCustomerClients, startCustomerBot, stopCustomerBot } from '../customerBotRunner.js';
import { deployCommands } from '../deploy-commands.js';
import { CONFIG } from '../config.js';

const SESSION_COOKIE = 'libertyx_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map();
const oauthStates = new Map();
const customizationFields = new Set([
  'panelTitle', 'panelDescription', 'rulesTitle', 'rulesDescription', 'showRulesButton',
  'rulesButtonLabel', 'rulesButtonStyle', 'ticketCategories', 'ticketPingRoleId',
  'ticketClaimRoleId', 'transcriptsChannelId', 'ticketCategoryId', 'topBannerUrl',
  'bottomBannerUrl', 'ticketInsideBannerUrl', 'ticketOpenMessage', 'sessionTopBannerUrl',
  'sessionShutdownBannerUrl', 'sessionBottomBannerUrl', 'sessionVoteTopBannerUrl',
  'sessionVoteBottomBannerUrl', 'sessionChannelId', 'ingameVcId', 'queueVcId',
  'notificationRoleId', 'hostRoleId', 'sessionStartTitle', 'sessionStartDesc',
  'sessionShutdownTitle', 'sessionShutdownDesc', 'appTitle', 'appDescription',
  'appTopBannerUrl', 'appBottomBannerUrl', 'reviewChannelId', 'resultsChannelId',
  'ingameQuestions', 'discordQuestions', 'appQuizIntroText', 'staffDocsTitle',
  'staffDocsDescription', 'staffDocsLayout', 'staffDocsTopBannerUrl',
  'staffDocsBottomBannerUrl', 'staffDocsChannelId', 'welcomeEnabled',
  'welcomeChannelId', 'welcomeText', 'botStaffRoleId', 'staffRoleIds',
  'promotionsChannelId', 'promotionStaffRoleId', 'promotionGiveRoleId',
  'promoteBannerUrl', 'promotionBottomBannerUrl', 'infractionsChannelId',
  'infractionStaffRoleId', 'infractRemoveRoleId', 'infractGiveRoleId',
  'infractBannerUrl', 'infractionBottomBannerUrl', 'deptChannelId', 'deptBannerUrl',
  'regulationsBannerUrl', 'regulationsChannelId', 'welcomeBannerUrl',
  'aiProvider', 'aiModel', 'aiSystemInstructions', 'serverName', 'joinCode'
]);

function appOrigin() {
  return (process.env.APP_ORIGIN || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173')).replace(/\/$/, '');
}

function callbackUrl() {
  return process.env.DISCORD_REDIRECT_URI || `${appOrigin()}/auth/discord`;
}

function safeReturnUrl(value) {
  const origin = appOrigin();
  if (!origin) return null;
  try {
    const parsed = new URL(value || origin);
    return parsed.origin === origin ? `${origin}${parsed.pathname}${parsed.search}${parsed.hash}` : origin;
  } catch {
    return origin;
  }
}

function cookieValue(req, name) {
  const prefix = `${name}=`;
  return (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(prefix))?.slice(prefix.length) || '';
}

function cookieOptions(req) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || req.secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE
  };
}

function permissionsAllowManageGuild(guild) {
  try {
    const permissions = BigInt(guild.permissions || '0');
    return (permissions & 0x8n) === 0x8n || (permissions & 0x20n) === 0x20n;
  } catch {
    return false;
  }
}

async function discordJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    },
    signal: options.signal || AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`Discord API returned ${response.status}`);
  return response.json();
}

async function renewAccessToken(session) {
  if (session.expiresAt > Date.now() + 30_000) return session.accessToken;
  if (!session.refreshToken) throw new Error('Discord session expired. Sign in again.');

  const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID || '',
      client_secret: process.env.DISCORD_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken
    }),
    signal: AbortSignal.timeout(8000)
  });
  if (!tokenResponse.ok) throw new Error('Discord session expired. Sign in again.');
  const tokenData = await tokenResponse.json();
  session.accessToken = tokenData.access_token;
  session.refreshToken = tokenData.refresh_token || session.refreshToken;
  session.expiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;
  return session.accessToken;
}

async function manageableGuilds(session) {
  const token = await renewAccessToken(session);
  const guilds = await discordJson('https://discord.com/api/v10/users/@me/guilds', token);
  return guilds.filter(permissionsAllowManageGuild).map(guild => ({
    id: guild.id,
    name: guild.name,
    icon: guild.icon,
    owner: Boolean(guild.owner),
    hasWorkspace: Object.values(loadBotInstances()).some(bot =>
      bot.guildId === guild.id && bot.ownerUserId === session.user.id && !bot.banned
    )
  }));
}

async function findAuthorizedGuild(session, guildId) {
  if (typeof guildId !== 'string' || !/^\d{17,20}$/.test(guildId)) return null;
  const guilds = await manageableGuilds(session);
  return guilds.find(guild => guild.id === guildId) || null;
}

function findOwnedBot(userId, guildId) {
  return Object.values(loadBotInstances()).find(bot =>
    bot.ownerUserId === userId && bot.guildId === guildId && !bot.banned
  ) || null;
}

function publicCustomizations(customizations = {}) {
  const result = { ...DEFAULT_CUSTOMIZATIONS, ...customizations };
  delete result.aiApiKey;
  return result;
}

function publicBot(bot) {
  const client = activeCustomerClients.get(bot.botId);
  let discordBotId = bot.discordBotId || client?.user?.id || null;
  if (!discordBotId && bot.token) {
    try {
      const decodedId = Buffer.from(bot.token.split('.')[0], 'base64').toString('utf8');
      if (/^\d{17,20}$/.test(decodedId)) discordBotId = decodedId;
    } catch {}
  }
  const invitePermissions = [1024n, 2048n, 8192n, 16384n, 32768n, 65536n, 16n, 1048576n, 2097152n, 268435456n]
    .reduce((total, permission) => total + permission, 0n);
  return {
    id: bot.botId,
    guildId: bot.guildId,
    discordBotId,
    isInGuild: client?.isReady() ? Boolean(client.guilds.cache.has(bot.guildId)) : null,
    inviteUrl: discordBotId ? `https://discord.com/oauth2/authorize?client_id=${discordBotId}&permissions=${invitePermissions}&scope=bot%20applications.commands&guild_id=${bot.guildId}&disable_guild_select=true` : null,
    status: bot.banned ? 'suspended' : (client?.isReady() ? 'online' : (bot.status || 'unconfigured')),
    createdAt: bot.createdAt,
    updatedAt: bot.updatedAt,
    hasDiscordToken: Boolean(bot.token),
    hasErlcApiKey: Boolean(bot.erlcApiKey),
    hasAiApiKey: Boolean(bot.aiApiKey || bot.customizations?.aiApiKey),
    customizations: publicCustomizations(bot.customizations)
  };
}

function validateCustomizations(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Settings must be an object.' };
  const updates = {};
  for (const [key, value] of Object.entries(input)) {
    if (!customizationFields.has(key)) return { error: `The setting "${key}" cannot be changed here.` };
    if (key === 'ticketCategories') {
      if (!Array.isArray(value) || value.length > 5) return { error: 'Use up to five ticket categories.' };
      if (value.some(category => !category || typeof category !== 'object' || ['id', 'name', 'spawnCategoryId', 'pingRoleId'].some(field => typeof (category[field] ?? '') !== 'string' || String(category[field]).length > 100))) {
        return { error: 'Ticket category values are invalid.' };
      }
      updates[key] = value.map((category, index) => ({
        id: category.id || `cat_${index + 1}`,
        name: (category.name || '').trim(),
        spawnCategoryId: category.spawnCategoryId || '',
        pingRoleId: category.pingRoleId || ''
      }));
      continue;
    }
    if (key === 'staffRoleIds') {
      if (!Array.isArray(value) || value.length > 30 || value.some(id => typeof id !== 'string' || id.length > 24)) return { error: 'Staff roles are invalid.' };
      updates[key] = value;
      continue;
    }
    if (typeof value === 'boolean') {
      if (!['showRulesButton', 'welcomeEnabled'].includes(key)) return { error: `The setting "${key}" must be text.` };
      updates[key] = value;
      continue;
    }
    if (typeof value !== 'string' || value.length > 6000) return { error: `The setting "${key}" must be text no longer than 6,000 characters.` };
    if (key.endsWith('Url') && value && !validHttpsUrl(value)) return { error: `The setting "${key}" must be a valid HTTPS URL.` };
    if (key === 'staffDocsLayout' && !['buttons', 'select'].includes(value)) return { error: 'Choose a valid documentation layout.' };
    if (key === 'aiProvider' && !['openai', 'openrouter', 'groq', 'gemini'].includes(value)) return { error: 'Choose a supported AI provider.' };
    if (key === 'rulesButtonStyle' && !['1', '2', '3', '4'].includes(value)) return { error: 'Choose a valid button style.' };
    updates[key] = value;
  }
  return { updates };
}

function validHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

async function validateErlcKey(apiKey) {
  const response = await fetch(`${CONFIG.SESSION?.API_BASE || 'https://api.erlc.gg/v1'}/server`, {
    headers: { 'Server-Key': apiKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) return { error: 'ER:LC did not accept that API key.' };
  const data = await response.json();
  if (data.code || data.message) return { error: 'ER:LC did not accept that API key.' };
  return { server: { name: data.Name || null, joinCode: data.JoinKey || data.JoinCode || null } };
}

export function createDashboardRouter() {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  router.get('/auth/discord/start', (req, res) => {
    const clientId = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const returnTo = safeReturnUrl(req.query.returnTo);
    if (!clientId || !clientSecret || !returnTo) {
      return res.redirect(`${appOrigin() || ''}/login?auth_error=discord_oauth_not_configured`);
    }

    const state = randomBytes(32).toString('hex');
    oauthStates.set(state, { returnTo, expiresAt: Date.now() + 10 * 60 * 1000 });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl(),
      response_type: 'code',
      scope: 'identify guilds',
      state,
      prompt: 'consent'
    });
    res.redirect(`https://discord.com/oauth2/authorize?${params}`);
  });

  router.get('/auth/discord/callback', completeDiscordAuth);
  router.get('/auth/discord', completeDiscordAuth);

  router.use(async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const sessionId = cookieValue(req, SESSION_COOKIE);
    const session = sessions.get(sessionId);
    if (!session || session.expiresAtSession < Date.now()) {
      if (sessionId) sessions.delete(sessionId);
      if (req.path === '/auth/me') {
        req.dashboardSession = null;
        return next();
      }
      return res.status(401).json({ error: 'Sign in with Discord to continue.' });
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('x-csrf-token') !== session.csrfToken) {
      return res.status(403).json({ error: 'Request verification failed. Refresh and try again.' });
    }
    req.dashboardSession = session;
    next();
  });

  router.get('/auth/me', async (req, res) => {
    if (!req.dashboardSession) return res.json({ user: null, csrfToken: '', guilds: [] });
    try {
      res.set('Cache-Control', 'no-store');
      res.json({ user: req.dashboardSession.user, csrfToken: req.dashboardSession.csrfToken, guilds: await manageableGuilds(req.dashboardSession) });
    } catch {
      sessions.delete(cookieValue(req, SESSION_COOKIE));
      res.clearCookie(SESSION_COOKIE, cookieOptions(req));
      res.json({ user: null, csrfToken: '', guilds: [] });
    }
  });

  router.post('/auth/logout', (req, res) => {
    sessions.delete(cookieValue(req, SESSION_COOKIE));
    res.clearCookie(SESSION_COOKIE, cookieOptions(req));
    res.json({ success: true });
  });

  router.get('/servers', async (req, res) => {
    try {
      res.json({ servers: await manageableGuilds(req.dashboardSession) });
    } catch {
      res.status(401).json({ error: 'Discord sign-in expired. Sign in again.' });
    }
  });

  router.get('/workspace/:guildId', async (req, res) => {
    try {
      if (!await findAuthorizedGuild(req.dashboardSession, req.params.guildId)) return res.status(403).json({ error: 'Manage Server permission is required for this Discord server.' });
      const bot = findOwnedBot(req.dashboardSession.user.id, req.params.guildId);
      if (!bot) return res.status(404).json({ error: 'This server has not been connected to an LIBERTX workspace yet.' });
      res.set('Cache-Control', 'no-store').json({ workspace: publicBot(bot) });
    } catch {
      res.status(502).json({ error: 'Could not verify Discord server access.' });
    }
  });

  router.post('/workspace', async (req, res) => {
    const guildId = req.body?.guildId;
    try {
      const guild = await findAuthorizedGuild(req.dashboardSession, guildId);
      if (!guild) return res.status(403).json({ error: 'Manage Server permission is required for the selected Discord server.' });
      const existing = findOwnedBot(req.dashboardSession.user.id, guildId);
      if (existing) return res.json({ workspace: publicBot(existing), created: false });
      const assigned = Object.values(loadBotInstances()).find(bot => bot.guildId === guildId && !bot.banned);
      if (assigned) return res.status(409).json({ error: 'This Discord server is already linked to another LIBERTX workspace.' });
      const bot = createBotInstance(req.dashboardSession.user.id, { guildId, customizations: { serverName: guild.name } });
      res.status(201).json({ workspace: publicBot(bot), created: true });
    } catch {
      res.status(502).json({ error: 'Could not verify Discord server access.' });
    }
  });

  router.patch('/workspace/:guildId/config', async (req, res) => {
    try {
      if (!await findAuthorizedGuild(req.dashboardSession, req.params.guildId)) return res.status(403).json({ error: 'Manage Server permission is required for this Discord server.' });
      const bot = findOwnedBot(req.dashboardSession.user.id, req.params.guildId);
      if (!bot) return res.status(404).json({ error: 'Workspace not found.' });
      const result = validateCustomizations(req.body?.customizations);
      if (result.error) return res.status(400).json({ error: result.error });
      const updated = updateBotInstance(bot.botId, { customizations: { ...(bot.customizations || {}), ...result.updates } });
      res.json({ success: true, workspace: publicBot(updated) });
    } catch {
      res.status(500).json({ error: 'Settings could not be saved.' });
    }
  });

  router.post('/workspace/:guildId/credentials', async (req, res) => {
    try {
      if (!await findAuthorizedGuild(req.dashboardSession, req.params.guildId)) return res.status(403).json({ error: 'Manage Server permission is required for this Discord server.' });
      const bot = findOwnedBot(req.dashboardSession.user.id, req.params.guildId);
      if (!bot) return res.status(404).json({ error: 'Workspace not found.' });
      const { discordToken, erlcApiKey, aiApiKey } = req.body || {};
      const updates = {};

      if (discordToken !== undefined && discordToken !== '') {
        if (typeof discordToken !== 'string' || discordToken.length > 200 || /[\r\n]/.test(discordToken)) return res.status(400).json({ error: 'Discord bot token is invalid.' });
        const cleanToken = discordToken.trim().replace(/^Bot\s+/i, '');
        const response = await fetch('https://discord.com/api/v10/users/@me', {
          headers: { Authorization: `Bot ${cleanToken}` },
          signal: AbortSignal.timeout(8000)
        });
        if (!response.ok) return res.status(400).json({ error: 'Discord did not accept that bot token.' });
        const botUser = await response.json();
        if (!botUser.bot) return res.status(400).json({ error: 'The provided Discord account is not a bot.' });
        updates.token = cleanToken;
        updates.discordBotId = botUser.id;
        updates.status = 'active';
        updates.setupCompleted = true;
      }

      if (erlcApiKey !== undefined && erlcApiKey !== '') {
        if (typeof erlcApiKey !== 'string' || erlcApiKey.length > 250) return res.status(400).json({ error: 'ER:LC API key is invalid.' });
        const result = await validateErlcKey(erlcApiKey.trim());
        if (result.error) return res.status(400).json({ error: result.error });
        updates.erlcApiKey = erlcApiKey.trim();
        if (result.server.name) updates.customizations = { ...(bot.customizations || {}), serverName: result.server.name };
      }

      if (aiApiKey !== undefined && aiApiKey !== '') {
        if (typeof aiApiKey !== 'string' || aiApiKey.length > 500) return res.status(400).json({ error: 'AI API key is invalid.' });
        updates.aiApiKey = aiApiKey.trim();
      }

      const updated = updateBotInstance(bot.botId, updates);
      if (updates.token) {
        const started = await startCustomerBot(bot.botId).catch(() => false);
        if (!started) return res.status(502).json({ error: 'Discord accepted the token, but the bot could not connect. Check its intents and server access.' });
      }
      res.set('Cache-Control', 'no-store').json({ success: true, workspace: publicBot(updated) });
    } catch {
      res.status(502).json({ error: 'Could not validate the supplied credentials.' });
    }
  });

  router.get('/workspace/:guildId/erlc', async (req, res) => {
    try {
      if (!await findAuthorizedGuild(req.dashboardSession, req.params.guildId)) return res.status(403).json({ error: 'Manage Server permission is required for this Discord server.' });
      const bot = findOwnedBot(req.dashboardSession.user.id, req.params.guildId);
      if (!bot) return res.status(404).json({ error: 'Workspace not found.' });
      if (!bot.erlcApiKey) return res.status(409).json({ state: 'not_configured', error: 'Connect an ER:LC API key to see live server information.' });
      const base = CONFIG.SESSION?.API_BASE || 'https://api.erlc.gg/v1';
      const headers = { 'Server-Key': bot.erlcApiKey, Accept: 'application/json' };
      const [serverResponse, playersResponse, queueResponse] = await Promise.all([
        fetch(`${base}/server`, { headers, signal: AbortSignal.timeout(8000) }),
        fetch(`${base}/server/players`, { headers, signal: AbortSignal.timeout(8000) }),
        fetch(`${base}/server/queue`, { headers, signal: AbortSignal.timeout(8000) })
      ]);
      if (!serverResponse.ok) return res.status(502).json({ state: 'unavailable', error: 'ER:LC did not return server information.' });
      const server = await serverResponse.json();
      if (server.code || server.message) return res.status(502).json({ state: 'unavailable', error: 'ER:LC did not return server information.' });
      const players = playersResponse.ok ? await playersResponse.json().catch(() => null) : null;
      const queue = queueResponse.ok ? await queueResponse.json().catch(() => null) : null;
      res.json({
        state: 'connected',
        name: server.Name || null,
        joinCode: server.JoinKey || server.JoinCode || null,
        currentPlayers: Number.isFinite(server.CurrentPlayers) ? server.CurrentPlayers : Array.isArray(players) ? players.length : null,
        maxPlayers: Number.isFinite(server.MaxPlayers) ? server.MaxPlayers : null,
        queue: Array.isArray(queue) ? queue.length : null,
        staffCount: Array.isArray(players) ? players.filter(player => player.Permission && player.Permission !== 'Normal').length : null
      });
    } catch {
      res.status(502).json({ state: 'unavailable', error: 'Could not reach the ER:LC API.' });
    }
  });

  router.post('/workspace/:guildId/action', async (req, res) => {
    try {
      if (!await findAuthorizedGuild(req.dashboardSession, req.params.guildId)) return res.status(403).json({ error: 'Manage Server permission is required for this Discord server.' });
      const bot = findOwnedBot(req.dashboardSession.user.id, req.params.guildId);
      if (!bot) return res.status(404).json({ error: 'Workspace not found.' });
      if (req.body?.action === 'restart') {
        if (!bot.token) return res.status(409).json({ error: 'Connect a Discord bot token before restarting.' });
        await stopCustomerBot(bot.botId);
        const started = await startCustomerBot(bot.botId);
        if (!started) return res.status(502).json({ error: 'The Discord bot did not reconnect. Check its token, intents, and server access.' });
        return res.json({ success: true, workspace: publicBot(getBotInstance(bot.botId)) });
      }
      if (req.body?.action === 'deploy') {
        if (!bot.token) return res.status(409).json({ error: 'Add a Discord bot token before deploying commands.' });
        await deployCommands(bot.token, publicBot(bot).discordBotId, bot.guildId);
        return res.json({ success: true });
      }
      res.status(400).json({ error: 'Choose a supported bot action.' });
    } catch {
      res.status(502).json({ error: 'The bot action could not be completed.' });
    }
  });

  router.use((req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
  return router;
}

export function createDiscordCallbackRouter() {
  const router = Router();
  router.get('/', completeDiscordAuth);
  return router;
}

async function completeDiscordAuth(req, res) {
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const pending = oauthStates.get(state);
  oauthStates.delete(state);
  if (!pending || pending.expiresAt < Date.now()) return res.status(400).send('Discord sign-in expired. Start again from LIBERTX.');
  if (req.query.error) return res.redirect(new URL('/login?auth_error=discord_consent_denied', pending.returnTo).toString());

  try {
    const response = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID || '',
        client_secret: process.env.DISCORD_CLIENT_SECRET || '',
        grant_type: 'authorization_code',
        code: String(req.query.code || ''),
        redirect_uri: callbackUrl()
      }),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error('Discord sign-in could not be completed.');
    const tokenData = await response.json();
    const user = await discordJson('https://discord.com/api/v10/users/@me', tokenData.access_token);
    const sessionId = randomBytes(32).toString('hex');
    sessions.set(sessionId, {
      user: {
        id: user.id,
        username: user.username,
        globalName: user.global_name || user.username,
        avatar: user.avatar
      },
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
      csrfToken: randomBytes(24).toString('hex'),
      expiresAtSession: Date.now() + SESSION_MAX_AGE
    });
    res.cookie(SESSION_COOKIE, sessionId, cookieOptions(req));
    return res.redirect(new URL('/dashboard', pending.returnTo).toString());
  } catch {
    return res.redirect(new URL('/login?auth_error=discord_sign_in_failed', pending.returnTo).toString());
  }
}