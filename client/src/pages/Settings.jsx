import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Database, Download, KeyRound, Languages, MousePointer2, PanelLeft, PanelRight,
  ShieldAlert, SlidersHorizontal, UserRound,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useSidebarPreferences } from '../hooks/useSidebarPreferences.js';
import { Dialog, ErrorBanner, Field, Notice, PageHeader } from '../components/ui.jsx';
import { Select } from '../components/Dropdown.jsx';
import { Reveal } from '../components/visual.jsx';
import { SUPPORTED_LANGUAGES, languageLabel, normalizeLanguage } from '../utils/languages.js';

const TABS = [
  ['/settings', 'Profile', UserRound, true],
  ['/settings/languages', 'Languages', Languages],
  ['/settings/password', 'Password', KeyRound],
  ['/settings/data', 'Data & account', Database],
];

const SectionHead = ({ title, hint, icon: Icon }) => (
  <div className="mb-4 flex items-start gap-3">
    {Icon && <span className="icon-tile"><Icon className="h-4 w-4" aria-hidden="true" /></span>}
    <div>
      <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
      {hint && <p className="muted mt-0.5 leading-relaxed">{hint}</p>}
    </div>
  </div>
);

export function SettingsLayout() {
  return (
    <>
      <PageHeader eyebrow="Your account" title="Settings" sub="Preferences, languages, security and the data you keep here." />
      <nav aria-label="Settings sections" className="no-print mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-[var(--surface)] p-1">
        {TABS.map(([to, l, Icon, end]) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold transition-all ${isActive
              ? 'bg-[var(--surface-hi)] text-ink shadow-[var(--shadow-soft)]'
              : 'text-muted hover:text-ink'}`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />{l}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  );
}

function useSave() {
  const [msg, setMsg] = useState(null); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  return {
    msg, err, busy,
    async run(fn, ok = 'Saved.') {
      setBusy(true); setErr(null); setMsg(null);
      try { await fn(); setMsg(ok); } catch (x) { setErr(x); } finally { setBusy(false); }
    },
  };
}

const zones = () => { try { return Intl.supportedValuesOf('timeZone'); } catch { return ['UTC']; } };

function ChoiceGroup({ legend, hint, value, onChange, options }) {
  return (
    <fieldset>
      <legend className="label">{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map(([optionValue, label, Icon]) => {
          const active = value === optionValue;
          return (
            <label
              key={optionValue}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all focus-within:ring-2 focus-within:ring-[var(--ring)] ${active
                ? 'border-brand/45 bg-[var(--accent-wash)] text-ink'
                : 'border-line bg-[var(--surface)] text-muted hover:border-line-strong hover:text-ink'}`}
            >
              <input
                type="radio"
                name={legend}
                value={optionValue}
                checked={active}
                onChange={() => onChange(optionValue)}
                className="sr-only"
              />
              <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-brand' : 'text-faint'}`} aria-hidden="true" />
              <span>{label}</span>
            </label>
          );
        })}
      </div>
      {hint && <p className="mt-1.5 text-[11px] leading-relaxed text-faint">{hint}</p>}
    </fieldset>
  );
}

function SidebarSettings() {
  const [prefs, setPrefs] = useSidebarPreferences();
  return (
    <section className="card max-w-2xl space-y-5" aria-labelledby="sidebar-preferences">
      <div className="mb-0 flex items-start gap-3">
        <span className="icon-tile"><PanelLeft className="h-4 w-4" aria-hidden="true" /></span>
        <div>
          <h2 id="sidebar-preferences" className="text-lg font-semibold tracking-tight text-ink">Sidebar</h2>
          <p className="muted mt-0.5 leading-relaxed">Choose how the navigation opens and which edge it lives on.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ChoiceGroup
          legend="Interaction"
          value={prefs.mode}
          onChange={(mode) => setPrefs({ mode })}
          options={[
            ['hover', 'Hover to open', MousePointer2],
            ['button', 'Button to open', PanelLeft],
          ]}
          hint="Hover reveals the sidebar near the screen edge. Button keeps a toggle at the top."
        />
        <ChoiceGroup
          legend="Position"
          value={prefs.position}
          onChange={(position) => setPrefs({ position })}
          options={[
            ['left', 'Left', PanelLeft],
            ['right', 'Right', PanelRight],
          ]}
          hint="Used by the toggle button and keyboard shortcut."
        />
      </div>

      <p className="flex flex-wrap items-center gap-1.5 border-t border-line pt-3 text-[11px] text-faint">
        <span>Saved automatically on this device.</span>
        <span className="inline-flex items-center gap-1"><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>B</kbd> toggles the sidebar.</span>
      </p>
    </section>
  );
}

export function ProfileSettings() {
  const { user, updateProfile } = useAuth(); const s = useSave();
  const [f, setF] = useState({
    displayName: user.displayName || '',
    theme: user.preferences.theme,
    timezone: user.preferences.timezone,
    dailyReviewLimit: user.preferences.dailyReviewLimit,
  });

  return (
    <Reveal>
      <div className="max-w-2xl space-y-4">
        <form
          className="card space-y-5"
          onSubmit={(e) => { e.preventDefault(); s.run(() => updateProfile({ ...f, dailyReviewLimit: Number(f.dailyReviewLimit) })); }}
        >
          <SectionHead icon={SlidersHorizontal} title="Profile & preferences" hint="How WordVault greets you and when it counts a new day." />

          <ErrorBanner error={s.err} />
          <Notice>{s.msg}</Notice>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">{(p) => <input {...p} className="input" value={user.email} readOnly />}</Field>
            <Field label="Display name">{(p) => <input {...p} className="input" maxLength={80} value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} />}</Field>
          </div>

          <div className="grid gap-4 rounded-2xl border border-line bg-[var(--surface)] p-4 sm:grid-cols-2">
            <Field label="Theme" hint="Light, dark, or follow your device.">{(p) => (
              <Select {...p} className="input" value={f.theme} onChange={(e) => setF({ ...f, theme: e.target.value })} options={[
                { value: 'system', label: 'Match my device' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]} />
            )}</Field>
            <Field label="Timezone" hint="Used for streaks, review days and charts.">{(p) => (
              <Select {...p} className="input" value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} options={[...new Set([f.timezone, ...zones()])]} />
            )}</Field>
          </div>

          <Field label="Max cards per review session (5–200)" hint="A smaller session is easier to finish. You can always start another.">{(p) => (
            <input {...p} className="input sm:max-w-[9rem]" type="number" min={5} max={200} value={f.dailyReviewLimit} onChange={(e) => setF({ ...f, dailyReviewLimit: e.target.value })} />
          )}</Field>

          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-[11px] text-faint">Changes apply the next time a page loads.</p>
            <button className="btn-primary" disabled={s.busy}>{s.busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>

        <SidebarSettings />
      </div>
    </Reveal>
  );
}

export function LanguageSettings() {
  const { user, updateProfile } = useAuth(); const s = useSave();
  const [lang, setLang] = useState(normalizeLanguage(user.preferences.explanationLanguage));

  return (
    <Reveal>
      <div className="max-w-2xl space-y-4">
        <form className="card space-y-5" onSubmit={(e) => { e.preventDefault(); s.run(() => updateProfile({ explanationLanguage: lang })); }}>
          <SectionHead icon={Languages} title="Explanation language" hint="What appears beneath each English meaning." />

          <ErrorBanner error={s.err} />
          <Notice>{s.msg}</Notice>

          <Field
            label="Preferred explanation language"
            hint="English is always shown. Choose Telugu to also see the Telugu meaning and explanation, or English to see English only. Telugu is the default."
          >
            {(p) => (
              <Select
                {...p}
                className="input"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                options={SUPPORTED_LANGUAGES.map((l) => ({ value: l.code, label: languageLabel(l) }))}
              />
            )}
          </Field>

          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-[11px] text-faint">You can change this any time.</p>
            <button className="btn-primary" disabled={s.busy}>{s.busy ? 'Saving…' : 'Save preference'}</button>
          </div>
        </form>
      </div>
    </Reveal>
  );
}

export function PasswordSettings() {
  const s = useSave();
  const [f, setF] = useState({ currentPassword: '', newPassword: '' });

  return (
    <Reveal>
      <form
        className="card max-w-2xl space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          s.run(async () => { await api.post('/auth/change-password', f); setF({ currentPassword: '', newPassword: '' }); }, 'Password changed. Other devices were signed out.');
        }}
      >
        <SectionHead icon={KeyRound} title="Change password" hint="Changing it signs out every other device." />

        <ErrorBanner error={s.err} />
        <Notice>{s.msg}</Notice>

        <Field label="Current password">{(p) => <input {...p} className="input" type="password" autoComplete="current-password" required value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} />}</Field>
        <Field label="New password" hint="At least 10 characters, with letters and numbers.">{(p) => <input {...p} className="input" type="password" autoComplete="new-password" required minLength={10} value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} />}</Field>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <p className="flex items-center gap-1.5 text-[11px] text-faint"><KeyRound className="h-3 w-3" aria-hidden="true" />Never reuse a password from another site.</p>
          <button className="btn-primary" disabled={s.busy}>{s.busy ? 'Changing…' : 'Change password'}</button>
        </div>
      </form>
    </Reveal>
  );
}

export function DataSettings() {
  const { clear } = useAuth(); const nav = useNavigate(); const s = useSave();
  const [open, setOpen] = useState(false); const [pw, setPw] = useState(''); const [confirm, setConfirm] = useState('');
  const links = [
    ['Vocabulary (JSON)', '/export/vocabulary?format=json'],
    ['Vocabulary (CSV)', '/export/vocabulary?format=csv'],
    ['Vocabulary (Markdown)', '/export/vocabulary?format=md'],
    ['Everything (JSON)', '/export/account'],
  ];

  return (
    <Reveal>
      <div className="max-w-2xl space-y-4">
        <section className="card" aria-labelledby="ex">
          <SectionHead icon={Download} title="Export your data" hint="Only your own data is included — never passwords or secrets." />
          <p className="muted leading-relaxed">Telugu and other scripts are exported as UTF-8; the CSV includes a BOM so Excel opens it correctly.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {links.map(([l, p]) => (
              <a key={p} className="btn-secondary !justify-start" href={api.url(p)} download>
                <Download className="h-4 w-4" aria-hidden="true" />{l}
              </a>
            ))}
          </div>
        </section>

        <section
          className="card"
          aria-labelledby="del"
          style={{ borderColor: 'color-mix(in oklab, #ef4444 35%, var(--line))' }}
        >
          <div className="mb-4 flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-bad/40 text-bad">
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 id="del" className="text-lg font-semibold tracking-tight text-bad">Delete account</h2>
              <p className="muted mt-0.5 leading-relaxed">Permanently deletes your account and every word, translation, review, quiz and sentence.</p>
            </div>
          </div>
          <p className="muted leading-relaxed">Export first if you want a copy — this cannot be undone.</p>
          <button className="btn-danger mt-4" onClick={() => setOpen(true)}>Delete my account…</button>
        </section>

        <Dialog open={open} onClose={() => setOpen(false)} title="Delete your account?">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              s.run(async () => { await api.post('/auth/delete-account', { password: pw, confirm }); clear(); nav('/login'); });
            }}
          >
            <ErrorBanner error={s.err} />
            <p className="muted leading-relaxed">This removes everything immediately. There is no recovery window.</p>
            <Field label="Your password">{(p) => <input {...p} className="input" type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} />}</Field>
            <Field label="Type DELETE to confirm">{(p) => <input {...p} className="input" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />}</Field>
            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn-danger" disabled={s.busy || confirm !== 'DELETE' || !pw}>{s.busy ? 'Deleting…' : 'Delete everything'}</button>
            </div>
          </form>
        </Dialog>
      </div>
    </Reveal>
  );
}
