# Todo

A small todo app built with React and Vite. Todos are saved in your browser's local storage, with optional sync across devices through a private GitHub gist.

## Features

- Add, tick off and delete todos
- Filter by all / active / done
- Clear completed items
- Light and dark mode (follows your system)
- Works on phone and desktop

## Running locally

```sh
npm install
npm run dev
```

## Hosting on GitHub Pages

Every push to `main` builds the app and deploys it with GitHub Actions (`.github/workflows/deploy.yml`).

One-time setup: in the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.

The app is then live at `https://<username>.github.io/<repo-name>/`.

## Syncing across devices

Open **Sync** at the bottom of the app and paste a GitHub personal access token with only the `gist` scope ([create one here](https://github.com/settings/tokens/new?scopes=gist&description=Todo%20app%20sync)). The app stores your list in a secret gist called `claude-todo-app data` and keeps it in sync. Paste the same token on each device and they'll share one list. The most recent edit wins.

The token is saved in that browser's local storage, so only connect on your own devices.
