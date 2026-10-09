# Todo

A tiny todo app in plain HTML, CSS and JavaScript. No build step, no dependencies. Todos are saved in your browser's local storage.

## Features

- Add, tick off and delete todos
- Filter by all / active / done
- Clear completed items
- Light and dark mode (follows your system)
- Works on phone and desktop

## Hosting on GitHub Pages

1. Go to the repo's **Settings → Pages**.
2. Under **Build and deployment**, set Source to **Deploy from a branch**.
3. Pick the `main` branch and the `/ (root)` folder, then save.

After a minute the app will be live at `https://<username>.github.io/<repo-name>/`.

## Syncing across devices

Open **Sync** at the bottom of the app and paste a GitHub personal access token with only the `gist` scope ([create one here](https://github.com/settings/tokens/new?scopes=gist&description=Todo%20app%20sync)). The app stores your list in a secret gist called `claude-todo-app data` and keeps it in sync. Paste the same token on each device and they'll share one list. The most recent edit wins.

The token is saved in that browser's local storage, so only connect on your own devices.
