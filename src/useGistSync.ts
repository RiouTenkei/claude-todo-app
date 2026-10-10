import { useCallback, useEffect, useRef, useState } from "react";
import { findOrCreateGist, readGist, pushGist, errorMessage } from "./gist";
import type { SyncStatus, TodoData } from "./types";

interface Options {
  data: TodoData;
  setData: (data: TodoData) => void;
  token: string | null;
}

interface GistSync {
  status: SyncStatus;
  gistUrl: string;
  sync: () => Promise<void>;
  /** Call after every local edit. */
  schedulePush: () => void;
}

/** Keeps `data` in sync with a private gist. The newest `updatedAt` wins. */
export function useGistSync({ data, setData, token }: Options): GistSync {
  const [status, setStatus] = useState<SyncStatus>({ text: "Not synced", error: false });
  const [gistUrl, setGistUrl] = useState("https://gist.github.com");

  const dataRef = useRef(data);
  dataRef.current = data;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const syncing = useRef(false);

  const sync = useCallback(async () => {
    if (!token || syncing.current) return;
    syncing.current = true;
    setStatus({ text: "Syncing…", error: false });

    try {
      const gist = await findOrCreateGist(token, dataRef.current);
      setGistUrl(gist.html_url);
      const remote = readGist(gist);
      const local = dataRef.current;

      if (remote.updatedAt > local.updatedAt) {
        setData(remote);
      } else if (local.updatedAt > remote.updatedAt) {
        await pushGist(token, local);
      }
      setStatus({ text: "Synced", error: false });
    } catch (e) {
      setStatus({ text: errorMessage(e), error: true });
    } finally {
      syncing.current = false;
    }
  }, [token, setData]);

  // Push after a short pause in editing. Reads the latest data when it fires.
  const schedulePush = useCallback(() => {
    if (!token) return;
    setStatus({ text: "Saving…", error: false });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      pushGist(token, dataRef.current)
        .then(() => setStatus({ text: "Synced", error: false }))
        .catch((e: unknown) => setStatus({ text: errorMessage(e), error: true }));
    }, 800);
  }, [token]);

  // Sync on connect, when returning to the tab, and when back online.
  useEffect(() => {
    if (!token) {
      setStatus({ text: "Not synced", error: false });
      return;
    }
    void sync();
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    const onOnline = () => void sync();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [token, sync]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { status, gistUrl, sync, schedulePush };
}
