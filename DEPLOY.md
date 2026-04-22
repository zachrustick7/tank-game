# Deploying Tank Game

Hosted on **Netlify** (free tier). Every push to `main` on GitHub auto-deploys.

---

## One-Time Setup

### 1 — Create a GitHub repo

1. Go to https://github.com/new
2. Name it `tank-game` (or anything you like)
3. Keep it **Public**, leave all checkboxes blank, click **Create repository**
4. Copy the HTTPS URL shown (e.g. `https://github.com/your-name/tank-game.git`)

### 2 — Connect local repo to GitHub

Run these in the project directory (`~/Desktop/games/tank-game`):

```bash
git remote add origin https://github.com/YOUR_NAME/tank-game.git
git add .
git commit -m "initial commit"
git push -u origin main
```

### 3 — Connect Netlify to GitHub

1. Go to https://netlify.com and sign in (free account)
2. Click **Add new site → Import an existing project**
3. Choose **GitHub** and authorise Netlify
4. Select the `tank-game` repo
5. Build settings are auto-detected from `netlify.toml`:
   - **Publish directory:** `.`
   - **Build command:** *(empty)*
6. Click **Deploy site**

Netlify gives you a URL like `https://amazing-name-123.netlify.app`.
You can rename it under **Site settings → Site name**.

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

## File Structure (for reference)

```
tank-game/
├── index.html          # entry point
├── assets/             # Figma sprite exports (PNG)
│   ├── tank_body.png
│   └── tank_barrel.png
├── src/
│   ├── config.js       # all tunable constants
│   ├── colors.js       # master color palette
│   ├── game.js         # main loop, world, asset loading
│   ├── tank.js         # player tank
│   ├── enemy.js        # enemy base class + state machine
│   ├── shell.js        # projectile
│   ├── input.js        # keyboard handling
│   ├── sprite.js       # tintSprite() utility
│   └── ai/
│       └── enemyConfig.js  # data-driven enemy role configs
├── netlify.toml        # Netlify deploy config
└── DEPLOY.md           # this file
```
