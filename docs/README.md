# Documentation Index

This directory contains all project documentation organized by category.

**Last Updated**: 2026-02-09

---

## 📁 Documentation Structure

### 📋 Release Planning
- **[release-planning.md](release-planning.md)** - Current release queue, planned features, bug fixes, and future roadmap
- **[roadmap.md](roadmap.md)** - Long-term project roadmap and vision

### 📚 Reference Documentation
- **[reference/api-reference.md](reference/api-reference.md)** - Complete API endpoint documentation
- **[reference/test-plan.md](reference/test-plan.md)** - Testing documentation and QA procedures

### 🚀 Setup & Operations
- **[setup-operations/quick-start.md](setup-operations/quick-start.md)** - Quick start guide for local development
- **[setup-operations/raspberry-pi-setup.md](setup-operations/raspberry-pi-setup.md)** - Initial Raspberry Pi setup instructions
- **[setup-operations/pi-operations.md](setup-operations/pi-operations.md)** - Raspberry Pi operations and maintenance guide
- **[setup-operations/rebuild-walkthrough.md](setup-operations/rebuild-walkthrough.md)** - Step-by-step rebuild and deployment walkthrough

### 📦 Deployment Guides
- **[deployments/](deployments/)** - Version-specific deployment guides
  - `deploy-1.4.3.md` - v1.4.3 deployment instructions
  - `backend-fixes.md` - Backend-specific deployment fixes

### 🎯 Feature Plans
- **[plans/](plans/)** - Implementation plans (see [plans/README.md](plans/README.md) for index)
  - **Active:** `plan-1.6.0-llm-historical-chat.md` (1.5.0), `plan-1.5.0-radar-tile.md` (1.6.0)
  - **Archive:** Completed plans in [plans/archive/](plans/archive/)

### 🔧 Integration & Configuration
- **[integrations/google-home-setup.md](integrations/google-home-setup.md)** - Google Home integration setup
- **[integrations/gemini-collaboration-notes.md](integrations/gemini-collaboration-notes.md)** - AI Weather Bridge collaboration notes

---

## 📖 Quick Reference

### For Release Planning
1. **Current release queue**: [release-planning.md](release-planning.md)
2. **Long-term roadmap**: [roadmap.md](roadmap.md)
3. **Project status**: `../PROJECT-STATUS.md` (in project root)
4. **Feature plans**: [plans/](plans/) directory

### For Deployment
1. **First time setup**: `../DEPLOYMENT.md` → Initial Setup section
2. **Standard deployment**: `../DEPLOYMENT.md` → Standard Deployment section
3. **Version-specific**: `deployments/deploy-*.md`
4. **Troubleshooting**: [setup-operations/rebuild-walkthrough.md](setup-operations/rebuild-walkthrough.md)

### For Development
1. **Local setup**: [setup-operations/quick-start.md](setup-operations/quick-start.md)
2. **API reference**: [reference/api-reference.md](reference/api-reference.md)
3. **Testing**: [reference/test-plan.md](reference/test-plan.md)
4. **Bug tracking**: `../PROJECT-STATUS.md`
5. **Next release**: [release-planning.md](release-planning.md)

### For Raspberry Pi Operations
1. **Operations guide**: [setup-operations/pi-operations.md](setup-operations/pi-operations.md)
2. **Terminal commands**: `../raspberry-pi/terminal-commands-reference.md`
3. **Pi setup**: [setup-operations/raspberry-pi-setup.md](setup-operations/raspberry-pi-setup.md)
4. **Weather bridge**: `../raspberry-pi/weather_bridge/README.md`

---

## 🔄 Documentation Organization

### Root Documentation (Project Root)
- `README.md` - Project overview and quick start
- `CHANGELOG.md` - Version history and release notes
- `DEPLOYMENT.md` - Main deployment guide
- `PROJECT-STATUS.md` - Project status and bug tracking

### Raspberry Pi Documentation (`../raspberry-pi/`)
- `terminal-commands-reference.md` - Terminal commands quick reference
- `weather_bridge/README.md` - Weather bridge service documentation
- `weather_bridge/terminal-commands.md` - Bridge-specific terminal commands

---

## 📝 Recent Updates

**2026-02-09**:
- Archived completed plans to `plans/archive/` (1.3.9 storm warning, 1.4.0 AI, 1.4.4 conditions list, 1.5.0 tappable cards)
- Added `plans/README.md` and `plans/archive/README.md` for plan index
- Active plans: 1.5.0 radar tile, 1.6.0 LLM historical chat

**2026-01-29**:
- Reorganized documentation into logical subfolders:
  - `plans/` - Feature implementation plans
  - `reference/` - API reference and test plans
  - `setup-operations/` - Setup guides and operations documentation
  - `integrations/` - Third-party integration guides
- Standardized plan file naming: `plan-{version}-{feature}.md`

**2026-01-28**:
- Renamed `NEXT-RELEASE.md` → `release-planning.md` for clarity
- Moved deployment-specific docs to `deployments/` subdirectory

---

## 🎯 Documentation Guidelines

- **Release Planning**: Use `release-planning.md` for current and upcoming release planning
- **Feature Plans**: Create separate plan documents in `plans/` directory with naming: `plan-{version}-{feature}.md`
- **Deployment**: Version-specific deployment notes go in `deployments/` subdirectory
- **Reference**: Keep API and technical reference docs in `reference/` subdirectory
- **Setup/Operations**: Setup guides and operations documentation in `setup-operations/` subdirectory
- **Integrations**: Third-party integration guides in `integrations/` subdirectory
