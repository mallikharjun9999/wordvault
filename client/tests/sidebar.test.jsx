import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockApi, renderApp, okBody, withMe } from './helpers.jsx';
import App from '../src/App.jsx';
import { setSidebarPreferences } from '../src/hooks/useSidebarPreferences.js';

const PROGRESS = okBody({
  totalWords: 0, dueNow: 0, reviewsCompleted: 0,
  streak: { current: 0, longest: 0 },
  quiz: { accuracy: null, attempts: 0, questionsAnswered: 0, correct: 0 },
  statusCounts: {}, activeUse: 0, mastered: 0,
  wordsOverTime: [], reviewsOverTime: [], difficultWords: [], recentWords: [], recentActivity: [], definitions: {},
});

async function renderShell() {
  mockApi(withMe({ 'GET /progress': PROGRESS }));
  renderApp(<App />, { route: '/' });
  await screen.findByText(/Hello, Asha/);
}

beforeEach(() => {
  setSidebarPreferences({ mode: 'button', position: 'left' });
});

describe('dual-side sidebar', () => {
  it('button mode opens and closes the desktop sidebar', async () => {
    await renderShell();
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: /close sidebar/i }));
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /open sidebar/i }));
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1);
  });

  it('applies the selected right position to the shell and its active indicator', async () => {
    setSidebarPreferences({ mode: 'button', position: 'right' });
    await renderShell();
    const sidebar = document.getElementById('desktop-sidebar');
    expect(sidebar).toHaveClass('sidebar-right');
    expect(sidebar).toHaveClass('order-2');
    expect(sidebar).toHaveAttribute('aria-hidden', 'false');
  });

  it('hover mode opens only at the selected edge and closes after the pointer leaves', async () => {
    setSidebarPreferences({ mode: 'hover', position: 'left' });
    await renderShell();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();

    fireEvent(document, new MouseEvent('pointermove', { clientX: 4, clientY: 300, bubbles: true }));
    await waitFor(() => expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1), { timeout: 1200 });
    expect(document.getElementById('desktop-sidebar')).not.toHaveClass('sidebar-right');

    fireEvent(document, new MouseEvent('pointermove', { clientX: window.innerWidth - 4, clientY: 300, bubbles: true }));
    expect(document.getElementById('desktop-sidebar')).not.toHaveClass('sidebar-right');
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull(), { timeout: 1600 });

    setSidebarPreferences({ position: 'right' });
    await waitFor(() => expect(document.getElementById('desktop-sidebar')).toHaveClass('sidebar-right'));
    fireEvent(document, new MouseEvent('pointermove', { clientX: window.innerWidth - 4, clientY: 300, bubbles: true }));
    await waitFor(() => expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1), { timeout: 1200 });
    expect(document.getElementById('desktop-sidebar')).toHaveClass('sidebar-right');
  });

  it('moves a single sidebar when the selected position changes', async () => {
    await renderShell();
    const sidebar = document.getElementById('desktop-sidebar');
    expect(sidebar).toHaveClass('order-1');
    expect(sidebar).not.toHaveClass('sidebar-right');

    setSidebarPreferences({ position: 'right' });
    await waitFor(() => expect(sidebar).toHaveClass('sidebar-right'));
    expect(sidebar).toHaveClass('order-2');
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1);
  });


  it('supports the keyboard shortcut and Escape', async () => {
    await renderShell();
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1);

    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();

    fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });

  it('opens a mobile drawer on the configured edge and closes it with Escape', async () => {
    setSidebarPreferences({ mode: 'button', position: 'right' });
    await renderShell();

    await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
    const drawer = document.getElementById('mobile-nav');
    expect(drawer).toHaveAttribute('aria-hidden', 'false');
    expect(drawer).toHaveClass('right-0');
    expect(drawer).toHaveClass('translate-x-0');
    expect(within(drawer).getByRole('navigation', { name: 'Main' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(drawer).toHaveAttribute('aria-hidden', 'true'));
    expect(screen.getByRole('button', { name: /open menu/i })).toHaveFocus();
  });

  it('persists interaction and position preferences from Settings', async () => {
    mockApi(withMe({}));
    renderApp(<App />, { route: '/settings' });
    await screen.findByRole('heading', { name: 'Sidebar' });

    await userEvent.click(screen.getByLabelText('Hover to open'));
    await userEvent.click(screen.getByLabelText('Right'));

    expect(JSON.parse(window.localStorage.getItem('wordvault.sidebar.preferences'))).toEqual({ mode: 'hover', position: 'right' });
  });
});
