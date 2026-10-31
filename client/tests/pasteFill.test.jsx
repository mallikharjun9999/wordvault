import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AddWord from '../src/pages/AddWord.jsx';
import { mockApi, okBody } from './helpers.jsx';

const ENTRY = `Word: meticulous
Pronunciation guide: meh-TIK-yuh-lus
IPA: /məˈtɪkjələs/

Meaning 1
Part of speech: adjective
Simple English explanation: Extremely careful about details.
Telugu meaning: అత్యంత జాగ్రత్తగల
Examples:
1. She is meticulous about her work. | ఆమె తన పనిలో చాలా జాగ్రత్తగా ఉంటుంది. | professional

Meaning 2
Part of speech: adjective
Simple English explanation: Very precise.
Telugu meaning: చాలా కచ్చితమైన`;

const renderAdd = () => render(
  <MemoryRouter initialEntries={['/words/new']}><AddWord /></MemoryRouter>,
);

const paste = async (text) => {
  await userEvent.click(screen.getByRole('button', { name: /paste & auto-fill/i }));
  fireEvent.change(await screen.findByLabelText(/vocabulary entry/i), { target: { value: text } });
};

beforeEach(() => {
  vi.unstubAllGlobals();
  mockApi({ 'GET /ai/status': okBody({ generation: { configured: true, provider: 'fake', model: 'fake-1' } }) });
});

describe('AddWord — Paste & Auto-Fill', () => {
  it('fills the real manual form, including multiple meanings and examples', async () => {
    renderAdd();
    await paste(ENTRY);
    await userEvent.click(screen.getByRole('button', { name: /use & fill/i }));

    const wordInput = await screen.findByLabelText(/english word or expression/i);
    expect(wordInput).toHaveValue('meticulous');
    expect(screen.getByLabelText(/pronunciation guide/i)).toHaveValue('meh-TIK-yuh-lus');
    expect(screen.getByLabelText(/^ipa$/i)).toHaveValue('/məˈtɪkjələs/');
    expect(screen.getByRole('heading', { name: 'Meaning 2' })).toBeInTheDocument();
    expect(screen.getAllByLabelText(/telugu meaning/i)[0]).toHaveValue('అత్యంత జాగ్రత్తగల');
    expect(screen.getByLabelText(/context/i)).toHaveTextContent('professional');
    expect(screen.getByRole('status')).toHaveTextContent(/filled/i);
  });

  it('Close keeps the form untouched', async () => {
    renderAdd();
    await paste(ENTRY);
    await userEvent.click(screen.getByRole('button', { name: /^close$/i }));
    expect(screen.queryByLabelText(/vocabulary entry/i)).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/english word or expression/i).every((el) => el.value === '')).toBe(true);
  });

  it('shows an error for empty input and keeps the dialog open', async () => {
    renderAdd();
    await userEvent.click(screen.getByRole('button', { name: /paste & auto-fill/i }));
    await userEvent.click(screen.getByRole('button', { name: /use & fill/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/paste a vocabulary entry/i);
    expect(screen.getByLabelText(/vocabulary entry/i)).toBeInTheDocument();
  });

  it('asks before overwriting existing form data and merges when chosen', async () => {
    renderAdd();
    await userEvent.click(screen.getByRole('tab', { name: /write manually/i }));
    await userEvent.type(await screen.findByLabelText(/english word or expression/i), 'alpha');
    await userEvent.type(screen.getByLabelText(/telugu meaning/i), 'మొదటి');

    await paste('Word: beta\nMeaning 1\nSimple English explanation: Second.');
    await userEvent.click(screen.getByRole('button', { name: /use & fill/i }));

    expect(await screen.findByText(/form already has content/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /merge/i })).toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: /use & fill/i }));
    expect(screen.getByLabelText(/english word or expression/i)).toHaveValue('alpha'); // existing scalar wins
    expect(screen.getByRole('heading', { name: 'Meaning 2' })).toBeInTheDocument(); // parsed meaning appended
    expect(screen.getAllByLabelText(/telugu meaning/i).map((el) => el.value)).toEqual(['మొదటి', '']);
  });

  it('replaces the form when Replace is chosen', async () => {
    renderAdd();
    await userEvent.click(screen.getByRole('tab', { name: /write manually/i }));
    await userEvent.type(await screen.findByLabelText(/english word or expression/i), 'alpha');

    await paste('Word: beta\nMeaning 1\nSimple English explanation: Second.');
    await userEvent.click(screen.getByRole('button', { name: /use & fill/i }));
    await screen.findByText(/form already has content/i);
    await userEvent.click(screen.getByRole('radio', { name: /replace/i }));
    await userEvent.click(screen.getByRole('button', { name: /use & fill/i }));

    expect(screen.getByLabelText(/english word or expression/i)).toHaveValue('beta');
  });

  it('saves the filled form through the existing API contract', async () => {
    const fetchMock = mockApi({
      'GET /ai/status': okBody({ generation: { configured: true, provider: 'fake', model: 'fake-1' } }),
      'POST /vocabulary': okBody({ entry: { id: 'w1', word: 'meticulous' } }),
    });
    renderAdd();
    await paste(ENTRY);
    await userEvent.click(screen.getByRole('button', { name: /use & fill/i }));

    await userEvent.click(await screen.findByRole('button', { name: /^save word$/i }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith('/vocabulary') && (init?.method || 'GET') === 'POST')).toBe(true);
    });
    const call = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/vocabulary') && (init?.method || 'GET') === 'POST');
    const body = JSON.parse(call[1].body);

    expect(body.word).toBe('meticulous');
    expect(body.pronunciation).toBe('meh-TIK-yuh-lus');
    expect(body.ipa).toBe('/məˈtɪkjələs/');
    expect(body.meanings).toHaveLength(2);
    expect(body.meanings[0].partOfSpeech).toBe('adjective');
    expect(body.meanings[0].simpleExplanation).toBe('Extremely careful about details.');
    expect(body.meanings[0].teluguMeaning).toBe('అత్యంత జాగ్రత్తగల');
    expect(body.meanings[0].examples).toEqual([
      { en: 'She is meticulous about her work.', te: 'ఆమె తన పనిలో చాలా జాగ్రత్తగా ఉంటుంది.', context: 'professional' },
    ]);
    expect(body.meanings[1].teluguMeaning).toBe('చాలా కచ్చితమైన');
  });
});
