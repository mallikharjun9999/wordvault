import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardPaste, FileText, Sparkles, Wand2, ShieldCheck, ListChecks } from 'lucide-react';
import { api } from '../api/client.js';
import { Dialog, ErrorBanner, Notice, PageHeader } from '../components/ui.jsx';
import VocabForm from '../components/VocabForm.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { parsePastedEntry } from '../utils/pasteParser.js';
import { Reveal } from '../components/visual.jsx';

const PASTE_PLACEHOLDER = `Paste a full entry in almost any layout, for example:

Word: meticulous
Pronunciation guide: meh-TIK-yuh-lus
IPA: /məˈtɪkjələs/

Meaning 1
Part of speech: adjective
Simple English explanation: Extremely careful about details.
Telugu meaning: అత్యంత జాగ్రత్తగల

Examples:
1. She is meticulous about her work. | ఆమె తన పనిలో చాలా జాగ్రత్తగా ఉంటుంది. | professional

Synonyms:
careful | thorough and cautious

Antonyms: careless, sloppy
Collocations:
meticulous attention
meticulous planning
Tags: adjective, C1`;

const TABS = [['ai', 'Generate with AI', Sparkles], ['manual', 'Write manually', FileText]];

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function AddWord() {
  const nav = useNavigate();
  const [tab, setTab] = useState('ai');
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [existing, setExisting] = useState(null);
  const status = useAsync(async () => (await api.get('/ai/status')).data, []);
  const gen = status.data?.generation;

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [pasteResult, setPasteResult] = useState(null); // parsed result awaiting a merge/replace choice
  const [pasteMode, setPasteMode] = useState('merge');
  const [pasteNotice, setPasteNotice] = useState(null);
  const [incoming, setIncoming] = useState(null); // handed to VocabForm
  const [formDirty, setFormDirty] = useState(false);
  const onDirtyChange = useCallback((v) => setFormDirty(v), []);

  const generate = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null); setExisting(null);
    try {
      const r = (await api.post('/vocabulary/generate', { word })).data;
      if (r.existing) setExisting(r.entry); else nav(`/words/${r.entry.id}`);
    } catch (x) { setErr(x); } finally { setBusy(false); } // `word` is kept so the user can simply retry
  };
  const manual = async (payload) => { const r = await api.post('/vocabulary', payload); nav(`/words/${r.data.entry.id}`); };

  const openPaste = () => { setPasteError(''); setPasteResult(null); setPasteMode('merge'); setPasteOpen(true); };
  const closePaste = () => { setPasteOpen(false); setPasteResult(null); setPasteError(''); };
  const switchTab = (next) => {
    // Leaving the manual tab unmounts VocabForm, so its draft no longer exists to protect.
    if (next !== 'manual' && tab === 'manual') setFormDirty(false);
    setTab(next);
  };
  const handleTabKeys = (e, index) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const last = TABS.length - 1;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? last : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1) : (index === last ? 0 : index + 1);
    switchTab(TABS[next][0]);
    requestAnimationFrame(() => document.getElementById(`add-tab-${TABS[next][0]}`)?.focus());
  };

  const applyPaste = (result, mode) => {
    setIncoming({ form: result.form, mode, token: Date.now() });
    setPasteOpen(false); setPasteResult(null); setPasteError('');
    setTab('manual');
    setPasteNotice({ counts: result.counts, warnings: result.warnings, unknownSections: result.unknownSections, mode });
  };

  const useAndFill = () => {
    if (!pasteText.trim()) { setPasteError('Please paste a vocabulary entry first.'); return; }
    const result = parsePastedEntry(pasteText);
    if (!result.ok) { setPasteResult(null); setPasteError(result.error); return; }
    setPasteError('');
    if (formDirty) { setPasteResult(result); setPasteMode('merge'); return; } // never overwrite silently
    applyPaste(result, 'replace');
  };

  return (
    <>
      <PageHeader
        eyebrow="Add to your vault"
        title="Add a word"
        sub="Generate a full Telugu-first entry with AI, paste an existing entry to auto-fill, or write one yourself."
      >
        <button type="button" className="btn-secondary" onClick={openPaste} aria-haspopup="dialog">
          <ClipboardPaste className="h-4 w-4" aria-hidden="true" />Paste &amp; Auto-Fill
        </button>
      </PageHeader>

      {pasteNotice && (
        <div className="mb-5 space-y-2">
          <Notice>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span>
                Filled <strong>{pasteNotice.counts.fields}</strong> {pasteNotice.counts.fields === 1 ? 'field' : 'fields'} from{' '}
                {plural(pasteNotice.counts.meanings, 'meaning')} and {plural(pasteNotice.counts.examples, 'example')}
                {pasteNotice.mode === 'merge' ? ' (merged with the existing form)' : ''}. Review everything and click “Save word” when ready.
              </span>
              <button type="button" className="btn-ghost !min-h-8 !px-2 !py-1" onClick={() => setPasteNotice(null)}>Dismiss</button>
            </div>
          </Notice>
          {pasteNotice.warnings.length > 0 && (
            <Notice tone="warn">
              <p className="font-medium">Some parts need a quick look</p>
              <ul className="mt-1 list-disc pl-5">
                {pasteNotice.warnings.slice(0, 8).map((w, i) => <li key={i}>{w.message}</li>)}
                {pasteNotice.warnings.length > 8 && <li>{pasteNotice.warnings.length - 8} more…</li>}
              </ul>
            </Notice>
          )}
        </div>
      )}

      <div role="tablist" aria-label="How to add" className="mb-5 inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-[var(--surface)] p-1">
        {TABS.map(([k, l, Icon], i) => (
          <button
            key={k}
            id={`add-tab-${k}`}
            role="tab"
            type="button"
            aria-selected={tab === k}
            aria-controls={`add-panel-${k}`}
            tabIndex={tab === k ? 0 : -1}
            onClick={() => switchTab(k)}
            onKeyDown={(e) => handleTabKeys(e, i)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all ${tab === k ? 'bg-[var(--surface-hi)] text-ink shadow-[var(--shadow-soft)]' : 'text-muted hover:text-ink'}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />{l}
          </button>
        ))}
      </div>

      {tab === 'ai' && (
        <div id="add-panel-ai" role="tabpanel" aria-labelledby="add-tab-ai" className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
          <Reveal>
            <form onSubmit={generate} className="card space-y-5">
              <div className="flex items-start gap-3">
                <span className="icon-tile"><Wand2 className="h-4 w-4" aria-hidden="true" /></span>
                <div>
                  <h2 className="text-lg font-semibold text-ink">Let AI draft the entry</h2>
                  <p className="muted mt-0.5 leading-relaxed">One word is enough. You will get meanings, Telugu, examples, synonyms and more — ready to edit.</p>
                </div>
              </div>

              {gen && !gen.configured && (
                <Notice tone="warn">
                  AI generation isn’t configured on this server, so <strong>nothing will be generated</strong>. {gen.reason} You can still use “Write manually”.
                </Notice>
              )}

              <div>
                <label htmlFor="gw" className="label">English word or expression</label>
                <input id="gw" lang="en" className="input !py-3" value={word} onChange={(e) => setWord(e.target.value)} maxLength={120} required placeholder="e.g. meticulous" autoComplete="off" />
              </div>

              <ErrorBanner error={err} onRetry={word ? generate : undefined} />

              {existing && (
                <Notice tone="warn">
                  <strong>“{existing.word}” is already in your vault.</strong> No AI request was made.
                  <div className="mt-2 flex gap-2">
                    <Link className="btn-secondary !min-h-8 !px-3 !text-xs" to={`/words/${existing.id}`}>Open</Link>
                    <Link className="btn-secondary !min-h-8 !px-3 !text-xs" to={`/words/${existing.id}/edit`}>Edit</Link>
                  </div>
                </Notice>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button className="btn-primary" disabled={busy || !word.trim() || (gen && !gen.configured)}>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />{busy ? 'Generating… (this can take a few minutes on a local model)' : 'Generate'}
                </button>
                <span className="text-[11px] text-faint">Nothing is saved until you review it.</span>
              </div>
              <p className="muted leading-relaxed">AI output can contain mistakes, especially translations. Review and edit it before relying on it.</p>
            </form>
          </Reveal>

          <Reveal delay={90}>
            <aside className="card h-full">
              <p className="eyebrow">The honest details</p>
              <h2 className="mt-2 text-lg font-semibold">What happens next</h2>
              <ul className="mt-4 space-y-3.5">
                {[
                  { icon: Sparkles, title: 'A complete draft', text: 'Meanings, part of speech, Telugu, examples and usage details.' },
                  { icon: ShieldCheck, title: 'No silent saves', text: 'You land on an editable form. Every field is yours to correct.' },
                  { icon: ListChecks, title: 'Duplicate aware', text: 'If the word already exists, WordVault opens it instead of generating again.' },
                ].map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex gap-3">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-[var(--surface)] text-brand"><Icon className="h-3.5 w-3.5" aria-hidden="true" /></span>
                    <div><p className="text-sm font-semibold text-ink">{title}</p><p className="mt-0.5 text-xs leading-relaxed text-muted">{text}</p></div>
                  </li>
                ))}
              </ul>
              <button type="button" className="btn-secondary mt-5 w-full !text-xs" onClick={openPaste}>
                <ClipboardPaste className="h-3.5 w-3.5" aria-hidden="true" />I already have an entry
              </button>
            </aside>
          </Reveal>
        </div>
      )}

      {tab === 'manual' && (
        <div id="add-panel-manual" role="tabpanel" aria-labelledby="add-tab-manual">
          <VocabForm onSubmit={manual} submitLabel="Save word" incoming={incoming} onDirtyChange={onDirtyChange} />
        </div>
      )}

      <Dialog open={pasteOpen} onClose={closePaste} title="Paste & Auto-Fill" wide>
        <div className="space-y-4">
          <p className="muted leading-relaxed">
            Paste your complete vocabulary entry below. WordVault will identify the sections and fill the corresponding fields automatically.
            Nothing is saved until you click “Save word”.
          </p>
          <div>
            <div className="mb-1 flex items-end justify-between gap-2">
              <label htmlFor="paste-entry" className="label !mb-0">Vocabulary entry</label>
              <span className="font-mono text-[10px] text-faint">{pasteText.length.toLocaleString()} characters</span>
            </div>
            <textarea
              id="paste-entry"
              className="input min-h-56 resize-y font-mono !text-xs leading-relaxed"
              rows={12}
              value={pasteText}
              onChange={(e) => { setPasteText(e.target.value); if (pasteError) setPasteError(''); }}
              placeholder={PASTE_PLACEHOLDER}
              spellCheck={false}
              aria-describedby="paste-hint"
            />
            <p id="paste-hint" className="mt-2 text-[11px] leading-relaxed text-faint">
              Supports Markdown, bold labels, headings, numbered sections, bullet lists and Telugu text. Sections can appear in any order.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['Markdown', 'Any section order', 'Multiple meanings', 'Telugu Unicode', 'Pipe separators'].map((t) => <span key={t} className="chip !text-[10px]">{t}</span>)}
          </div>
          {pasteError && <ErrorBanner error={{ message: pasteError }} />}
          {pasteResult && (
            <Notice tone="warn">
              <p className="font-medium">The form already has content.</p>
              <p className="muted mt-1">Choose how to apply the pasted entry. Your current text stays until you apply.</p>
              <fieldset className="mt-3 space-y-2">
                <legend className="sr-only">How to apply the pasted entry</legend>
                <label className="flex items-start gap-2"><input type="radio" name="paste-mode" value="merge" className="mt-1" checked={pasteMode === 'merge'} onChange={() => setPasteMode('merge')} /><span><strong>Merge</strong> — keep existing values and add the pasted ones.</span></label>
                <label className="flex items-start gap-2"><input type="radio" name="paste-mode" value="replace" className="mt-1" checked={pasteMode === 'replace'} onChange={() => setPasteMode('replace')} /><span><strong>Replace</strong> — overwrite the current form with the pasted entry.</span></label>
              </fieldset>
            </Notice>
          )}
          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <button type="button" className="btn-secondary" onClick={closePaste}>Close</button>
            {pasteResult ? (
              <>
                <button type="button" className="btn-secondary" onClick={() => setPasteResult(null)}>Back</button>
                <button type="button" className="btn-primary" onClick={() => applyPaste(pasteResult, pasteMode)}>Use &amp; Fill</button>
              </>
            ) : (
              <button type="button" className="btn-primary" onClick={useAndFill}>Use &amp; Fill</button>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}
