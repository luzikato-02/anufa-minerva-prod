#!/bin/bash
# Start MariaDB in background
echo "Starting MariaDB..."
service mariadb start

# Optional: Create a default database
mysql -u root -e "CREATE DATABASE IF NOT EXISTS laravel;"

echo "MariaDB started successfully."

# Keep container alive
tail -f /dev/null
