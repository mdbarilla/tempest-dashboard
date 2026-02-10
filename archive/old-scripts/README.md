# Archived scripts

Scripts superseded by `scripts/auto-build-and-deploy.sh`:

- **deploy-manual.sh** – hardcoded v1.3.2, used /var/www/html
- **deploy-to-pi.sh** – hardcoded v1.1/v1.2, wrong Pi layout
- **build-for-deploy.sh** – created root `deployment/` and `tempest-deploy.tar.gz`
- **update-dashboard.sh** – used `pi@`, `tempest-weather.local`, wrong paths

Use `./scripts/auto-build-and-deploy.sh [network|usb|build-only]` and see DEPLOYMENT.md / REBUILD-WALKTHROUGH.md.
