import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, ArrowUpRight, Bot, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  FileText, LayoutDashboard, LifeBuoy, LogOut, Radio, Settings2, Shield,
  Sparkles, Ticket, Users
} from 'lucide-react';
import { api } from './api';
import { useAuth } from './auth';
import { EmptyState, Button, Input, Label, LoadingLine, PageHeading, Panel, Status } from './components/ui';
import { WorkspacePages } from './workspace-pages';
import type { DiscordGuild, LiveServer, Workspace } from './types';

const navigation = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/bot', label: 'Bot setup', icon: Bot },
  { to: '/dashboard/tickets', label: 'Tickets', icon: Ticket },
  { to: '/dashboard/sessions', label: 'Sessions', icon: Radio },
  { to: '/dashboard/applications', label: 'Applications', icon: FileText },
  { to: '/dashboard/staff', label: 'Staff', icon: Users },
  { to: '/dashboard/documentation', label: 'Documentation', icon: BookOpen },
  { to: '/dashboard/welcome', label: 'Welcome', icon: LifeBuoy },
  { to: '/dashboard/ai', label: 'AI assistant', icon: Sparkles },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings2 }
];

type ApiWorkspace = { workspace: Workspace };
type ApiLiveServer = LiveServer;

export function DashboardPage() {
  const { user, guilds, loading: authLoading, signOut } = useAuth();
  const [selectedGuildId, setSelectedGuildId] = useState('');
  const [workspaceReload, setWorkspaceReload] = useState(0);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [setupInProgress, setSetupInProgress] = useState(false);
  const [liveServer, setLiveServer] = useState<LiveServer | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [liveError, setLiveError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedGuildId && guilds.length) {
      const savedId = user ? sessionStorage.getItem(`libertyx-selected-${user.id}`) : null;
      const first = guilds.find(guild => guild.id === savedId) || guilds.find(guild => guild.hasWorkspace) || guilds[0];
      setSelectedGuildId(first.id);
    }
  }, [guilds, selectedGuildId, user]);

  useEffect(() => {
    if (selectedGuildId && user) sessionStorage.setItem(`libertyx-selected-${user.id}`, selectedGuildId);
  }, [selectedGuildId, user]);

  const selectedGuild = guilds.find(guild => guild.id === selectedGuildId) || null;

  useEffect(() => {
    if (!selectedGuildId) {
      setWorkspace(null);
      setWorkspaceError('');
      return;
    }
    let active = true;
    setWorkspaceLoading(true);
    setWorkspace(null);
    setWorkspaceError('');
    api<ApiWorkspace>(`/workspace/${selectedGuildId}`)
      .then(result => { if (active) setWorkspace(result.workspace); })
      .catch(error => { if (active && !String(error.message).includes('not been connected')) setWorkspaceError(error.message); })
      .finally(() => { if (active) setWorkspaceLoading(false); });
    return () => { active = false; };
  }, [selectedGuildId, workspaceReload]);

  useEffect(() => {
    if (!workspace?.hasErlcApiKey) {
      setLiveServer(null);
      setLiveError('');
      return;
    }
    let active = true;
    setLiveLoading(true);
    api<ApiLiveServer>(`/workspace/${workspace.guildId}/erlc`)
      .then(data => { if (active) setLiveServer(data); })
      .catch(error => { if (active) setLiveError(error.message); })
      .finally(() => { if (active) setLiveLoading(false); });
    return () => { active = false; };
  }, [workspace?.guildId, workspace?.hasErlcApiKey, workspace?.updatedAt]);

  const chooseGuild = (guildId: string) => {
    setSelectedGuildId(guildId);
    setSetupInProgress(false);
    setLiveServer(null);
    setLiveError('');
    navigate('/dashboard');
  };

  const createWorkspace = async () => {
    if (!selectedGuildId) return;
    const result = await api<ApiWorkspace>('/workspace', { method: 'POST', body: JSON.stringify({ guildId: selectedGuildId }) });
    setWorkspace(result.workspace);
    setSetupInProgress(true);
    return result.workspace;
  };

  const saveConfig = async (customizations: Record<string, unknown>) => {
    if (!workspace) throw new Error('Choose a server before saving settings.');
    const result = await api<ApiWorkspace>(`/workspace/${workspace.guildId}/config`, {
      method: 'PATCH', body: JSON.stringify({ customizations })
    });
    setWorkspace(result.workspace);
    return result.workspace;
  };

  const saveCredentials = async (credentials: { discordToken?: string; erlcApiKey?: string; aiApiKey?: string }) => {
    if (!workspace) throw new Error('Create a workspace before connecting credentials.');
    const result = await api<ApiWorkspace>(`/workspace/${workspace.guildId}/credentials`, {
      method: 'POST', body: JSON.stringify(credentials)
    });
    setWorkspace(result.workspace);
    return result.workspace;
  };

  const performAction = async (action: 'restart' | 'deploy') => {
    if (!workspace) throw new Error('No workspace is selected.');
    const result = await api<ApiWorkspace>(`/workspace/${workspace.guildId}/action`, {
      method: 'POST', body: JSON.stringify({ action })
    });
    if (result.workspace) setWorkspace(result.workspace);
  };

  const pageTitle = useMemo(() => {
    const path = location.pathname.split('/').filter(Boolean).at(-1) || 'overview';
    return path === 'dashboard' ? 'Overview' : path[0].toUpperCase() + path.slice(1);
  }, [location.pathname]);

  if (authLoading) return <main className="dashboard-loading"><LoadingLine /><span>Checking your Discord session…</span></main>;
  if (!user) return <EmptyState icon={<Shield size={22} />} title="Sign in to continue" description="Your dashboard needs a verified Discord account and a server where you have Manage Server permission." action={<Link to="/login" className="hero-primary">Continue with Discord <ChevronRight size={16} /></Link>} />;

  const menu = <Sidebar user={user} onSignOut={() => void signOut()} />;

  return (
    <div className="dashboard-frame">
      <aside className="dashboard-sidebar">
        <div className="sidebar-top"><Link to="/" className="dashboard-brand" aria-label="LIBERTX home"><span className="brand-mark"><span className="brand-l">L</span><span className="brand-x">X</span></span></Link></div>
        {menu}
      </aside>
      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="breadcrumbs"><span>LIBERTX</span><ChevronRight size={13} /><b>{pageTitle.toUpperCase()}</b></div>
          {selectedGuild && <label className="topbar-server"><GuildAvatar guild={selectedGuild} /><select aria-label="Select Discord server" value={selectedGuild.id} onChange={event => chooseGuild(event.target.value)}>{guilds.map(guild => <option key={guild.id} value={guild.id}>{guild.name}</option>)}</select><ChevronDown size={13} /></label>}
          <div className="topbar-user"><span>{user.globalName}</span><Avatar userId={user.id} avatar={user.avatar} /></div>
        </header>
        <div className="dashboard-content">
          {!guilds.length ? (
            <PageHeading eyebrow="DISCORD ACCESS" title="Choose a community" description="No Discord servers with Manage Server permission were returned for your account." />
          ) : !selectedGuild ? (
            <EmptyState icon={<Users size={22} />} title="Select a Discord server" description="Choose a server you manage from the left sidebar to get started." />
          ) : workspaceLoading ? (
            <div className="content-loading"><LoadingLine /><LoadingLine /><span>Loading {selectedGuild.name} workspace…</span></div>
          ) : workspace && !setupInProgress ? (
            <WorkspacePages
              section={location.pathname.split('/').filter(Boolean).at(-1) || 'overview'}
              guild={selectedGuild}
              workspace={workspace}
              liveServer={liveServer}
              liveLoading={liveLoading}
              liveError={liveError}
              onSave={saveConfig}
              onSaveCredentials={saveCredentials}
              onAction={performAction}
            />
          ) : workspaceError ? (
            <EmptyState icon={<CircleHelp size={22} />} title="Workspace could not load" description={workspaceError} action={<Button variant="secondary" onClick={() => setWorkspaceReload(value => value + 1)}>Try again</Button>} />
          ) : (
            <SetupWizard guild={selectedGuild} onCreate={createWorkspace} onSaveCredentials={saveCredentials} onSave={saveConfig} onFinish={workspace => { setWorkspace(workspace); setSetupInProgress(false); }} />
          )}
        </div>
      </main>
    </div>
  );
}

function Sidebar({ user, onSignOut }: {
  user: { id: string; globalName: string; avatar: string | null };
  onSignOut: () => void;
}) {
  return (
    <>
      <div className="sidebar-scroll">
        {navigation.map((item, index) => {
          const Icon = item.icon;
          return <Fragment key={item.to}>
            {index === 1 || index === 4 || index === 7 || index === 9 ? <span className="rail-divider" /> : null}
            <NavLink to={item.to} end={item.end} title={item.label} aria-label={item.label} className={({ isActive }) => `side-link ${isActive ? 'side-link-active' : ''}`}>
              <Icon size={18} strokeWidth={1.75} /><span className="rail-tooltip">{item.label}</span>
            </NavLink>
          </Fragment>;
        })}
      </div>
      <div className="sidebar-bottom">
        <button className="rail-account" onClick={onSignOut} title={`Sign out ${user.globalName}`} aria-label={`Sign out ${user.globalName}`}><Avatar userId={user.id} avatar={user.avatar} /><span className="rail-tooltip">Sign out</span><LogOut size={13} /></button>
      </div>
    </>
  );
}

function SetupWizard({ guild, onCreate, onSaveCredentials, onSave, onFinish }: {
  guild: DiscordGuild;
  onCreate: () => Promise<Workspace | undefined>;
  onSaveCredentials: (values: { discordToken?: string; erlcApiKey?: string }) => Promise<Workspace>;
  onSave: (values: Record<string, unknown>) => Promise<Workspace>;
  onFinish: (workspace: Workspace) => void;
}) {
  const steps = ['Workspace', 'Discord bot', 'ER:LC API', 'Server details', 'Review'];
  const [step, setStep] = useState(0);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [discordToken, setDiscordToken] = useState('');
  const [erlcApiKey, setErlcApiKey] = useState('');
  const [serverName, setServerName] = useState(guild.name);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const continueStep = async () => {
    setBusy(true);
    setError('');
    try {
      if (step === 0) {
        const created = await onCreate();
        if (created) setWorkspace(created);
      }
      if (step === 1 && discordToken.trim()) {
        const saved = await onSaveCredentials({ discordToken: discordToken.trim() });
        setWorkspace(saved);
        setDiscordToken('');
      }
      if (step === 2 && erlcApiKey.trim()) {
        const saved = await onSaveCredentials({ erlcApiKey: erlcApiKey.trim() });
        setWorkspace(saved);
        setErlcApiKey('');
      }
      if (step === 3) {
        const saved = await onSave({ serverName: serverName.trim(), joinCode: joinCode.trim() });
        setWorkspace(saved);
      }
      if (step === steps.length - 1 && workspace) {
        onFinish(workspace);
        return;
      }
      setStep(current => Math.min(current + 1, steps.length - 1));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Setup could not continue.');
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => { setError(''); setStep(current => Math.max(0, current - 1)); };

  return (
    <div className="setup-wrap">
      <PageHeading eyebrow="NEW COMMUNITY WORKSPACE" title="Set up LIBERTX" description={`Connect ${guild.name} one step at a time. Credentials are validated by the server and never sent back to your browser.`} />
      <Panel className="setup-panel">
        <div className="setup-progress">
          <div className="setup-progress-track"><span style={{ width: `${(step / (steps.length - 1)) * 100}%` }} /></div>
          <div className="setup-steps">{steps.map((label, index) => <div key={label} className={index === step ? 'step-current' : index < step ? 'step-complete' : ''}><span>{index < step ? <Check size={13} /> : String(index + 1).padStart(2, '0')}</span><small>{label}</small></div>)}</div>
        </div>
        <div className="setup-body">
          {step === 0 && <div className="setup-step-content"><span className="setup-icon"><Shield size={21} /></span><p className="eyebrow">STEP 01 · WORKSPACE</p><h2>Start with {guild.name}</h2><p>LIBERTX will create a workspace tied to this Discord server and your verified account. You can connect the bot and ER:LC API in the next steps.</p><div className="setup-server-row"><GuildAvatar guild={guild} /><span><b>{guild.name}</b><small>{guild.owner ? 'Server owner' : 'Manage Server permission verified'}</small></span><Status state="healthy">Permission verified</Status></div></div>}
          {step === 1 && <div className="setup-step-content"><span className="setup-icon"><Bot size={21} /></span><p className="eyebrow">STEP 02 · DISCORD BOT</p><h2>Connect your community bot</h2><p>Paste the bot token from Discord Developer Portal. LIBERTX validates it with Discord before saving it on the server.</p><Label htmlFor="setup-token" hint="Never shown again">Bot token</Label><Input id="setup-token" type="password" autoComplete="new-password" value={discordToken} onChange={event => setDiscordToken(event.target.value)} placeholder="Paste Discord bot token" /></div>}
          {step === 2 && <div className="setup-step-content"><span className="setup-icon"><Activity size={21} /></span><p className="eyebrow">STEP 03 · ER:LC CONNECTION</p><h2>Connect live server data</h2><p>Add an ER:LC API key to show genuine server information in the dashboard and session view. LIBERTX checks the key against ER:LC before saving.</p><Label htmlFor="setup-erlc" hint="Optional; add later in Bot settings">ER:LC server key</Label><Input id="setup-erlc" type="password" autoComplete="new-password" value={erlcApiKey} onChange={event => setErlcApiKey(event.target.value)} placeholder="Paste ER:LC API key" /></div>}
          {step === 3 && <div className="setup-step-content"><span className="setup-icon"><Radio size={21} /></span><p className="eyebrow">STEP 04 · SERVER DETAILS</p><h2>Name your ER:LC server</h2><p>These details personalize panels and help staff identify the right community. Leave the join code blank if the server is private.</p><div className="setup-fields"><div><Label htmlFor="setup-name">Community name</Label><Input id="setup-name" value={serverName} onChange={event => setServerName(event.target.value)} maxLength={100} /></div><div><Label htmlFor="setup-code">Server join code</Label><Input id="setup-code" value={joinCode} onChange={event => setJoinCode(event.target.value)} maxLength={80} placeholder="Optional" /></div></div></div>}
          {step === 4 && <div className="setup-step-content"><span className="setup-icon"><Check size={21} /></span><p className="eyebrow">STEP 05 · REVIEW</p><h2>Your workspace is ready to review</h2><p>LIBERTX only marks a connection when its server-side validation succeeds. You can finish now and continue configuring supported modules from the dashboard.</p><div className="review-rows"><div><span>Discord server</span><Status state="healthy">{guild.name}</Status></div><div><span>Community bot</span><Status state={workspace?.hasDiscordToken ? 'healthy' : 'neutral'}>{workspace?.hasDiscordToken ? 'Connected' : 'Not connected'}</Status></div><div><span>ER:LC API</span><Status state={workspace?.hasErlcApiKey ? 'healthy' : 'neutral'}>{workspace?.hasErlcApiKey ? 'Connected' : 'Not connected'}</Status></div></div></div>}
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
        <div className="setup-footer"><Button variant="quiet" disabled={step === 0 || busy} onClick={goBack}><ChevronLeft size={16} /> Back</Button><div>{step > 0 && step < 3 && <Button variant="quiet" disabled={busy} onClick={() => { setError(''); setStep(current => current + 1); }}>Skip for now</Button>}<Button disabled={busy} onClick={() => void continueStep()}>{busy ? 'Checking…' : step === 4 ? 'Open dashboard' : step === 0 ? 'Create workspace' : 'Continue'}{!busy && step < 4 && <ChevronRight size={16} />}</Button></div></div>
      </Panel>
    </div>
  );
}

export function Overview({ guild, workspace, liveServer, liveLoading, liveError }: {
  guild: DiscordGuild;
  workspace: Workspace;
  liveServer: LiveServer | null;
  liveLoading: boolean;
  liveError: string;
}) {
  const online = workspace.status === 'online';
  const modules = [
    { to: '/dashboard/bot', icon: <Bot />, name: 'Bot', detail: workspace.hasDiscordToken ? 'Discord credentials saved' : 'Connect your Discord bot', configured: workspace.hasDiscordToken },
    { to: '/dashboard/tickets', icon: <Ticket />, name: 'Tickets', detail: stringValue(workspace, 'transcriptsChannelId') ? 'Transcript routing configured' : 'Set up categories and routing', configured: Boolean(stringValue(workspace, 'panelTitle')) },
    { to: '/dashboard/applications', icon: <FileText />, name: 'Applications', detail: stringValue(workspace, 'reviewChannelId') ? 'Review channel connected' : 'Configure review channels', configured: Boolean(stringValue(workspace, 'reviewChannelId')) },
    { to: '/dashboard/sessions', icon: <Radio />, name: 'Sessions', detail: workspace.hasErlcApiKey ? 'ER:LC API key saved' : 'Connect live server data', configured: workspace.hasErlcApiKey },
    { to: '/dashboard/staff', icon: <Users />, name: 'Staff', detail: stringValue(workspace, 'botStaffRoleId') ? 'Staff role configured' : 'Set staff access roles', configured: Boolean(stringValue(workspace, 'botStaffRoleId')) },
    { to: '/dashboard/documentation', icon: <BookOpen />, name: 'Documentation', detail: stringValue(workspace, 'staffDocsChannelId') ? 'Hub destination set' : 'Configure the staff hub', configured: Boolean(stringValue(workspace, 'staffDocsChannelId')) }
  ];
  return (
    <div className="command-overview">
      <div className="command-page-heading"><div><p className="eyebrow">COMMUNITY CONTROL ROOM <span>/</span> OVERVIEW</p><h1>{guild.name}</h1><p>One view of your Discord bot and ER:LC connection.</p></div><span className="command-updated"><i /> WORKSPACE READY</span></div>
      <section className="county-status-stage">
        <img src="/login-coast.webp" alt="" />
        <div className="county-stage-shade" />
        <div className="county-stage-copy"><span className="stage-overline"><i /> ER:LC SERVER</span><h2>{liveLoading ? 'Checking server…' : liveServer?.name || (liveError ? 'Server connection unavailable' : 'Connect your server')}</h2><p>{liveServer ? 'Live information received from your ER:LC API connection.' : liveError || (workspace.hasErlcApiKey ? 'Waiting for live server information.' : 'Add an ER:LC server key to see current information here.')}</p><span className={`stage-status ${liveServer ? 'stage-online' : liveError ? 'stage-error' : ''}`}><i />{liveServer ? 'CONNECTED' : liveError ? 'API UNAVAILABLE' : 'AWAITING CONNECTION'}</span></div>
        <div className="county-stage-meta"><span>COMMUNITY</span><b>{guild.name}</b><span>WORKSPACE ID</span><b>{workspace.id}</b></div>
      </section>
      <section className="command-readouts" aria-label="Live ER:LC data">
        <div><span>PLAYER COUNT</span><b>{liveLoading ? '…' : liveServer ? numberOrDash(liveServer.currentPlayers, liveServer.maxPlayers) : '—'}</b><small>{liveServer ? 'ER:LC live data' : 'No live data'}</small></div>
        <div><span>QUEUE</span><b>{liveLoading ? '…' : liveServer ? displayNumber(liveServer.queue) : '—'}</b><small>{liveServer ? 'ER:LC live data' : 'No live data'}</small></div>
        <div><span>DISCORD BOT</span><b className="readout-state">{online ? 'Online' : workspace.hasDiscordToken ? 'Starting' : 'Not connected'}</b><small>{online ? 'Gateway connection active' : 'Bot connection state'}</small></div>
        <div><span>API CONNECTION</span><b className="readout-state">{workspace.hasErlcApiKey ? liveError ? 'Unavailable' : 'Configured' : 'Not set'}</b><small>{workspace.hasErlcApiKey ? 'ER:LC server key saved' : 'Add a server key to begin'}</small></div>
      </section>
      <section className="system-index" id="dashboard-systems"><div className="system-index-heading"><div><p className="eyebrow">MANAGE YOUR COMMUNITY</p><h2>Systems</h2></div><span>{modules.filter(module => module.configured).length} / {modules.length} configured</span></div><div className="system-index-list">{modules.map((module, index) => <Link to={module.to} className="system-index-row" key={module.to}><span className="system-index-number">0{index + 1}</span><span className="system-index-icon">{module.icon}</span><span className="system-index-name">{module.name}</span><span className="system-index-detail">{module.detail}</span><span className={`system-index-state ${module.configured ? 'is-configured' : ''}`}><i />{module.configured ? 'READY' : 'SET UP'}</span><ArrowUpRight size={15} /></Link>)}</div></section>
    </div>
  );
}

function Avatar({ userId, avatar }: { userId: string; avatar: string | null }) {
  return avatar ? <img className="avatar" src={`https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=80`} alt="" /> : <span className="avatar avatar-fallback"><Shield size={15} /></span>;
}

function GuildAvatar({ guild }: { guild: DiscordGuild | null }) {
  if (!guild) return <span className="guild-avatar"><Shield size={16} /></span>;
  return guild.icon
    ? <img className="guild-avatar" src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`} alt="" />
    : <span className="guild-avatar guild-avatar-fallback">{guild.name.slice(0, 1).toUpperCase()}</span>;
}

function displayNumber(value: number | null) { return value === null ? '—' : String(value); }
function numberOrDash(current: number | null, max: number | null) { return current === null ? '—' : `${current}${max === null ? '' : ` / ${max}`}`; }
function stringValue(workspace: Workspace, field: string) { const value = workspace.customizations[field]; return typeof value === 'string' ? value : ''; }