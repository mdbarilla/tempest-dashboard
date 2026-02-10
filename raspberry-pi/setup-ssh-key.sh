#!/bin/bash

# SSH Key Setup Script for Raspberry Pi
# This script helps you set up passwordless SSH access to your Pi

echo "🔑 SSH Key Setup for Raspberry Pi"
echo "===================================="
echo ""
echo "This script will set up passwordless SSH access to your Pi."
echo "You'll need to enter your Pi password when prompted."
echo ""
echo "Target: pi@192.168.1.160"
echo ""

# Check if key exists
if [ ! -f ~/.ssh/id_ed25519.pub ]; then
    echo "❌ SSH key not found. Please run this command first:"
    echo "   ssh-keygen -t ed25519 -C 'tempest-deployment' -f ~/.ssh/id_ed25519"
    exit 1
fi

echo "📋 Your public key:"
cat ~/.ssh/id_ed25519.pub
echo ""

echo "Please enter the Pi password when prompted..."
echo ""

# Try to copy the key
ssh-copy-id -i ~/.ssh/id_ed25519.pub pi@192.168.1.160

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SSH key successfully installed!"
    echo ""
    echo "Testing passwordless connection..."
    ssh pi@192.168.1.160 "echo '✅ Passwordless SSH working!'"
    echo ""
    echo "🎉 Setup complete! You can now deploy without entering passwords."
else
    echo ""
    echo "❌ SSH key installation failed."
    echo ""
    echo "Alternative method: Manually copy the key"
    echo "=========================================="
    echo ""
    echo "1. Copy this key:"
    cat ~/.ssh/id_ed25519.pub
    echo ""
    echo "2. SSH into your Pi:"
    echo "   ssh pi@192.168.1.160"
    echo ""
    echo "3. On the Pi, run these commands:"
    echo "   mkdir -p ~/.ssh"
    echo "   chmod 700 ~/.ssh"
    echo "   nano ~/.ssh/authorized_keys"
    echo ""
    echo "4. Paste the key you copied in step 1"
    echo "5. Save and exit (Ctrl+X, Y, Enter)"
    echo "6. Run: chmod 600 ~/.ssh/authorized_keys"
    echo ""
fi
