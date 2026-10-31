import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { setupDb, teardownDb, newUser, sampleEntry, legacyTranslation } from './helpers.js';
import { User, Translation } from '../src/models/index.js';
import { SUPPORTED_LANGUAGES, LANGUAGE_CODES, LANGUAGES, DEFAULT_LANGUAGE, isSupportedLanguage, toSupportedLanguage } from '../src/utils/languages.js';

beforeAll(setupDb); afterAll(teardownDb);

describe('supported languages: English and Telugu only', () => {
  it('the central definition contains exactly en and te, Telugu by default', () => {
    expect(SUPPORTED_LANGUAGES).toEqual({ ENGLISH: 'en', TELUGU: 'te' });
    expect([...LANGUAGE_CODES]).toEqual(['en', 'te']);
    expect(DEFAULT_LANGUAGE).toBe('te');
    expect(LANGUAGES.map((l) => l.code)).toEqual(['en', 'te']);
    expect(isSupportedLanguage('en')).toBe(true); expect(isSupportedLanguage('te')).toBe(true);
    for (const c of ['hi', 'ta', 'kn', 'ml', 'fr', 'de', 'es', 'ja', 'zh', 'EN', '', undefined, null]) expect(isSupportedLanguage(c)).toBe(false);
  });
  it('GET /api/languages lists exactly English and Telugu, with no provider / support metadata', async () => {
    const u = await newUser(); const r = await u.get('/api/languages');
    expect(r.status).toBe(200);
    expect(r.body.data.languages).toEqual([{ code: 'en', name: 'English', native: 'English' }, { code: 'te', name: 'Telugu', native: 'తెలుగు' }]);
    expect(r.body.data.provider).toBeUndefined();
  });
  it('Telugu is the default explanation language and the English → Telugu entry round-trips', async () => {
    const u = await newUser(); expect(u.user.preferences.explanationLanguage).toBe('te');
    const c = await u.post('/api/vocabulary', sampleEntry('graceful'));
    const g = (await u.get(`/api/vocabulary/${c.body.data.entry.id}`)).body.data.entry.meanings[0];
    expect(g.teluguMeaning).toBe('graceful-తెలుగు'); expect(g.teluguExplanation).toBe('తెలుగు వివరణ'); expect(g.examples[0].te).toBe('ఇది ఒక ఉదాహరణ');
  });
  it('accepts en and te as the explanation language and persists the choice', async () => {
    const u = await newUser();
    expect((await u.patch('/api/auth/me', { explanationLanguage: 'en' })).body.data.user.preferences.explanationLanguage).toBe('en');
    expect((await u.get('/api/auth/me')).body.data.user.preferences.explanationLanguage).toBe('en');
    expect((await u.patch('/api/auth/me', { explanationLanguage: 'te' })).body.data.user.preferences.explanationLanguage).toBe('te');
    expect((await u.get('/api/auth/me')).body.data.user.preferences.explanationLanguage).toBe('te');
  });
  it('rejects every other language code with HTTP 400 and a meaningful message; the stored preference is unchanged', async () => {
    const u = await newUser();
    for (const bad of ['hi', 'ta', 'kn', 'ml', 'fr', 'de', 'es', 'ja', 'zh', 'ur', 'xx', 'EN', 'english', '']) {
      const r = await u.patch('/api/auth/me', { explanationLanguage: bad });
      expect(r.status, `code "${bad}"`).toBe(400);
      expect(r.body).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
      expect(r.body.error.details[0]).toMatchObject({ path: 'explanationLanguage', message: 'Unsupported language. Supported languages: en, te.' });
    }
    for (const bad of [null, 123, ['en'], { code: 'en' }]) expect((await u.patch('/api/auth/me', { explanationLanguage: bad })).status).toBe(400);
    expect((await u.get('/api/auth/me')).body.data.user.preferences.explanationLanguage).toBe('te');
  });
  it('removed translation endpoints no longer exist, and the retired hasTranslation filter is ignored', async () => {
    const u = await newUser(); const v = (await u.post('/api/vocabulary', sampleEntry('gone'))).body.data.entry;
    const body = { meanings: [{ meaning: 'x', explanation: '', examples: [] }] };
    for (const lang of ['hi', 'te', 'en']) {
      expect((await u.put(`/api/vocabulary/${v.id}/translations/${lang}`, body)).status).toBe(404);
      expect((await u.get(`/api/vocabulary/${v.id}/translations/${lang}`)).status).toBe(404);
      expect((await u.post(`/api/vocabulary/${v.id}/translations/${lang}/generate`, {})).status).toBe(404);
    }
    expect((await u.get(`/api/vocabulary/${v.id}/translations`)).status).toBe(404);
    expect((await u.get('/api/languages/translations')).status).toBe(404);
    expect((await u.get('/api/vocabulary?hasTranslation=fr')).body.data.items).toHaveLength(1); // unknown query keys are stripped, not an error
  });
  it('AI status reports generation only (no separate translation provider any more)', async () => {
    const u = await newUser(); const r = await u.get('/api/ai/status');
    expect(r.status).toBe(200); expect(r.body.data).toHaveProperty('generation'); expect(r.body.data).not.toHaveProperty('translation');
  });
});

describe('backward compatibility with data created before the cleanup', () => {
  it('toSupportedLanguage maps unsupported stored codes to the default', () => {
    expect(toSupportedLanguage('en')).toBe('en'); expect(toSupportedLanguage('te')).toBe('te');
    for (const c of ['hi', 'ta', 'fr', '', undefined, null]) expect(toSupportedLanguage(c)).toBe('te');
  });
  it('a legacy preference (e.g. "hi") is reported as Telugu but never rewritten; other settings keep saving', async () => {
    const u = await newUser(); const _id = new mongoose.Types.ObjectId(u.user.id);
    await User.collection.updateOne({ _id }, { $set: { 'preferences.explanationLanguage': 'hi' } }); // raw write = how an old account looks
    expect((await u.get('/api/auth/me')).body.data.user.preferences.explanationLanguage).toBe('te');
    const r = await u.patch('/api/auth/me', { theme: 'dark', dailyReviewLimit: 40 });
    expect(r.status).toBe(200); expect(r.body.data.user.preferences).toMatchObject({ theme: 'dark', dailyReviewLimit: 40, explanationLanguage: 'te' });
    expect((await User.collection.findOne({ _id })).preferences.explanationLanguage).toBe('hi'); // stored value untouched
  });
  it('legacy translations in other languages are kept, exported with readable names, and never block the word', async () => {
    const u = await newUser(); const e = sampleEntry('lyrical'); e.meanings[0].teluguMeaning = 'గేయాత్మక, "కవితాత్మక"';
    const v = (await u.post('/api/vocabulary', e)).body.data.entry;
    await legacyTranslation(u.user.id, v.id, 'ur', 'غنائی'); await legacyTranslation(u.user.id, v.id, 'hi', 'गेय');
    expect((await u.get(`/api/vocabulary/${v.id}`)).status).toBe(200);
    expect(await Translation.countDocuments({ vocabularyId: v.id })).toBe(2);
    const j = JSON.parse((await u.get('/api/export/vocabulary?format=json')).text);
    expect(j.vocabulary[0].meanings[0].teluguMeaning).toBe('గేయాత్మక, "కవితాత్మక"');
    expect(j.translations.map((t) => t.language).sort()).toEqual(['hi', 'ur']);
    const csv = await u.get('/api/export/vocabulary?format=csv').buffer(true);
    expect(csv.headers['content-type']).toMatch(/text\/csv/); expect(csv.text.charCodeAt(0)).toBe(0xfeff);
    expect(csv.text).toContain('"గేయాత్మక, ""కవితాత్మక"""');
    const md = (await u.get('/api/export/vocabulary?format=md')).text;
    expect(md).toContain('గేయాత్మక'); expect(md).toContain('غنائی'); expect(md).toContain('### Hindi'); expect(md).toContain('### Urdu');
  });
});
