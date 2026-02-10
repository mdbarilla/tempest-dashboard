#!/bin/bash

# Hide cursor after 5 seconds of inactivity
unclutter -idle 5 &

# Start Chromium in kiosk mode pointing to nginx on port 80
chromium --kiosk --noerrdialogs --disable-infobars --no-first-run --check-for-update-interval=31536000 http://localhost:80 &
