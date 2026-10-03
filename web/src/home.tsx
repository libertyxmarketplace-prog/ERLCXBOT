import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, CircleDot, Fingerprint, LayoutDashboard, MessageCircle, Radio, Server, ShieldCheck, Ticket, Users, FileText, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from './components/ui';
import { useAuth } from './auth';

const loginScenes = [
  { src: '/login-coast.webp', label: 'County coastline' },
  { src: '/login-bridge.webp', label: 'Riverside crossing' },
  { src: '/login-lookout.webp', label: 'Forest district' }
];

const authMessages: Record<string, string> = {
  discord_oauth_not_configured: 'Discord sign-in is not configured yet. Add the Discord OAuth application settings on the server.',
  discord_consent_denied: 'Discord sign-in was cancelled. You can try again whenever you are ready.',
  discord_sign_in_failed: 'Discord sign-in could not be completed. Please try again.'
};

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link to="/" className={`brand ${dark ? 'brand-dark' : ''}`} aria-label="LIBERTX home">
      <span className="brand-mark"><span className="brand-l">L</span><span className="brand-x">X</span></span>
      <span>ERLC<span className="brand-x">X</span></span>
    </Link>
  );
}

function SignInButton({ className = '' }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      className={className}
      disabled={loading}
      onClick={() => {
        setLoading(true);
        const returnTo = `${window.location.origin}`;
        window.location.assign(`/api/auth/discord/start?returnTo=${encodeURIComponent(returnTo)}`);
      }}
    >
      {loading ? <CircleDot className="animate-spin" size={16} /> : <MessageCircle size={16} />}
      {loading ? 'Connecting to Discord' : 'Continue with Discord'}
    </Button>
  );
}

export function LoginPage() {
  const [activeScene, setActiveScene] = useState(0);
  const { user, loading } = useAuth();
  const errorCode = new URLSearchParams(window.location.search).get('auth_error');

  useEffect(() => {
    loginScenes.forEach(scene => { const image = new Image(); image.src = scene.src; });
    const timer = window.setInterval(() => setActiveScene(current => (current + 1) % loginScenes.length), 120_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!loading && user) return <main className="login-shell"><div className="login-loading"><CircleDot className="animate-spin" size={20} /> Opening your workspace…</div><Link to="/dashboard">Continue to dashboard</Link></main>;

  return (
    <main className="login-shell">
      <div className="login-scenes" aria-hidden="true">
        {loginScenes.map((scene, index) => (
          <img key={scene.src} src={scene.src} alt="" className={index === activeScene ? 'scene-active' : ''} />
        ))}
      </div>
      <div className="login-shade" aria-hidden="true" />
      <header className="login-topbar"><Brand /><Link to="/" className="login-home"><X size={17} /><span>Back to home</span></Link></header>
      <section className="login-content">
        <div className="login-copy">
          <p className="eyebrow light-eyebrow"><span className="eyebrow-dot" /> COMMUNITY OPERATIONS, CONNECTED</p>
          <h1>Your community,<br /><em>in good order.</em></h1>
          <p className="login-description">One workspace for the Discord systems and ER:LC details that keep your community moving.</p>
          <div className="login-capabilities">
            <span><Ticket size={15} /> Support</span>
            <span><Users size={15} /> Staff</span>
            <span><Radio size={15} /> Live server</span>
          </div>
        </div>
        <div className="login-panel">
          <div className="login-panel-top">
            <span className="login-panel-mark"><ShieldCheck size={18} /></span>
            <span className="login-panel-overline">LIBERTX CONTROL ROOM</span>
          </div>
          <h2>Sign in to LIBERTX</h2>
          <p>Use your Discord account to choose a server you manage.</p>
          {errorCode && (
            <div className="auth-error" role="alert">
              <CircleDot size={15} />
              <span>{authMessages[errorCode] || 'Sign-in did not complete. Please try again.'}</span>
            </div>
          )}
          <SignInButton className="login-discord-button" />
          <div className="login-panel-foot"><ShieldCheck size={13} /><span>Your Discord password is never shared with LIBERTX.</span></div>
        </div>
      </section>
      <footer className="login-footer"><span>LIBERTX · COMMUNITY PLATFORM</span><span>{loginScenes[activeScene].label}</span><span>IMAGES CHANGE EVERY 2 MINUTES</span></footer>
    </main>
  );
}

function ConsolePreview() {
  return (
    <div className="nx-console" aria-label="LIBERTX control room preview">
      <div className="nx-console-bar"><span className="window-lights"><i /><i /><i /></span><span>LIBERTX / CONTROL ROOM</span><span className="nx-live"><i /> PREVIEW</span></div>
      <div className="nx-console-body">
        <div className="nx-console-side"><span className="on">Overview</span><span>Bot setup</span><span>Tickets</span><span>Sessions</span><span>Applications</span><span>Staff</span></div>
        <div className="nx-console-main">
          <div className="nx-console-row">
            <div><label>DISCORD BOT</label><b className="ok">Online</b></div>
            <div><label>ER:LC PLAYERS</label><b>—</b></div>
            <div><label>QUEUE</label><b>—</b></div>
          </div>
          <div className="nx-console-panel"><label>SUPPORT DESK</label><p>Routing, claims, and transcripts configured per category.</p></div>
          <div className="nx-console-panel dim"><label>SESSIONS</label><p>Connect an ER:LC key to light up live server context.</p></div>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const { user, loading } = useAuth();
  const dashboardHref = user ? '/dashboard' : '/login';
  return (
    <main className="home-page">
      <header className="site-nav">
        <Brand />
        <nav aria-label="Primary">
          <a href="#platform">Platform</a>
          <a href="#erlc">ER:LC</a>
          <a href="#operations">Operations</a>
          <a href="#setup">Setup</a>
        </nav>
        <div className="site-nav-actions">
          {!loading && user ? <Link to="/dashboard" className="nav-dashboard"><LayoutDashboard size={15} /> Dashboard</Link> : <Link to="/login" className="nav-login">Sign in</Link>}
          <Link to={dashboardHref} className="nav-cta">Get started <ArrowRight size={15} /></Link>
        </div>
      </header>

      <section className="nx-hero" id="platform">
        <div className="nx-hero-bg" aria-hidden="true"><img src="/login-lookout.webp" alt="" /><span className="nx-hero-veil" /></div>
        <div className="nx-hero-inner">
          <div className="nx-hero-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> ER:LC COMMUNITY PLATFORM</p>
            <h1>Everything your<br />ER:LC community<br />needs.</h1>
            <p className="nx-lede">One calm control room for Discord automation, live server context, tickets, staff, and sessions.</p>
            <div className="nx-hero-actions">
              <Link to={dashboardHref} className="nx-primary">Get started <ArrowRight size={16} /></Link>
              <Link to={dashboardHref} className="nx-ghost"><LayoutDashboard size={15} /> View dashboard</Link>
            </div>
            <div className="nx-hero-meta"><span><ShieldCheck size={13} /> Discord-authorized access</span><i /><span><Server size={13} /> Live data from your keys</span><i /><span><Fingerprint size={13} /> No invented server data</span></div>
          </div>
          <div className="nx-hero-preview"><ConsolePreview /></div>
        </div>
        <div className="nx-hero-strip"><span>TICKETS</span><i /><span>SESSIONS</span><i /><span>APPLICATIONS</span><i /><span>STAFF</span><i /><span>DOCUMENTATION</span><i /><span>WELCOME</span><i /><span>AI ASSISTANT</span></div>
      </section>

      <section className="nx-replace">
        <div className="nx-replace-left">
          <p className="eyebrow">WHY COMMUNITIES SWITCH</p>
          <h2>Stop running your server on five bots and a prayer.</h2>
          <p>Most ER:LC groups stitch ticketing, applications, sessions, and logging across separate bots. LIBERTX is one hosted bot plus one dashboard.</p>
        </div>
        <ul className="nx-replace-list">
          <li><b>One bot to host</b><span>Single token, single permissions, single restart point.</span></li>
          <li><b>One configuration</b><span>Tickets, sessions, applications, docs, and welcome content together.</span></li>
          <li><b>Real status</b><span>Missing credentials show as missing — never fake green lights.</span></li>
        </ul>
      </section>

      <section className="nx-erlc" id="erlc">
        <div className="nx-erlc-media"><img src="/login-bridge.webp" alt="Bridge and river in Liberty County" /><span className="image-tag"><i /> ER:LC API / SERVER-SIDE</span>
          <div className="nx-erlc-card"><span>LIVE SERVER</span><b>awaiting key</b><small>Connect a valid ER:LC server key to show live values.</small></div>
        </div>
        <div className="nx-erlc-copy"><p className="eyebrow">ER:LC INTEGRATION</p><h2>Live context.<br /><em>Clear decisions.</em></h2><p>Connect your ER:LC server key and the dashboard reads actual player, queue, and server details. No key, no connection, no made-up status.</p><Link to={user ? '/dashboard/sessions' : '/login'} className="text-link">See session tools <ArrowRight size={15} /></Link></div>
      </section>

      <section className="nx-ops" id="operations">
        <div className="nx-ops-head"><div><p className="eyebrow">OPERATIONS</p><h2>Each system has its own shape.</h2></div><p>Tickets need routing. Applications need a form builder. Staff needs records. Sessions need live data.</p></div>
        <article className="nx-op nx-op-tickets">
          <div className="nx-op-copy"><span className="nx-op-index">01 / SUPPORT DESK</span><h3><Ticket size={17} /> Tickets that route to the right humans.</h3><p>Categories, claim roles, transcript channels, banners, and rules — with a Discord preview.</p><Link to={user ? '/dashboard/tickets' : '/login'} className="text-link">Configure tickets <ArrowUpRight size={14} /></Link></div>
          <div className="nx-op-visual" aria-hidden="true"><div className="nx-discord-panel"><span className="nx-discord-tag">LIBERTX SUPPORT</span><b>How can we help?</b><div><i>General</i><i>Report</i><i>Appeals</i></div></div></div>
        </article>
        <div className="nx-op-duo">
          <article className="nx-op"><span className="nx-op-index">02 / APPLICATIONS</span><h3><FileText size={17} /> A real form builder.</h3><p>Question sets, review and results channels, open and close control.</p></article>
          <article className="nx-op"><span className="nx-op-index">03 / STAFF</span><h3><Users size={17} /> Promotions, infractions, records.</h3><p>Role-gated flows, dedicated channels, readable staff records.</p></article>
        </div>
      </section>

      <section className="nx-setup" id="setup">
        <div className="nx-setup-copy"><p className="eyebrow">SETUP</p><h2>Configured in an evening, not a weekend.</h2><Link to={dashboardHref} className="nx-primary">Start setup <ArrowRight size={16} /></Link></div>
        <ol className="nx-steps">
          <li><b>01</b><div><h4>Select server</h4><p>Only servers where you hold Manage Server appear.</p></div></li>
          <li><b>02</b><div><h4>Connect keys</h4><p>Bot token and ER:LC key validate server-side.</p></div></li>
          <li><b>03</b><div><h4>Launch</h4><p>Enable modules. The rest stays an empty state.</p></div></li>
        </ol>
      </section>

      <footer className="site-footer"><Brand dark /><span>Emergency Response: Liberty County community operations.</span><Link to={dashboardHref}>Enter the control room <ArrowRight size={14} /></Link></footer>
    </main>
  );
}