# Deploying Tank Game

**Live URL (game):** https://tank-gamee.netlify.app  
**WebSocket relay:** wss://tank-game-production-06b0.up.railway.app  
**GitHub:** https://github.com/zachrustick7/tank-game

The **game frontend** is hosted on **Netlify** (free tier) — every push to `main` auto-deploys.  
The **multiplayer relay server** (`server/`) is hosted on **Railway** (free tier) — every push to `main` also auto-deploys the server, since the root directory is set to `server/`.

---

## One-Time Setup (Already Done)

### 1 — GitHub repo

The repo is at https://github.com/zachrustick7/tank-game

### 2 — Local repo connected to GitHub

The remote is already configured:

```bash
git remote -v
# origin  https://github.com/zachrustick7/tank-game.git (fetch)
# origin  https://github.com/zachrustick7/tank-game.git (push)
```

### 3 — Connect Netlify to GitHub (for auto-deploys)

To enable automatic deploys on every push:

1. Go to https://app.netlify.com and sign in (free account)
2. Click **Add new site → Import an existing project**
3. Choose **GitHub** and authorize Netlify
4. Select the `zachrustick7/tank-game` repo
5. Build settings are auto-detected from `netlify.toml`:
   - **Publish directory:** `.`
   - **Build command:** *(empty)*
6. Click **Deploy site**

This connects your GitHub repo so pushes auto-deploy.

**Alternative: Claim existing anonymous deploy**

If you deployed via CLI (`npx netlify-cli deploy --prod --dir=. --allow-anonymous`), 
claim the site within 60 minutes at the URL shown in the terminal output.

---

## Pushing a Live Update

This is the only command you need going forward:

```bash
git add .
git commit -m "describe what you changed"
git push
```

Netlify detects the push and redeploys automatically — usually live within 30 seconds.

---

## Local Dev

Start the live-reload server:

```bash
npx live-server --port=3333
```

Opens at http://localhost:3333. The browser reloads whenever you save a file.

---

## Multiplayer Relay Server

The relay server lives in `server/` and is deployed separately on Railway.

- **Railway project:** harmonious-possibility
- **Service:** tank-game
- **Public WebSocket URL:** `wss://tank-game-production-06b0.up.railway.app`
- **Root directory setting:** `server` (set in Railway service → Settings → Source)
- **Auto-deploys:** yes, triggers on every push to `main`

The WS URL is hardcoded in `src/game.js`:
```js
const WS_URL = window.location.hostname === 'localhost'
  ? 'ws://localhost:8080'
  : 'wss://tank-game-production-06b0.up.railway.app';
```

To run the relay locally:
```bash
cd server
npm install
npm run dev   # uses node --watch for auto-reload
```

---

## File Structure (for reference)

```
tank-game/
├── index.html          # entry point
├── assets/             # Figma sprite exports (PNG)
├── src/
│   ├── config.js       # all tunable constants
│   ├── colors.js       # master color palette
│   ├── game.js         # main loop, world, asset loading
│   ├── tank.js         # player tank
│   ├── enemy.js        # enemy base class + state machine
│   ├── shell.js        # projectile
│   ├── shell.js        # projectile (Shell, SplitterShell, MortarShell)
│   ├── input.js        # keyboard handling
│   ├── network.js      # WebSocket client (multiplayer)
│   ├── sprite.js       # tintSprite() utility
│   └── ai/
│       └── enemyConfig.js  # data-driven enemy role configs
├── server/
│   ├── server.js       # WebSocket relay server (Node.js + ws)
│   └── package.json
├── netlify.toml        # Netlify deploy config
└── DEPLOY.md           # this file
```
