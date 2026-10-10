import { useCallback, useEffect, useRef, useState } from "react";
import { findOrCreateGist, readGist, pushGist, errorMessage } from "./gist.js";

// Keeps `data` ({ todos, updatedAt }) in sync with a private gist.
// The newest updatedAt wins. Returns status info and a schedulePush() to
// call after every local edit.
export function useGistSync({ data, setData, token }) {
  const [status, setStatus] = useState({ text: "Not synced", error: false });
  const [gistUrl, setGistUrl] = useState("https://gist.github.com");

  const dataRef = useRef(data);
  dataRef.current = data;
  const timer = useRef(null);
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
    timer.current = setTimeout(async () => {
      try {
        await pushGist(token, dataRef.current);
        setStatus({ text: "Synced", error: false });
      } catch (e) {
        setStatus({ text: errorMessage(e), error: true });
      }
    }, 800);
  }, [token]);

  // Sync on connect, when returning to the tab, and when back online.
  useEffect(() => {
    if (!token) {
      setStatus({ text: "Not synced", error: false });
      return;
    }
    sync();
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", sync);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", sync);
    };
  }, [token, sync]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { status, gistUrl, sync, schedulePush };
}
