import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Languages, LockKeyhole, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { ErrorBanner, Field } from '../components/ui.jsx';
import { Brand } from '../layouts/AppShell.jsx';

function Shell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen">
      {/* Editorial panel */}
      <aside className="relative hidden w-[46%] max-w-3xl flex-col justify-between overflow-hidden border-r border-line p-10 lg:flex xl:p-14">
        <div className="relative"><Brand /></div>

        <div className="relative max-w-lg">
          <p className="eyebrow">A vocabulary vault for Telugu learners</p>
          <h2 className="display mt-5 text-6xl leading-[0.94] text-ink xl:text-7xl">
            Words worth<br /><em className="not-italic text-brand">keeping.</em>
          </h2>
          <p className="muted mt-6 max-w-md text-[15px] leading-relaxed">
            Collect the English words you meet, understand them in Telugu, and let spaced review bring them back at the right moment.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { icon: Languages, label: 'English ↔ తెలుగు' },
              { icon: BookOpen, label: 'Spaced review' },
              { icon: LockKeyhole, label: 'Your own vault' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="rounded-2xl border border-line bg-[var(--surface)] p-3">
                <Icon className="h-4 w-4 text-brand" aria-hidden="true" />
                <p className="mt-2 text-xs font-semibold leading-snug text-ink-soft">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
          Local-first · No ads · No noise
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex w-full flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden"><Brand /></div>
          <div className="animate-rise">
            <p className="eyebrow">WordVault account</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">{title}</h1>
            {subtitle && <p className="muted mt-2 leading-relaxed">{subtitle}</p>}
          </div>
          <div className="card mt-6 !p-5 sm:!p-6">
            {children}
          </div>
          <p className="muted mt-5 text-center">{footer}</p>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
            <Sparkles className="h-3 w-3" aria-hidden="true" />Built for slow, steady learning
          </p>
        </div>
      </main>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth(); const nav = useNavigate(); const loc = useLocation();
  const [f, setF] = useState({ email: '', password: '' }); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await login(f.email, f.password); nav(loc.state?.from || '/', { replace: true }); } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  return (
    <Shell
      title="Welcome back"
      subtitle="Your words are exactly where you left them."
      footer={<>New here? <Link className="link-quiet font-semibold" to="/register">Create an account</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <ErrorBanner error={err} />
        <Field label="Email">{(p) => <input {...p} className="input" type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@example.com" />}</Field>
        <Field label="Password">{(p) => <input {...p} className="input" type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="Your password" />}</Field>
        <button className="btn-primary w-full !py-3" disabled={busy}>
          {busy ? 'Signing in…' : <>Log in<ArrowRight className="h-4 w-4" aria-hidden="true" /></>}
        </button>
      </form>
    </Shell>
  );
}

export function RegisterPage() {
  const { register } = useAuth(); const nav = useNavigate();
  const [f, setF] = useState({ displayName: '', email: '', password: '' }); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await register({ email: f.email, password: f.password, ...(f.displayName ? { displayName: f.displayName } : {}) }); nav('/', { replace: true }); } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  return (
    <Shell
      title="Create your vault"
      subtitle="One account, every word you want to keep."
      footer={<>Already registered? <Link className="link-quiet font-semibold" to="/login">Log in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <ErrorBanner error={err} />
        <Field label="Name (optional)">{(p) => <input {...p} className="input" autoComplete="name" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} placeholder="How should we greet you?" />}</Field>
        <Field label="Email">{(p) => <input {...p} className="input" type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@example.com" />}</Field>
        <Field label="Password" hint="At least 10 characters, with letters and numbers.">{(p) => <input {...p} className="input" type="password" autoComplete="new-password" required minLength={10} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="Create a strong password" />}</Field>
        <button className="btn-primary w-full !py-3" disabled={busy}>
          {busy ? 'Creating…' : <>Create account<ArrowRight className="h-4 w-4" aria-hidden="true" /></>}
        </button>
      </form>
    </Shell>
  );
}
