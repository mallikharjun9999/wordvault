import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockApi, renderApp, okBody, errBody, json, withMe, USER } from './helpers.jsx';
import App from '../src/App.jsx';
import { EntryDocument } from '../src/pages/VocabDetail.jsx';
import { ConfirmDialog, Spinner, EmptyState } from '../src/components/ui.jsx';

const entry = (o = {}) => ({ id: 'w1', word: 'Meticulous', pronunciation: 'meh-TIK-yuh-lus', ipa: '', favorite: false, learningStatus: 'documented', source: 'manual',
  meanings: [{ partOfSpeech: 'adjective', simpleExplanation: 'Very careful.', detailedExplanation: '', teluguMeaning: 'అత్యంత జాగ్రత్తగల', teluguExplanation: '', examples: [{ en: 'A meticulous editor.', te: 'ఒక జాగ్రత్తగల సంపాదకుడు.', context: 'professional' }] }],
  synonyms: [], antonyms: [], collocations: [], phrases: [], sentencePatterns: [], usageSituations: [], commonMistakes: [], exercises: [], usageNotes: '', tags: [], categories: [], notes: '',
  srs: { dueAt: new Date(Date.now() - 1000).toISOString(), reviewCount: 0, lapses: 0, easeFactor: 2.5 }, ...o });

beforeEach(() => vi.unstubAllGlobals());

describe('auth flow', () => {
  it('redirects unauthenticated visitors to login (protected routes)', async () => {
    mockApi({ 'GET /auth/me': errBody('UNAUTHORIZED', 'Authentication required', 401) });
    renderApp(<App />, { route: '/words' });
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });
  it('shows the server error when login fails and keeps the form usable', async () => {
    mockApi({ 'GET /auth/me': errBody('UNAUTHORIZED', 'x', 401), 'POST /auth/login': errBody('INVALID_CREDENTIALS', 'Invalid email or password.', 401) });
    renderApp(<App />, { route: '/login' });
    await userEvent.type(await screen.findByLabelText('Email'), 'a@example.com'); await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled();
  });
  it('logs in and lands on the dashboard; the CSRF header is sent', async () => {
    let authed = false;
    const f = mockApi({
      'GET /auth/me': () => (authed ? okBody({ user: USER }) : errBody('UNAUTHORIZED', 'x', 401)),
      'POST /auth/login': () => { authed = true; return okBody({ user: USER }); },
      'GET /progress': okBody({ totalWords: 0, dueNow: 0, reviewsCompleted: 0, streak: { current: 0, longest: 0 }, quiz: { accuracy: null, attempts: 0, questionsAnswered: 0, correct: 0 }, statusCounts: {}, activeUse: 0, mastered: 0, wordsOverTime: [], reviewsOverTime: [], difficultWords: [], recentWords: [], recentActivity: [], definitions: {} }),
    });
    renderApp(<App />, { route: '/login' });
    await userEvent.type(await screen.findByLabelText('Email'), 'a@example.com'); await userEvent.type(screen.getByLabelText('Password'), 'password-1234');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText(/Hello, Asha/)).toBeInTheDocument();
    expect(screen.getByText(/Your vault is empty/)).toBeInTheDocument(); // honest empty dashboard, no fake numbers
    const loginCall = f.mock.calls.find(([u]) => String(u).endsWith('/auth/login'));
    expect(loginCall[1].headers['X-WordVault-Client']).toBe('1'); expect(loginCall[1].credentials).toBe('include');
  });
});

describe('vocabulary list states (loading / error / empty / data)', () => {
  it('shows loading, then the empty state for a new user', async () => {
    mockApi(withMe({ 'GET /vocabulary/facets': okBody({ categories: [], tags: [] }), 'GET /vocabulary?': okBody({ items: [] }, { page: 1, pages: 1, total: 0, limit: 20 }) }));
    renderApp(<App />, { route: '/words' });
    expect(await screen.findByText('Your vault is empty')).toBeInTheDocument();
  });
  it('shows an error with retry when the API fails', async () => {
    let fail = true;
    mockApi(withMe({ 'GET /vocabulary/facets': okBody({ categories: [], tags: [] }), 'GET /vocabulary?': () => (fail ? errBody('DATABASE_UNAVAILABLE', 'Database is unavailable.', 503) : okBody({ items: [entry()] }, { page: 1, pages: 1, total: 1, limit: 20 })) }));
    renderApp(<App />, { route: '/words' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Database is unavailable.');
    fail = false; await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Meticulous')).toBeInTheDocument();
    expect(screen.getByText('అత్యంత జాగ్రత్తగల')).toHaveAttribute('lang', 'te');
  });
  it('shows a "no matches" state with clear-filters when filtering finds nothing', async () => {
    mockApi(withMe({ 'GET /vocabulary/facets': okBody({ categories: [], tags: [] }), 'GET /vocabulary?': okBody({ items: [] }, { page: 1, pages: 1, total: 0, limit: 20 }) }));
    renderApp(<App />, { route: '/words?status=mastered' });
    expect(await screen.findByText('No matching words')).toBeInTheDocument();
  });
});

describe('AI generation UI', () => {
  it('tells the truth when no AI provider is configured and disables generation', async () => {
    mockApi(withMe({ 'GET /ai/status': okBody({ generation: { configured: false, reason: 'AI_PROVIDER is not set.' } }) }));
    renderApp(<App />, { route: '/words/new' });
    expect(await screen.findByText(/nothing will be generated/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/English word/), 'candid');
    expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled();
    expect(screen.getByRole('tab', { name: /write manually/i })).toBeInTheDocument();
  });
  it('duplicate word: shows the existing entry with Open/Edit and does not navigate', async () => {
    mockApi(withMe({ 'GET /ai/status': okBody({ generation: { configured: true } }), 'POST /vocabulary/generate': okBody({ entry: entry(), existing: true }) }));
    renderApp(<App />, { route: '/words/new' });
    await userEvent.type(await screen.findByLabelText(/English word/), 'meticulous'); await userEvent.click(screen.getByRole('button', { name: /^generate/i }));
    expect(await screen.findByText(/already in your vault/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/words/w1'); expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/words/w1/edit');
  });
  it('provider failure keeps the typed word, shows the error, and offers retry', async () => {
    mockApi(withMe({ 'GET /ai/status': okBody({ generation: { configured: true } }), 'POST /vocabulary/generate': errBody('PROVIDER_TIMEOUT', 'The AI provider took too long to respond.', 504) }));
    renderApp(<App />, { route: '/words/new' });
    await userEvent.type(await screen.findByLabelText(/English word/), 'lucid'); await userEvent.click(screen.getByRole('button', { name: /^generate/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('took too long');
    expect(screen.getByLabelText(/English word/)).toHaveValue('lucid'); expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('English and Telugu rendering', () => {
  it('Telugu is the default view, and English stays visible', () => {
    renderApp(<EntryDocument entry={entry()} lang="te" />);
    expect(screen.getByText('Meticulous')).toBeInTheDocument(); expect(screen.getByText('అత్యంత జాగ్రత్తగల').closest('[lang]')).toHaveAttribute('lang', 'te'); expect(screen.getByText('ఒక జాగ్రత్తగల సంపాదకుడు.')).toHaveAttribute('lang', 'te');
  });
});

describe('review session', () => {
  it('reveal -> rate posts an idempotency key; "Again" cards return to the queue; summary shown', async () => {
    const e1 = entry({ id: 'w1', word: 'alpha' });
    const posts = [];
    mockApi(withMe({
      'GET /reviews/queue': okBody({ items: [e1] }, { dueTotal: 1 }),
      'POST /reviews': (b) => { posts.push(b); return okBody({ review: {}, entry: { ...e1, srs: { ...e1.srs, reviewCount: posts.length } }, duplicate: false }); },
    }));
    renderApp(<App />, { route: '/review' });
    await userEvent.click(await screen.findByRole('button', { name: /reveal meaning/i }));
    expect(screen.getByText('Very careful.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^again/i }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({ vocabularyId: 'w1', rating: 'again' }); expect(posts[0].requestId.length).toBeGreaterThanOrEqual(8);
    expect(await screen.findByRole('heading', { name: 'alpha' })).toBeInTheDocument(); // came back this session
    await userEvent.click(screen.getByRole('button', { name: /reveal meaning/i })); await userEvent.click(screen.getByRole('button', { name: /^good/i }));
    expect(await screen.findByText(/Session complete/)).toBeInTheDocument();
    expect(posts[1].requestId).not.toBe(posts[0].requestId);
  });
  it('shows the empty state when nothing is due', async () => {
    mockApi(withMe({ 'GET /reviews/queue': okBody({ items: [] }, { dueTotal: 0 }) }));
    renderApp(<App />, { route: '/review' });
    expect(await screen.findByText('Nothing due right now')).toBeInTheDocument();
  });
});

describe('shared UI', () => {
  it('confirmation dialog requires an explicit confirm before a destructive action', async () => {
    const onConfirm = vi.fn(); const onCancel = vi.fn();
    renderApp(<ConfirmDialog open title="Delete?" message="Sure?" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(onCancel).toHaveBeenCalled(); expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' })); expect(onConfirm).toHaveBeenCalledTimes(1);
  });
  it('loading and empty primitives expose accessible roles', () => {
    renderApp(<><Spinner /><EmptyState title="Nothing" /></>);
    expect(screen.getByRole('status')).toHaveTextContent('Loading'); expect(screen.getByRole('heading', { name: 'Nothing' })).toBeInTheDocument();
  });
  it('app shell offers both desktop sidebar and mobile menu navigation with labelled landmarks', async () => {
    mockApi(withMe({ 'GET /progress': okBody({ totalWords: 0, dueNow: 0, reviewsCompleted: 0, streak: { current: 0, longest: 0 }, quiz: { accuracy: null, attempts: 0, questionsAnswered: 0, correct: 0 }, statusCounts: {}, activeUse: 0, mastered: 0, wordsOverTime: [], reviewsOverTime: [], difficultWords: [], recentWords: [], recentActivity: [], definitions: {} }) }));
    renderApp(<App />, { route: '/' });
    await screen.findByText(/Hello, Asha/);
    expect(screen.getAllByRole('navigation', { name: 'Main' }).length).toBe(1); // sidebar; mobile menu is collapsed
    await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
    expect(screen.getAllByRole('navigation', { name: 'Main' }).length).toBe(2);
    expect(screen.getByRole('link', { name: /skip to content/i })).toBeInTheDocument();
    expect(screen.queryByText(/admin/i)).toBeNull(); // no admin UI anywhere
  });
});
