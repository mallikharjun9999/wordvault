import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, BookOpen, ChevronLeft, ChevronRight, Flame, HelpCircle,
  LayoutDashboard, LogOut, Menu, PenLine, PlusCircle, Repeat, Settings, Star, X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useSidebarPreferences } from '../hooks/useSidebarPreferences.js';

const GROUPS = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Library',
    items: [
      { to: '/words', label: 'My words', icon: BookOpen, end: true },
      { to: '/words/new', label: 'Add word', icon: PlusCircle },
      { to: '/favorites', label: 'Favorites', icon: Star },
      { to: '/difficult', label: 'Difficult words', icon: Flame },
    ],
  },
  {
    label: 'Practice',
    items: [
      { to: '/review', label: 'Review', icon: Repeat },
      { to: '/quiz', label: 'Quiz & practice', icon: HelpCircle },
      { to: '/sentences', label: 'Write sentences', icon: PenLine },
    ],
  },
  {
    label: 'Insights',
    items: [{ to: '/progress', label: 'Progress', icon: BarChart3 }],
  },
];

const BOTTOM = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/words', label: 'Words', icon: BookOpen, end: true },
  { to: '/words/new', label: 'Add', icon: PlusCircle },
  { to: '/review', label: 'Review', icon: Repeat },
  { to: '/progress', label: 'Progress', icon: BarChart3 },
];

const EDGE_ZONE = 28;
const OPEN_DELAY = 90;
const CLOSE_DELAY = 420;
const HOVER_QUERY = '(hover: hover) and (pointer: fine)';
const DESKTOP_QUERY = '(min-width: 1024px)';

function NavList({ onNavigate }) {
  return (
    <div className="space-y-6">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <p className="eyebrow mb-2 px-3 !text-[0.6rem]">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink to={to} end={end} className="nav-link" onClick={onNavigate}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export const Brand = ({ compact = false }) => (
  <span className="flex items-center gap-2.5 text-ink">
    <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-[0.7rem] border border-black/10 bg-[var(--brand-fill)] text-[15px] font-bold text-[var(--on-brand)]" aria-hidden="true">
      W
      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--canvas)] ring-2 ring-[var(--brand-fill)]" />
    </span>
    {!compact && (
      <span className="flex flex-col leading-none">
        <span className="display text-[1.5rem] leading-none tracking-tight">WordVault</span>
        <span className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.24em] text-faint">Telugu · English</span>
      </span>
    )}
  </span>
);

const Avatar = ({ name, email }) => {
  const initial = (name || email || '?').trim().charAt(0).toUpperCase();
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-[var(--surface)] text-sm font-semibold text-ink-soft">
      {initial}
    </span>
  );
};

function SidebarPanel({ side, onNavigate, user, name, out }) {
  return (
    <div className="flex h-full w-[var(--sidebar-w)] flex-col px-4 py-5">
      <div className={`px-2 ${side === 'left' ? 'pl-12' : 'pr-12'}`}><Brand /></div>
      <nav aria-label="Main" className="mt-7 min-h-0 flex-1 overflow-y-auto pr-1">
        <NavList onNavigate={onNavigate} />
      </nav>
      <div className="mt-4 space-y-1 border-t border-line pt-3">
        <NavLink to="/settings" className="nav-link" onClick={onNavigate}>
          <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />Settings
        </NavLink>
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-line bg-[var(--surface)] px-3 py-2.5">
          <Avatar name={user?.displayName} email={user?.email} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            <p className="truncate text-[11px] text-faint" title={user?.email}>{user?.email}</p>
          </div>
          <button type="button" onClick={out} className="rounded-lg p-2 text-faint transition-colors hover:bg-[var(--surface-hi)] hover:text-bad" aria-label="Log out" title="Log out">
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

function EdgeHint({ side, visible, onOpen }) {
  const Icon = side === 'left' ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`sidebar-edge-hint no-print hidden lg:flex ${side === 'left' ? 'is-left' : 'is-right'} ${visible ? '' : 'is-hidden'}`}
      aria-label={`Open ${side} sidebar`}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      title={`Open ${side} sidebar`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const [prefs] = useSidebarPreferences();
  const [open, setOpen] = useState(() => prefs.mode === 'button');
  const [mobileOpen, setMobileOpen] = useState(false);
  const side = prefs.position;
  const [pointerCapable, setPointerCapable] = useState(true);
  const loc = useLocation();
  const nav = useNavigate();
  const menuButton = useRef(null);
  const mobileDrawer = useRef(null);
  const mobileClose = useRef(null);
  const desktopToggle = useRef(null);
  const sidebar = useRef(null);
  const hoverTimers = useRef({ open: null, close: null });
  const suppressHoverUntil = useRef(0);
  const live = useRef({ open, side });
  const mobileSide = side;

  useEffect(() => { live.current = { open, side }; }, [open, side]);

  useEffect(() => { setMobileOpen(false); }, [loc.pathname]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [loc.pathname]);

  useEffect(() => {
    const el = sidebar.current;
    if (!el) return;
    if (open) el.removeAttribute('inert');
    else el.setAttribute('inert', '');
  }, [open]);

  useEffect(() => {
    const el = mobileDrawer.current;
    if (!el) return;
    if (mobileOpen) el.removeAttribute('inert');
    else el.setAttribute('inert', '');
  }, [mobileOpen]);

  useEffect(() => {
    const media = window.matchMedia?.(DESKTOP_QUERY);
    if (!media?.addEventListener) return undefined;
    const onChange = (event) => { if (event.matches) setMobileOpen(false); };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const fine = window.matchMedia?.(HOVER_QUERY);
    const desktop = window.matchMedia?.(DESKTOP_QUERY);
    if (!fine?.addEventListener || !desktop?.addEventListener) return undefined;
    const update = () => setPointerCapable(fine.matches && desktop.matches);
    update();
    fine.addEventListener('change', update);
    desktop.addEventListener('change', update);
    return () => {
      fine.removeEventListener('change', update);
      desktop.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = setTimeout(() => mobileClose.current?.focus(), 0);
    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const closeMobile = useCallback((restoreFocus = true) => {
    setMobileOpen(false);
    if (restoreFocus) requestAnimationFrame(() => menuButton.current?.focus());
  }, []);

  const handleMobileNavigate = useCallback(() => {
    setMobileOpen(false);
    requestAnimationFrame(() => document.getElementById('main')?.focus());
  }, []);

  const openFromSide = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() => desktopToggle.current?.focus());
  }, []);

  const toggleDesktop = useCallback(() => {
    if (open) {
      suppressHoverUntil.current = Date.now() + 900;
      setOpen(false);
    } else {
      setOpen(true);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (event) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        if (mobileOpen) closeMobile();
        else toggleDesktop();
        return;
      }
      if (event.key !== 'Escape') return;
      if (document.querySelector('dialog[open]')) return;
      if (mobileOpen) {
        closeMobile();
        return;
      }
      if (open) {
        suppressHoverUntil.current = Date.now() + 900;
        setOpen(false);
        requestAnimationFrame(() => desktopToggle.current?.focus());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeMobile, mobileOpen, open, toggleDesktop]);

  useEffect(() => {
    if (prefs.mode !== 'hover' || !pointerCapable) return undefined;
    if (typeof window === 'undefined') return undefined;

    const timers = hoverTimers.current;
    const clearOpen = () => { if (timers.open) { clearTimeout(timers.open); timers.open = null; } };
    const clearClose = () => { if (timers.close) { clearTimeout(timers.close); timers.close = null; } };
    const scheduleClose = () => {
      if (timers.close) return;
      timers.close = setTimeout(() => { timers.close = null; setOpen(false); }, CLOSE_DELAY);
    };

    const onMove = (event) => {
      if (Date.now() < suppressHoverUntil.current) return;
      const width = window.innerWidth;
      const current = live.current;
      const nearSelectedEdge = current.side === 'left'
        ? event.clientX <= EDGE_ZONE
        : event.clientX >= width - EDGE_ZONE;

      if (nearSelectedEdge) {
        clearClose();
        if (!current.open) {
          clearOpen();
          timers.open = setTimeout(() => {
            timers.open = null;
            setOpen(true);
          }, OPEN_DELAY);
        }
        return;
      }

      clearOpen();
      if (!current.open) return;

      const rect = sidebar.current?.getBoundingClientRect();
      const inside = rect
        && event.clientX >= rect.left - 16
        && event.clientX <= rect.right + 16
        && event.clientY >= rect.top - 16
        && event.clientY <= rect.bottom + 16;
      if (inside) {
        clearClose();
        return;
      }
      scheduleClose();
    };

    const onLeave = () => {
      clearOpen();
      if (live.current.open) scheduleClose();
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      clearOpen();
      clearClose();
    };
  }, [prefs.mode, pointerCapable, side]);

  useEffect(() => () => {
    if (hoverTimers.current.open) clearTimeout(hoverTimers.current.open);
    if (hoverTimers.current.close) clearTimeout(hoverTimers.current.close);
  }, []);

  const out = async () => { await logout(); nav('/login'); };
  const name = user?.displayName || user?.email;
  const contentOrder = side === 'left' ? 'order-2' : 'order-1';
  const asideOrder = side === 'left' ? 'order-1' : 'order-2';
  const hintsVisible = prefs.mode === 'hover';

  return (
    <div className="flex min-h-screen" data-sidebar-side={side} data-sidebar-mode={prefs.mode}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-xl focus:bg-[var(--surface-solid)] focus:px-4 focus:py-2 focus:text-sm focus:text-ink focus:shadow-lg"
      >
        Skip to content
      </a>

      <EdgeHint side={side} visible={hintsVisible && !open} onOpen={openFromSide} />

      <button
        ref={desktopToggle}
        type="button"
        className={`sidebar-toggle no-print fixed top-4 z-50 hidden h-10 w-10 place-items-center rounded-xl border border-line bg-[var(--surface-hi)] text-muted shadow-[var(--shadow-soft)] transition-all hover:border-line-strong hover:text-ink active:scale-95 lg:grid ${open ? 'is-open' : ''}`}
        style={side === 'left' ? { left: '0.5rem' } : { right: '0.5rem' }}
        aria-expanded={open}
        aria-controls="desktop-sidebar"
        aria-label={open ? 'Close sidebar' : 'Open sidebar'}
        title={open ? 'Close sidebar (Ctrl/⌘ + B)' : 'Open sidebar (Ctrl/⌘ + B)'}
        onClick={toggleDesktop}
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
      </button>

      <aside
        id="desktop-sidebar"
        ref={sidebar}
        aria-label="Sidebar"
        aria-hidden={!open}
        className={`app-sidebar no-print sticky top-0 hidden h-screen shrink-0 overflow-hidden lg:block ${asideOrder} ${side === 'right' ? 'sidebar-right' : ''} ${open ? 'is-open' : ''}`}
        style={{ width: open ? 'var(--sidebar-w)' : '0px' }}
      >
        <div
          className={`h-full border-line ${side === 'right' ? 'ml-auto border-l' : 'border-r'}`}
          style={{ width: 'var(--sidebar-w)', background: 'color-mix(in oklab, var(--canvas) 68%, transparent)', backdropFilter: 'blur(14px)' }}
        >
          <SidebarPanel side={side} user={user} name={name} out={out} />
        </div>
      </aside>

      <div className={`flex min-w-0 flex-1 flex-col ${contentOrder}`}>
        <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line px-4 py-2.5 lg:hidden" style={{ background: 'color-mix(in oklab, var(--canvas) 74%, transparent)', backdropFilter: 'blur(14px)' }}>
          <Brand />
          <div className="flex items-center gap-1.5">
            <NavLink to="/words/new" className="btn-primary !min-h-9 !rounded-xl !px-3 !text-xs" aria-label="Add a word">
              <PlusCircle className="h-4 w-4" aria-hidden="true" />Add
            </NavLink>
            <button
              ref={menuButton}
              type="button"
              className="btn-ghost !min-h-9 !px-2"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileOpen((value) => !value)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>

        <div className={`no-print fixed inset-0 z-40 lg:hidden ${mobileOpen ? '' : 'pointer-events-none'}`}>
          <div
            className={`absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity duration-200 ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
            onClick={() => closeMobile()}
            aria-hidden="true"
          />
          <aside
            id="mobile-nav"
            ref={mobileDrawer}
            aria-label="Mobile navigation"
            aria-hidden={!mobileOpen}
            onKeyDown={(event) => {
              if (event.key !== 'Tab') return;
              const nodes = mobileDrawer.current?.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
              if (!nodes?.length) return;
              const first = nodes[0];
              const last = nodes[nodes.length - 1];
              if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
              else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }}
            className={`absolute top-0 h-[100dvh] w-[min(20rem,86vw)] overflow-y-auto border-line shadow-[var(--shadow-lift)] transition-transform duration-200 ${mobileSide === 'left' ? 'left-0 border-r' : 'right-0 border-l'} ${mobileSide === 'right' ? 'sidebar-right' : ''} ${mobileOpen ? 'translate-x-0' : mobileSide === 'left' ? '-translate-x-full' : 'translate-x-full'}`}
            style={{ background: 'var(--surface-solid)' }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <Brand />
              <button
                ref={mobileClose}
                type="button"
                className="grid h-9 w-9 place-items-center rounded-xl border border-line text-muted transition-colors hover:text-ink"
                onClick={() => closeMobile()}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="p-4">
              <nav aria-label="Main"><NavList onNavigate={handleMobileNavigate} /></nav>
              <div className="mt-4 border-t border-line pt-3">
                <NavLink to="/settings" className="nav-link" onClick={handleMobileNavigate}>
                  <Settings className="h-4 w-4" aria-hidden="true" />Settings
                </NavLink>
                <button type="button" onClick={out} className="nav-link mt-1 w-full">
                  <LogOut className="h-4 w-4" aria-hidden="true" />Log out
                </button>
              </div>
            </div>
          </aside>
        </div>

        <main id="main" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-12 lg:pb-12 lg:pt-10">
          <div key={loc.pathname} className="page-enter"><Outlet /></div>
        </main>

        <nav aria-label="Quick" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden" style={{ background: 'color-mix(in oklab, var(--canvas) 82%, transparent)', backdropFilter: 'blur(14px)' }}>
          <div className="mx-auto grid max-w-lg grid-cols-5">
            {BOTTOM.map(({ to, label, icon: Icon, end }) => {
              const isAdd = to === '/words/new';
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) => `group relative flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${isActive ? 'text-brand' : 'text-faint'}`}
                >
                  {isAdd ? (
                    <span className="-mt-5 grid h-11 w-11 place-items-center rounded-2xl border border-black/10 bg-[var(--brand-fill)] text-[var(--on-brand)] shadow-[0_4px_12px_rgba(0,0,0,0.22)] transition-transform group-active:scale-95">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                  ) : (
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  )}
                  <span className={isAdd ? '-mt-0.5' : ''}>{label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
