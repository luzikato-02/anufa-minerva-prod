# Use the official PHP image with required extensions
FROM mcr.microsoft.com/devcontainers/php:8.3

# Install Node.js + npm (for Vite, frontend build, etc.)
RUN apt-get update && \
    apt-get install -y nodejs npm mysql-client unzip && \
    npm install -g npm@latest && \
    rm -rf /var/lib/apt/lists/*

# Install Composer globally (already included, but ensure latest)
RUN curl -sS https://getcomposer.org/installer | php && \
    mv composer.phar /usr/local/bin/composer

# Set working directory
WORKDIR /workspaces/${localWorkspaceFolderBasename}

# Install Laravel dependencies when container builds
RUN composer install || true
