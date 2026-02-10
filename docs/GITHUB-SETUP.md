# GitHub Setup Guide

This guide walks you through preparing the Tempest Weather Dashboard for a public GitHub repository and pushing it for the first time.

---

## Chosen repository name

**tempest-dashboard**

Use this description on GitHub (matches the project documentation):  
*A modern, beautiful weather dashboard for Raspberry Pi, powered by the Tempest Weather API.*

---

## Before you push

### 1. Confirm nothing secret is committed

- **`.env`** — Already in `.gitignore` (backend and dashboard). Do **not** remove.
- **API tokens** — Never commit `TEMPEST_API_TOKEN`, `DIALOGFLOW_PROJECT_ID`, or any real tokens.
- **Database files** — `*.db`, `data/` are gitignored.

Quick check from the project root:

```bash
git status
git check-ignore -v backend/.env apps/dashboard/.env 2>/dev/null || true
```

If `.env` ever appeared in `git status`, assume the token is compromised and rotate it at [tempestwx.com](https://tempestwx.com).

### 2. Optional: soften “my instance” in the README

The main README mentions **towerhill.local** and a deploy badge. For a public repo you can:

- **Keep as-is** — Shows a real deployment example; others replace with their host.
- **Generalize** — Change the deploy badge to something like `deploy-Raspberry Pi` and add one line: “Example production URL: `http://your-host.local`.”

No code changes are required; docs already use `your_token_here` and `.env.example`.

### 3. Ensure git is initialized and clean

```bash
cd /path/to/tempest-dashboard

# If you haven’t initialized yet:
git init

# Ignored paths (should include .env, node_modules, build-output, .cursor, etc.)
git status

# Optional: see what would be committed
git add -n .
```

---

## Create the repository on GitHub

1. Go to [github.com/new](https://github.com/new).
2. **Repository name:**  `tempest-dashboard`
3. **Description (suggested):**  
   `A modern, beautiful weather dashboard for Raspberry Pi, powered by the Tempest Weather API.`
4. **Public.**
5. **Do not** check “Add a README”, “Add .gitignore”, or “Choose a license” — you already have these in the project.
6. Click **Create repository**.

---

## Push your code

GitHub will show “push an existing repository from the command line.” Use your actual repo URL (replace `YOUR_USERNAME` and `REPO_NAME`):

```bash
cd /path/to/tempest-dashboard

# If this is the first time (no remote yet):
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# Or with SSH:
# git remote add origin git@github.com:YOUR_USERNAME/REPO_NAME.git

# Stage and commit everything (if you haven’t already)
git add .
git status   # review
git commit -m "Public release: Tempest Weather Dashboard v1.4.11 (PII generalized, local news omitted)"

# Push (first time: set upstream for main)
git branch -M main
git push -u origin main
```

If your default branch is already `main`, the push is just:

```bash
git push -u origin main
```

---

## After the first push

1. **Repository description & topics**  
   On the repo page: **About** → edit → add topics, e.g.:  
   `tempest`, `weather`, `raspberry-pi`, `react`, `nodejs`, `weather-dashboard`, `weather-api`, `kiosk`.

2. **README**  
   Your root `README.md` will show on the repo homepage. The badges point to your current version and deploy; you can leave them or adjust later.

3. **License**  
   Ensure a `LICENSE` file exists in the repo root (MIT). GitHub will detect it and show “MIT” in the About section.

4. **Secrets**  
   If you ever need CI (e.g. GitHub Actions), use **Settings → Secrets and variables → Actions**, never commit tokens.

---

## Summary checklist

- [ ] Choose repository name (e.g. `tempest-at-the-tower` or `tempest-dashboard`).
- [ ] Confirm `.env` and secrets are not tracked (`git status`, `.gitignore`).
- [ ] Create new **public** repo on GitHub (no extra README/.gitignore/license).
- [ ] Add `origin` remote and push: `git push -u origin main`.
- [ ] Set description and topics; confirm LICENSE appears.

For day-to-day workflow after this: commit locally, then `git push` (or `git push origin main`).
