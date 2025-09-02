import { useState, useEffect, useCallback } from 'react';
import {
  getSessionId,
  appendSessionContext,
  CachedMessage,
} from '@/lib/sessionCache';

export function useSessionContext() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getSessionId().then(id => {
      if (mounted) setSessionId(id);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const append = useCallback(
    (message: CachedMessage) => {
      if (!sessionId) return;
      appendSessionContext(sessionId, message);
    },
    [sessionId],
  );

  return { sessionId, append };
}
