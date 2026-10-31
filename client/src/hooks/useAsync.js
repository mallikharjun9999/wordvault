import { useCallback, useEffect, useRef, useState } from 'react';

/** Loads data via `fn` whenever deps change. Exposes {data, loading, error, reload}. Ignores stale responses. */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const seq = useRef(0);
  const run = useCallback(() => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve().then(fn).then((data) => { if (id === seq.current) setState({ data, loading: false, error: null }); })
      .catch((error) => { if (id === seq.current) setState({ data: null, loading: false, error }); });
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run, setData: (data) => setState((s) => ({ ...s, data })) };
}
export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
