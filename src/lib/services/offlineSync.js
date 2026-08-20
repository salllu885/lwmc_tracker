import { useCallback, useEffect, useState } from 'react';
import { flushQueue, queueCount } from '../offlineQueue';
import { createReport, resolveReport } from '../api/reports';

const HANDLERS = {
  report: createReport,
  resolution: (payload) => resolveReport(payload.reportId, payload),
};

// Mounted once in NavShell so a queued capture uploads itself the moment
// connectivity returns, regardless of which screen the user happens to be
// on — not just the one they queued it from.
export function useOfflineQueueSync() {
  const [pending, setPending] = useState(() => queueCount());
  const [syncing, setSyncing] = useState(false);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      await flushQueue(HANDLERS);
    } finally {
      setPending(queueCount());
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener('online', sync);
    // Also catch items queued by the current screen without a full reload.
    const id = setInterval(() => setPending(queueCount()), 4000);
    return () => {
      window.removeEventListener('online', sync);
      clearInterval(id);
    };
  }, [sync]);

  return { pending, syncing, sync };
}
