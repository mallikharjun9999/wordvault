import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockApi, renderApp, okBody, withMe, USER } from './helpers.jsx';
import App from '../src/App.jsx';
import { EntryDocument } from '../src/pages/VocabDetail.jsx';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, languageLabel, normalizeLanguage } from '../src/utils/languages.js';
import { setSidebarPreferences } from '../src/hooks/useSidebarPreferences.js';

const RETIRED = ['Hindi', 'Tamil', 'Kannada', 'Malayalam', 'French', 'German', 'Spanish', 'Japanese', 'Chinese', 'Urdu', 'Bengali', 'Marathi', 'Gujarati'];
const userWith = (explanationLanguage) => ({ ...USER, preferences: { ...USER.preferences, explanationLanguage } });
const entry = () => ({ id: 'w1', word: 'Meticulous', pronunciation: '', ipa: '', favorite: false, learningStatus: 'documented', source: 'manual',
  meanings: [{ partOfSpeech: 'adjective', simpleExplanation: 'Very careful.', detailedExplanation: '', teluguMeaning: 'అత్యంత జాగ్రత్తగల', teluguExplanation: 'చాలా జాగ్రత్తగా',
    examples: [{ en: 'A meticulous editor.', te: 'ఒక జాగ్రత్తగల సంపాదకుడు.', context: 'general' }] }],
  synonyms: [], antonyms: [], collocations: [], phrases: [], sentencePatterns: [], usageSituations: [], commonMistakes: [], exercises: [], usageNotes: '', tags: [], categories: [], notes: '',
  srs: { dueAt: new Date(Date.now() - 1000).toISOString(), reviewCount: 0, lapses: 0, easeFactor: 2.5 } });
const PROGRESS = okBody({
  totalWords: 0, dueNow: 0, reviewsCompleted: 0, streak: { current: 0, longest: 0 }, quiz: { accuracy: null, attempts: 0, questionsAnswered: 0, correct: 0 },
  statusCounts: {}, activeUse: 0, mastered: 0, wordsOverTime: [], reviewsOverTime: [], difficultWords: [], recentWords: [], recentActivity: [], definitions: {},
});
const urlsCalled = (fetchMock) => fetchMock.mock.calls.map((c) => String(c[0]));
const optionLabels = async (name) => {
  await userEvent.click(screen.getByRole('button', { name }));
  const list = await screen.findByRole('listbox');
  return within(list).getAllByRole('option').map((o) => o.textContent.trim());
};

beforeEach(() => { vi.unstubAllGlobals(); setSidebarPreferences({ mode: 'button', position: 'left' }); });

describe('language definition', () => {
  it('supports exactly English and Telugu, Telugu by default', () => {
    expect(SUPPORTED_LANGUAGES.map((l) => l.code)).toEqual(['en', 'te']);
    expect(DEFAULT_LANGUAGE).toBe('te');
    expect(SUPPORTED_LANGUAGES.map(languageLabel)).toEqual(['English', 'Telugu — తెలుగు']);
  });
  it('normalizeLanguage keeps en/te and maps any retired or missing code to Telugu', () => {
    expect(normalizeLanguage('en')).toBe('en'); expect(normalizeLanguage('te')).toBe('te');
    for (const c of ['hi', 'ta', 'ur', 'fr', '', undefined, null]) expect(normalizeLanguage(c)).toBe('te');
  });
});

describe('entry view by explanation language', () => {
  it('te: English plus the Telugu meaning, explanation and example translation', () => {
    const { container } = renderApp(<EntryDocument entry={entry()} lang="te" />);
    expect(screen.getByText('Very careful.')).toHaveAttribute('lang', 'en');
    expect(screen.getByText('అత్యంత జాగ్రత్తగల')).toBeInTheDocument(); expect(screen.getByText('చాలా జాగ్రత్తగా')).toBeInTheDocument(); expect(screen.getByText('ఒక జాగ్రత్తగల సంపాదకుడు.')).toBeInTheDocument();
    expect(container.querySelectorAll('[lang="te"]').length).toBeGreaterThan(0);
  });
  it('en: English only, with no Telugu and no "no translation" banner', () => {
    const { container } = renderApp(<EntryDocument entry={entry()} lang="en" />);
    expect(screen.getByText('Meticulous')).toBeInTheDocument(); expect(screen.getByText('Very careful.')).toBeInTheDocument(); expect(screen.getByText('A meticulous editor.')).toBeInTheDocument();
    expect(container.querySelector('[lang="te"]')).toBeNull();
    expect(screen.queryByText(/translation yet/i)).toBeNull();
  });
});

describe('language selectors list only English and Telugu', () => {
  it('Settings → Languages offers exactly two options, saves the choice, and makes no language/translation API calls', async () => {
    const fetchMock = mockApi(withMe({ 'PATCH /auth/me': (b) => okBody({ user: { ...USER, preferences: { ...USER.preferences, ...b } } }) }));
    renderApp(<App />, { route: '/settings/languages' });
    expect(await screen.findByRole('heading', { name: 'Explanation language' })).toBeInTheDocument();
    expect(await optionLabels(/preferred explanation language/i)).toEqual(['English', 'Telugu — తెలుగు']);
    await userEvent.click(screen.getByRole('option', { name: 'English' }));
    await userEvent.click(screen.getByRole('button', { name: /save preference/i }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith('/auth/me') && i?.method === 'PATCH')).toBe(true));
    const patch = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith('/auth/me') && i?.method === 'PATCH');
    expect(JSON.parse(patch[1].body)).toEqual({ explanationLanguage: 'en' });
    for (const name of RETIRED) expect(document.body.textContent).not.toContain(name);
    expect(urlsCalled(fetchMock).filter((u) => /\/languages|\/translations/.test(u))).toEqual([]);
  });
  it('an account that still carries a retired language code is shown as Telugu', async () => {
    mockApi(withMe({}, userWith('hi')));
    renderApp(<App />, { route: '/settings/languages' });
    expect(await screen.findByRole('button', { name: /preferred explanation language/i })).toHaveTextContent('Telugu — తెలుగు');
  });
  it('Word details: "Explain in" offers only English and Telugu; English hides Telugu; no translation requests are made', async () => {
    const fetchMock = mockApi(withMe({ 'GET /vocabulary/w1': okBody({ entry: entry() }) }));
    const { container } = renderApp(<App />, { route: '/words/w1' });
    expect(await screen.findByText('Very careful.')).toBeInTheDocument();
    expect(screen.getByText('అత్యంత జాగ్రత్తగల')).toBeInTheDocument();
    expect(await optionLabels(/explanation language/i)).toEqual(['English', 'Telugu — తెలుగు']);
    await userEvent.click(screen.getByRole('option', { name: 'English' }));
    await waitFor(() => expect(screen.queryByText('అత్యంత జాగ్రత్తగల')).toBeNull());
    expect(container.querySelector('[lang="te"]')).toBeNull(); expect(screen.getByText('Very careful.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /explanation language/i }));
    await userEvent.click(await screen.findByRole('option', { name: 'Telugu — తెలుగు' }));
    expect(await screen.findByText('అత్యంత జాగ్రత్తగల')).toBeInTheDocument();
    expect(urlsCalled(fetchMock).filter((u) => /\/languages|\/translations/.test(u))).toEqual([]);
  });
  it('Word library: the Filters panel has no "Has translation" language selector', async () => {
    mockApi(withMe({ 'GET /vocabulary/facets': okBody({ categories: ['food'], tags: ['t'] }), 'GET /vocabulary?': okBody({ items: [] }, { page: 1, pages: 1, total: 0, limit: 20 }) }));
    renderApp(<App />, { route: '/words' });
    await userEvent.click(await screen.findByRole('button', { name: /filters/i }));
    expect(await screen.findByRole('button', { name: 'All categories' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All tags' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Any status' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /has translation/i })).toBeNull();
  });
});

describe('review honours the explanation language', () => {
  const run = async (lang) => {
    mockApi(withMe({ 'GET /reviews/queue': okBody({ items: [entry()] }, { dueTotal: 1 }) }, userWith(lang)));
    renderApp(<App />, { route: '/review' });
    await userEvent.click(await screen.findByRole('button', { name: /reveal meaning/i }));
    expect(await screen.findByText('Very careful.')).toBeInTheDocument();
  };
  it('te: shows the Telugu meaning', async () => { await run('te'); expect(screen.getByText('అత్యంత జాగ్రత్తగల')).toHaveAttribute('lang', 'te'); });
  it('en: English only', async () => { await run('en'); expect(screen.queryByText('అత్యంత జాగ్రత్తగల')).toBeNull(); });
  it('retired code: behaves as Telugu', async () => { await run('ta'); expect(screen.getByText('అత్యంత జాగ్రత్తగల')).toBeInTheDocument(); });
});

describe('the Translations area is gone', () => {
  it('has no Translations link in the navigation, and /translations falls back to the dashboard', async () => {
    mockApi(withMe({ 'GET /progress': PROGRESS }));
    renderApp(<App />, { route: '/translations' });
    await screen.findByText(/Hello, Asha/);
    expect(screen.queryByRole('link', { name: /translations/i })).toBeNull();
    expect(screen.getByRole('link', { name: /my words/i })).toBeInTheDocument(); expect(screen.getByRole('link', { name: /difficult words/i })).toBeInTheDocument();
  });
});
