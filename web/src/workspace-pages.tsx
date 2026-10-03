import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, BookOpen, Bot, Check, ClipboardList, ExternalLink, KeyRound, Radio, RefreshCw, Users } from 'lucide-react';
import { Overview } from './dashboard';
import { Button, Input, Label, LoadingLine, PageHeading, Panel, Select, Status, Textarea, Toggle } from './components/ui';
import type { DiscordGuild, LiveServer, Workspace } from './types';

type Values = Record<string, unknown>;
type SaveFunction = (values: Values) => Promise<Workspace>;
type CredentialFunction = (values: { discordToken?: string; erlcApiKey?: string; aiApiKey?: string }) => Promise<Workspace>;
type ActionFunction = (action: 'restart' | 'deploy') => Promise<void>;

export function WorkspacePages({ section, guild, workspace, liveServer, liveLoading, liveError, onSave, onSaveCredentials, onAction }: {
  section: string;
  guild: DiscordGuild;
  workspace: Workspace;
  liveServer: LiveServer | null;
  liveLoading: boolean;
  liveError: string;
  onSave: SaveFunction;
  onSaveCredentials: CredentialFunction;
  onAction: ActionFunction;
}) {
  switch (section) {
    case 'bot': return <BotPage guild={guild} workspace={workspace} onSaveCredentials={onSaveCredentials} onAction={onAction} />;
    case 'tickets': return <TicketsPage workspace={workspace} onSave={onSave} />;
    case 'sessions': return <SessionsPage workspace={workspace} liveServer={liveServer} liveLoading={liveLoading} liveError={liveError} onSave={onSave} />;
    case 'applications': return <ApplicationsPage workspace={workspace} onSave={onSave} />;
    case 'staff': return <StaffPage workspace={workspace} onSave={onSave} />;
    case 'documentation': return <DocumentationPage workspace={workspace} onSave={onSave} />;
    case 'welcome': return <WelcomePage workspace={workspace} onSave={onSave} />;
    case 'ai': return <AiPage workspace={workspace} onSave={onSave} onSaveCredentials={onSaveCredentials} />;
    case 'settings': return <SettingsPage workspace={workspace} onSave={onSave} />;
    default: return <Overview guild={guild} workspace={workspace} liveServer={liveServer} liveLoading={liveLoading} liveError={liveError} />;
  }
}

function BotPage({ guild, workspace, onSaveCredentials, onAction }: { guild: DiscordGuild; workspace: Workspace; onSaveCredentials: CredentialFunction; onAction: ActionFunction }) {
  const [token, setToken] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      const result = await onSaveCredentials({ ...(token.trim() ? { discordToken: token.trim() } : {}), ...(apiKey.trim() ? { erlcApiKey: apiKey.trim() } : {}) });
      setToken(''); setApiKey('');
      setMessage(result.hasDiscordToken || result.hasErlcApiKey ? 'Credentials were validated and saved on the server.' : 'No new credentials were provided.');
    } catch (problem) { setError(errorText(problem)); } finally { setSaving(false); }
  };

  const action = async (name: 'restart' | 'deploy') => {
    setActing(name); setError(''); setMessage('');
    try { await onAction(name); setMessage(name === 'restart' ? 'Restart request completed.' : 'Command deployment request completed.'); }
    catch (problem) { setError(errorText(problem)); } finally { setActing(''); }
  };

  return <>
    <PageHeading eyebrow="BOT / CONNECTION" title="Bot setup" description={`Manage the Discord client and ER:LC API connection for ${guild.name}. Secrets are write-only and are never returned to this page.`} />
    <div className="bot-overview-grid">
      <Panel className="connection-card"><div className="panel-heading"><div><p className="eyebrow">DISCORD CLIENT</p><h2>Community bot</h2></div><Bot size={19} /></div><div className="connection-status"><Status state={workspace.status === 'online' ? 'healthy' : workspace.hasDiscordToken ? 'warning' : 'neutral'}>{workspace.status === 'online' ? 'Online' : workspace.hasDiscordToken ? 'Configured' : 'Not connected'}</Status><Status state={workspace.isInGuild === true ? 'healthy' : 'neutral'}>{workspace.isInGuild === true ? 'In server' : workspace.isInGuild === false ? 'Not in server' : 'Presence unverified'}</Status></div><p className="panel-copy">Bot credentials remain on the LIBERTX server. The invite opens directly for <b>{guild.name}</b>.</p><div className="button-row">{workspace.inviteUrl && workspace.isInGuild === false && <a className="button-link-secondary" href={workspace.inviteUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Add bot to server</a>}<Button variant="secondary" size="small" disabled={!workspace.hasDiscordToken || Boolean(acting)} onClick={() => void action('restart')}><RefreshCw size={14} />{acting === 'restart' ? 'Restarting…' : 'Restart bot'}</Button><Button variant="secondary" size="small" disabled={!workspace.hasDiscordToken || Boolean(acting)} onClick={() => void action('deploy')}><ArrowUpRight size={14} />{acting === 'deploy' ? 'Deploying…' : 'Deploy commands'}</Button></div></Panel>
      <Panel className="connection-card"><div className="panel-heading"><div><p className="eyebrow">SERVER KEY</p><h2>ER:LC API</h2></div><Radio size={19} /></div><div className="connection-status"><Status state={workspace.hasErlcApiKey ? 'healthy' : 'neutral'}>{workspace.hasErlcApiKey ? 'Configured' : 'Not connected'}</Status></div><p className="panel-copy">Live server details are requested from ER:LC only after this key has been validated.</p><div className="credential-indicator"><KeyRound size={14} /><span>{workspace.hasErlcApiKey ? 'Key stored server-side' : 'No API key saved'}</span></div></Panel>
    </div>
    <Panel className="settings-panel"><form className="credential-form" onSubmit={save}>
        <div className="settings-panel-heading"><div><h2>Connect credentials</h2><p>New values are validated before replacing the saved credential. Leave a field blank to keep the existing credential.</p></div></div>
        <div className="settings-panel-fields">
          <div><Label htmlFor="bot-token" hint={workspace.hasDiscordToken ? 'A token is already saved' : 'Write-only'}>Discord bot token</Label><Input id="bot-token" type="password" autoComplete="new-password" value={token} onChange={event => setToken(event.target.value)} placeholder={workspace.hasDiscordToken ? 'Replace saved token' : 'Paste bot token'} /></div>
          <div><Label htmlFor="erlc-key" hint={workspace.hasErlcApiKey ? 'A key is already saved' : 'Write-only'}>ER:LC server key</Label><Input id="erlc-key" type="password" autoComplete="new-password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={workspace.hasErlcApiKey ? 'Replace saved key' : 'Paste ER:LC API key'} /></div>
          <div className="form-submit"><Button type="submit" disabled={saving || (!token.trim() && !apiKey.trim())}>{saving ? 'Validating…' : 'Validate and save'}</Button>{message && <Status state="healthy">{message}</Status>}{error && <span className="form-error" role="alert">{error}</span>}</div>
        </div>
      </form></Panel>
  </>;
}

function TicketsPage({ workspace, onSave }: { workspace: Workspace; onSave: SaveFunction }) {
  const savedCategories = Array.isArray(workspace.customizations.ticketCategories) ? workspace.customizations.ticketCategories : [];
  return <>
    <PageHeading eyebrow="COMMUNITY SYSTEMS / SUPPORT" title="Tickets" description="Configure ticket presentation, category routing, staff claims, and transcript delivery." />
    <div className="two-column-layout">
      <SettingsPanel title="Panel & rules" description="Changes are saved to this bot instance and used by its ticket panel." workspace={workspace} fields={['panelTitle', 'panelDescription', 'rulesTitle', 'rulesDescription', 'showRulesButton', 'rulesButtonLabel', 'ticketOpenMessage', 'ticketInsideBannerUrl', 'transcriptsChannelId', 'ticketClaimRoleId', 'ticketPingRoleId', 'ticketCategoryId', 'topBannerUrl', 'bottomBannerUrl']} onSave={onSave}>
        {(values, set) => <>
          <div className="field-grid"><FieldText label="Panel title" field="panelTitle" values={values} set={set} /><FieldText label="Transcript channel ID" field="transcriptsChannelId" values={values} set={set} placeholder="Discord channel ID" /><FieldText label="Claim role ID" field="ticketClaimRoleId" values={values} set={set} placeholder="Discord role ID" /><FieldText label="Fallback staff role ID" field="ticketPingRoleId" values={values} set={set} placeholder="Discord role ID" /></div>
          <FieldArea label="Panel description" field="panelDescription" values={values} set={set} />
          <div className="field-grid"><FieldText label="Rules title" field="rulesTitle" values={values} set={set} /><FieldText label="Rules button label" field="rulesButtonLabel" values={values} set={set} /></div>
          <FieldArea label="Ticket rules" field="rulesDescription" values={values} set={set} />
          <FieldArea label="Message inside a new ticket" field="ticketOpenMessage" values={values} set={set} />
          <ToggleField label="Show rules button" description="Include the rules action on the ticket panel." checked={boolValue(values, 'showRulesButton')} onChange={checked => set('showRulesButton', checked)} />
          <div className="field-grid"><FieldText label="Panel header banner URL" field="topBannerUrl" values={values} set={set} placeholder="https://…" /><FieldText label="Inside-ticket banner URL" field="ticketInsideBannerUrl" values={values} set={set} placeholder="https://…" /><FieldText label="Footer banner URL" field="bottomBannerUrl" values={values} set={set} placeholder="https://…" /></div>
        </>}
      </SettingsPanel>
      <SettingsPanel title="Category routing" description="Up to five categories. Discord channel and role IDs are checked for length and stored for the connected bot." workspace={workspace} fields={['ticketCategories']} onSave={onSave}>
        {(values, set) => <TicketCategoriesEditor values={values} savedCategories={savedCategories} set={set} />}
      </SettingsPanel>
    </div>
    <Panel className="ticket-preview-panel"><div className="modules-head"><div><p className="eyebrow">SAVED PANEL PREVIEW</p><h2>Discord ticket panel</h2></div><span>Reflects saved workspace settings</span></div><div className="discord-preview"><div className="discord-preview-top" style={workspace.customizations.topBannerUrl ? { backgroundImage: `url(${String(workspace.customizations.topBannerUrl)})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} /><div className="discord-preview-content"><p className="discord-preview-title">{stringValue(workspace.customizations, 'panelTitle') || 'Support'}</p><p className="discord-preview-description">{stringValue(workspace.customizations, 'panelDescription') || 'Configure the support panel description to preview it here.'}</p>{savedCategories.filter(category => typeof category === 'object' && category !== null && 'name' in category && typeof category.name === 'string' && category.name.trim()).map(category => <span className="discord-preview-button" key={category.id}>{category.name}</span>)}{workspace.customizations.showRulesButton !== false && <span className="discord-preview-button">{stringValue(workspace.customizations, 'rulesButtonLabel') || 'Server Guidelines'}</span>}</div></div></Panel>
  </>;
}

function TicketCategoriesEditor({ values, savedCategories, set }: { values: Values; savedCategories: unknown[]; set: (key: string, value: unknown) => void }) {
  const categories = (Array.isArray(values.ticketCategories) ? values.ticketCategories : savedCategories) as Record<string, string>[];
  const rows = Array.from({ length: 5 }, (_, index) => categories[index] || { id: `cat_${index + 1}`, name: '', spawnCategoryId: '', pingRoleId: '' });
  const update = (index: number, field: string, value: string) => set('ticketCategories', rows.map((category, row) => row === index ? { ...category, [field]: value } : category));
  return <div className="category-editor">{rows.map((category, index) => <div className="category-row" key={index}><div className="category-row-heading"><span>0{index + 1}</span><Input aria-label={`Category ${index + 1} name`} value={category.name || ''} onChange={event => update(index, 'name', event.target.value)} placeholder={`Category ${index + 1}`} maxLength={80} /></div><div className="category-row-fields"><div><Label htmlFor={`spawn-${index}`}>Discord category ID</Label><Input id={`spawn-${index}`} value={category.spawnCategoryId || ''} onChange={event => update(index, 'spawnCategoryId', event.target.value)} placeholder="Optional" maxLength={24} /></div><div><Label htmlFor={`ping-${index}`}>Ping role ID</Label><Input id={`ping-${index}`} value={category.pingRoleId || ''} onChange={event => update(index, 'pingRoleId', event.target.value)} placeholder="Optional" maxLength={24} /></div></div></div>)}</div>;
}

function SessionsPage({ workspace, liveServer, liveLoading, liveError, onSave }: { workspace: Workspace; liveServer: LiveServer | null; liveLoading: boolean; liveError: string; onSave: SaveFunction }) {
  return <>
    <PageHeading eyebrow="COMMUNITY SYSTEMS / OPERATIONS" title="Sessions" description="Review current ER:LC server information and configure where session notices and voice channels are routed." />
    <Panel className="session-live-panel"><div className="session-live-head"><div><p className="eyebrow">ER:LC SERVER STATUS</p><h2>{liveServer?.name || (workspace.hasErlcApiKey ? 'Live server details' : 'No ER:LC connection')}</h2></div>{liveLoading ? <LoadingLine className="short-loading" /> : <Status state={liveServer ? 'healthy' : liveError ? 'error' : 'neutral'}>{liveServer ? 'Live API data' : liveError ? 'Unavailable' : workspace.hasErlcApiKey ? 'Waiting for data' : 'Not configured'}</Status>}</div>{liveServer ? <div className="session-data-row"><LiveInfo label="Players" value={liveServer.currentPlayers === null ? '—' : `${liveServer.currentPlayers}${liveServer.maxPlayers === null ? '' : ` / ${liveServer.maxPlayers}`}`} /><LiveInfo label="Queue" value={liveServer.queue === null ? '—' : String(liveServer.queue)} /><LiveInfo label="Join code" value={liveServer.joinCode || 'Not set'} /><LiveInfo label="Staff in server" value={liveServer.staffCount === null ? '—' : String(liveServer.staffCount)} /></div> : <p className="panel-copy">{liveError || (workspace.hasErlcApiKey ? 'ER:LC has not returned current server details.' : 'Connect an ER:LC API key in Bot setup to load real server status. No sample values are used.')}</p>}</Panel>
    <SettingsPanel title="Session configuration" description="Configure the existing Discord session panels and voice channels." workspace={workspace} fields={['sessionChannelId', 'ingameVcId', 'queueVcId', 'notificationRoleId', 'hostRoleId', 'sessionStartTitle', 'sessionStartDesc', 'sessionShutdownTitle', 'sessionShutdownDesc', 'sessionTopBannerUrl', 'sessionShutdownBannerUrl', 'sessionVoteTopBannerUrl']} onSave={onSave}>
      {(values, set) => <><div className="field-grid"><FieldText label="Announcement channel ID" field="sessionChannelId" values={values} set={set} placeholder="Discord channel ID" /><FieldText label="In-game radio voice channel" field="ingameVcId" values={values} set={set} placeholder="Discord channel ID" /><FieldText label="Queue voice channel" field="queueVcId" values={values} set={set} placeholder="Discord channel ID" /><FieldText label="Session host role ID" field="hostRoleId" values={values} set={set} placeholder="Discord role ID" /><FieldText label="Notification role ID" field="notificationRoleId" values={values} set={set} placeholder="Discord role ID" /></div><FieldText label="Session start title" field="sessionStartTitle" values={values} set={set} /><FieldArea label="Session start announcement" field="sessionStartDesc" values={values} set={set} /><FieldText label="Session conclusion title" field="sessionShutdownTitle" values={values} set={set} /><FieldArea label="Session conclusion announcement" field="sessionShutdownDesc" values={values} set={set} /><div className="field-grid"><FieldText label="Live session banner URL" field="sessionTopBannerUrl" values={values} set={set} placeholder="https://…" /><FieldText label="Session vote banner URL" field="sessionVoteTopBannerUrl" values={values} set={set} placeholder="https://…" /></div><p className="backend-note"><Radio size={15} /> Session start, vote, and shutdown actions currently run through the Discord bot; the backend does not expose web controls for those actions yet.</p></>}
    </SettingsPanel>
  </>;
}

function ApplicationsPage({ workspace, onSave }: { workspace: Workspace; onSave: SaveFunction }) {
  return <>
    <PageHeading eyebrow="COMMUNITY SYSTEMS / RECRUITMENT" title="Applications" description="Set the public application panel and where submissions are reviewed and announced." />
    <SettingsPanel title="Application panel" description="These fields are used by the connected bot’s application panel." workspace={workspace} fields={['appTitle', 'appDescription', 'reviewChannelId', 'resultsChannelId', 'appTopBannerUrl', 'appBottomBannerUrl']} onSave={onSave}>
      {(values, set) => <><div className="field-grid"><FieldText label="Panel title" field="appTitle" values={values} set={set} /><FieldText label="Review channel ID" field="reviewChannelId" values={values} set={set} placeholder="Discord channel ID" /><FieldText label="Results channel ID" field="resultsChannelId" values={values} set={set} placeholder="Discord channel ID" /></div><FieldArea label="Applicant instructions" field="appDescription" values={values} set={set} /><div className="field-grid"><FieldText label="Header banner URL" field="appTopBannerUrl" values={values} set={set} placeholder="https://…" /><FieldText label="Footer banner URL" field="appBottomBannerUrl" values={values} set={set} placeholder="https://…" /></div></>}
    </SettingsPanel>
    <Panel className="backend-note-panel"><div className="note-icon"><ClipboardList size={18} /></div><div><h2>Question builder and submission review</h2><p>The current bot stores question text in its configuration, but application questions and review actions are still handled inside Discord. The backend does not yet provide a web question schema or submission-review API, so this page does not pretend those records are available.</p></div></Panel>
  </>;
}

function StaffPage({ workspace, onSave }: { workspace: Workspace; onSave: SaveFunction }) {
  return <>
    <PageHeading eyebrow="COMMUNITY SYSTEMS / PEOPLE" title="Staff" description="Set the roles and channels used by LIBERTX’s existing staff commands." />
    <div className="two-column-layout">
      <SettingsPanel title="Staff access" description="Role IDs are applied by the connected bot when it checks staff actions." workspace={workspace} fields={['botStaffRoleId', 'staffRoleIds']} onSave={onSave}>
        {(values, set) => <><FieldText label="Bot management role ID" field="botStaffRoleId" values={values} set={set} placeholder="Discord role ID" /><FieldText label="Staff roles" field="staffRoleIds" values={values} set={set} parse={value => value.split(',').map(id => id.trim()).filter(Boolean)} display={value => Array.isArray(value) ? value.join(', ') : ''} placeholder="Comma-separated Discord role IDs" /><p className="field-help">Use role IDs, not role names. Leave the list empty if no additional staff roles are configured.</p></>}
      </SettingsPanel>
      <SettingsPanel title="Promotion and infraction routing" description="Configure staff action permissions and announcement destinations." workspace={workspace} fields={['promotionsChannelId', 'promotionStaffRoleId', 'promotionGiveRoleId', 'promoteBannerUrl', 'infractionsChannelId', 'infractionStaffRoleId', 'infractGiveRoleId', 'infractRemoveRoleId', 'infractBannerUrl']} onSave={onSave}>
        {(values, set) => <><FieldText label="Promotions channel ID" field="promotionsChannelId" values={values} set={set} placeholder="Discord channel ID" /><FieldText label="Promotion staff role ID" field="promotionStaffRoleId" values={values} set={set} placeholder="Discord role ID" /><FieldText label="Promotion role to assign" field="promotionGiveRoleId" values={values} set={set} placeholder="Discord role ID" /><FieldText label="Promotion banner URL" field="promoteBannerUrl" values={values} set={set} placeholder="https://…" /><FieldText label="Infractions channel ID" field="infractionsChannelId" values={values} set={set} placeholder="Discord channel ID" /><FieldText label="Infraction staff role ID" field="infractionStaffRoleId" values={values} set={set} placeholder="Discord role ID" /><FieldText label="Role to add on infraction" field="infractGiveRoleId" values={values} set={set} placeholder="Optional role ID" /><FieldText label="Role to remove on infraction" field="infractRemoveRoleId" values={values} set={set} placeholder="Optional role ID" /><FieldText label="Infraction banner URL" field="infractBannerUrl" values={values} set={set} placeholder="https://…" /></>}
      </SettingsPanel>
    </div>
    <Panel className="backend-note-panel"><div className="note-icon"><Users size={18} /></div><div><h2>Staff records</h2><p>Promotions and infractions are posted and recorded through the Discord bot commands. The existing backend does not expose a server-scoped staff-record API for this dashboard.</p></div></Panel>
  </>;
}

function DocumentationPage({ workspace, onSave }: { workspace: Workspace; onSave: SaveFunction }) {
  return <>
    <PageHeading eyebrow="COMMUNITY SYSTEMS / HANDBOOK" title="Documentation" description="Configure the staff documentation hub published by the connected bot." />
    <SettingsPanel title="Documentation hub" description="Changes update the existing bot’s documentation panel configuration." workspace={workspace} fields={['staffDocsTitle', 'staffDocsDescription', 'staffDocsChannelId', 'staffDocsLayout', 'staffDocsTopBannerUrl', 'staffDocsBottomBannerUrl']} onSave={onSave}>
      {(values, set) => <><FieldText label="Hub title" field="staffDocsTitle" values={values} set={set} /><FieldArea label="Hub description" field="staffDocsDescription" values={values} set={set} /><div className="field-grid"><FieldText label="Documentation channel ID" field="staffDocsChannelId" values={values} set={set} placeholder="Discord channel ID" /><div><Label htmlFor="docs-layout">Navigation layout</Label><Select id="docs-layout" value={stringValue(values, 'staffDocsLayout') || 'select'} onChange={event => set('staffDocsLayout', event.target.value)}><option value="select">Dropdown menu</option><option value="buttons">Buttons</option></Select></div></div><div className="field-grid"><FieldText label="Header banner URL" field="staffDocsTopBannerUrl" values={values} set={set} placeholder="https://…" /><FieldText label="Footer banner URL" field="staffDocsBottomBannerUrl" values={values} set={set} placeholder="https://…" /></div></>}
    </SettingsPanel>
    <Panel className="backend-note-panel"><div className="note-icon"><BookOpenIcon /></div><div><h2>Document content</h2><p>The current documentation hub is configured and published through Discord. A web document editor and category-management API are not present in the backend yet.</p></div></Panel>
  </>;
}

function WelcomePage({ workspace, onSave }: { workspace: Workspace; onSave: SaveFunction }) {
  return <>
    <PageHeading eyebrow="AUTOMATION / FIRST IMPRESSION" title="Welcome system" description="Configure the welcome behavior supported by your Discord bot." />
    <SettingsPanel title="Member welcome" description="The bot uses these settings when a new member joins the connected Discord server." workspace={workspace} fields={['welcomeEnabled', 'welcomeChannelId', 'welcomeText', 'welcomeBannerUrl']} onSave={onSave}>
      {(values, set) => <><ToggleField label="Welcome messages" description="Send a welcome card when a member joins." checked={boolValue(values, 'welcomeEnabled')} onChange={checked => set('welcomeEnabled', checked)} /><FieldText label="Welcome channel ID" field="welcomeChannelId" values={values} set={set} placeholder="Discord channel ID" /><FieldArea label="Welcome message" field="welcomeText" values={values} set={set} /><FieldText label="Banner URL" field="welcomeBannerUrl" values={values} set={set} placeholder="https://…" /><p className="field-help">The existing welcome message supports the {'{user}'} placeholder.</p></>}
    </SettingsPanel>
  </>;
}

function AiPage({ workspace, onSave, onSaveCredentials }: { workspace: Workspace; onSave: SaveFunction; onSaveCredentials: CredentialFunction }) {
  const [apiKey, setApiKey] = useState('');
  const [keySaving, setKeySaving] = useState(false);
  const [keyMessage, setKeyMessage] = useState('');
  const [keyError, setKeyError] = useState('');
  const saveKey = async () => {
    if (!apiKey.trim()) return;
    setKeySaving(true); setKeyMessage(''); setKeyError('');
    try {
      await onSaveCredentials({ aiApiKey: apiKey.trim() });
      setApiKey('');
      setKeyMessage('Key saved on the server. It is not returned to the browser.');
    } catch (problem) { setKeyError(errorText(problem)); } finally { setKeySaving(false); }
  };
  return <>
    <PageHeading eyebrow="AUTOMATION / ASSISTANT" title="AI assistant" description="Configure the AI provider used by the existing bot configuration assistant." />
    <div className="two-column-layout">
      <SettingsPanel title="Provider and behavior" description="Supported providers are limited to those implemented in the existing backend." workspace={workspace} fields={['aiProvider', 'aiModel', 'aiSystemInstructions']} onSave={onSave}>
        {(values, set) => <><div><Label htmlFor="ai-provider">Provider</Label><Select id="ai-provider" value={stringValue(values, 'aiProvider') || 'openrouter'} onChange={event => set('aiProvider', event.target.value)}><option value="openai">OpenAI</option><option value="openrouter">OpenRouter</option><option value="groq">Groq</option><option value="gemini">Gemini</option></Select></div><FieldText label="Model" field="aiModel" values={values} set={set} placeholder="Provider model identifier" /><FieldArea label="Additional instructions" field="aiSystemInstructions" values={values} set={set} /><p className="field-help">The fixed security rules for the assistant remain in force alongside these instructions.</p></>}
      </SettingsPanel>
      <Panel className="ai-key-panel"><div className="panel-heading"><div><p className="eyebrow">CREDENTIAL</p><h2>Provider API key</h2></div><KeyRound size={18} /></div><p className="panel-copy">{workspace.hasAiApiKey ? 'A key is saved. For security, its value cannot be retrieved or displayed.' : 'No AI provider key is saved for this workspace.'}</p><Label htmlFor="ai-key" hint="Write-only">{workspace.hasAiApiKey ? 'Replace API key' : 'API key'}</Label><Input id="ai-key" type="password" autoComplete="new-password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={workspace.hasAiApiKey ? 'Enter a new key to replace' : 'Paste provider API key'} /><Button className="ai-save-button" onClick={() => void saveKey()} disabled={!apiKey.trim() || keySaving}>{keySaving ? 'Saving…' : 'Save API key'}</Button>{keyMessage && <Status state="healthy">{keyMessage}</Status>}{keyError && <p className="form-error" role="alert">{keyError}</p>}<p className="field-help">The current bot verifies provider access when its assistant runs; saving a key does not claim that the provider accepted it.</p></Panel>
    </div>
  </>;
}

function SettingsPage({ workspace, onSave }: { workspace: Workspace; onSave: SaveFunction }) {
  return <>
    <PageHeading eyebrow="SYSTEM / IDENTITY" title="Settings" description="Edit the community identity and display details used across bot panels." />
    <SettingsPanel title="Community identity" description="This updates server details in the selected LIBERTX bot instance." workspace={workspace} fields={['serverName', 'joinCode']} onSave={onSave}>
      {(values, set) => <><div className="field-grid"><FieldText label="Community name" field="serverName" values={values} set={set} /><FieldText label="ER:LC join code" field="joinCode" values={values} set={set} /></div><div className="settings-meta"><span>Workspace ID</span><code>{workspace.id}</code></div><div className="settings-meta"><span>Last saved</span><time>{new Date(workspace.updatedAt).toLocaleString()}</time></div></>}
    </SettingsPanel>
  </>;
}

function SettingsPanel({ title, description, workspace, fields, onSave, children }: {
  title: string;
  description: string;
  workspace: Workspace;
  fields: string[];
  onSave: SaveFunction;
  children: (values: Values, set: (key: string, value: unknown) => void) => ReactNode;
}) {
  const [values, setValues] = useState<Values>(() => pickFields(workspace, fields));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { setValues(pickFields(workspace, fields)); }, [workspace.id, workspace.updatedAt]);
  const set = (key: string, value: unknown) => setValues(current => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setSaved(false);
    try { await onSave(values); setSaved(true); }
    catch (problem) { setError(errorText(problem)); }
    finally { setSaving(false); }
  };
  return <Panel className="settings-panel"><form onSubmit={submit}><div className="settings-panel-heading"><div><h2>{title}</h2><p>{description}</p></div><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button></div><div className="settings-panel-fields">{children(values, set)}</div><div className="settings-panel-footer">{error && <span className="form-error" role="alert">{error}</span>}{saved && <Status state="healthy"><Check size={12} /> Saved</Status>}</div></form></Panel>;
}

function FieldText({ label, field, values, set, placeholder, parse, display, type = 'text' }: {
  label: string;
  field: string;
  values: Values;
  set: (key: string, value: unknown) => void;
  placeholder?: string;
  parse?: (value: string) => unknown;
  display?: (value: unknown) => string;
  type?: string;
}) {
  const id = `field-${field}`;
  const value = values[field];
  return <div><Label htmlFor={id}>{label}</Label><Input id={id} type={type} value={display ? display(value) : textValue(value)} onChange={event => set(field, parse ? parse(event.target.value) : event.target.value)} placeholder={placeholder} /></div>;
}

function FieldArea({ label, field, values, set, placeholder }: { label: string; field: string; values: Values; set: (key: string, value: unknown) => void; placeholder?: string }) {
  const id = `field-${field}`;
  return <div><Label htmlFor={id}>{label}</Label><Textarea id={id} value={textValue(values[field])} onChange={event => set(field, event.target.value)} placeholder={placeholder} /></div>;
}

function ToggleField({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="toggle-field"><div><b>{label}</b><p>{description}</p></div><Toggle checked={checked} onCheckedChange={onChange} /></div>;
}

function LiveInfo({ label, value }: { label: string; value: string }) { return <div className="session-live-info"><span>{label}</span><b>{value}</b></div>; }
function BookOpenIcon() { return <BookOpen size={17} />; }
function pickFields(workspace: Workspace, fields: string[]) { return Object.fromEntries(fields.map(field => [field, workspace.customizations[field]])); }
function textValue(value: unknown) { return typeof value === 'string' ? value : ''; }
function stringValue(values: Values, field: string) { return typeof values[field] === 'string' ? values[field] as string : ''; }
function boolValue(values: Values, field: string) { return typeof values[field] === 'boolean' ? values[field] as boolean : true; }
function errorText(problem: unknown) { return problem instanceof Error ? problem.message : 'The request could not be completed.'; }