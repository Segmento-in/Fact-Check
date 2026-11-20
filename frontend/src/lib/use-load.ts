import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseLoadResult<T> {
  status: 'loading' | 'ready' | 'error';
  data: T | null;
  retry: () => void;
}

export function useLoad<T>(fn: () => Promise<T>): UseLoadResult<T> {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<T | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  });

  const retry = useCallback(() => {
    setStatus('loading');
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    fnRef.current()
      .then((result) => {
        if (!ignore) {
          setData(result);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!ignore) {
          setStatus('error');
        }
      });

    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  return { status, data, retry };
}
