#!/bin/bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILq4XhxhHQqP0VGz7mY8vK5xJ9pZ8vP4rJ3wN2fQ9Xy1 claude@helper" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
echo "SSH key added successfully!"
