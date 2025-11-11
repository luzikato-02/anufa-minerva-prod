# Base image with PHP + Composer
FROM mcr.microsoft.com/devcontainers/php:8.3

# Install Node.js, npm, MariaDB safely
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
    curl \
    nodejs \
    npm \
    mariadb-server \
    mariadb-client \
    unzip && \
    npm install -g npm@latest && \
    rm -rf /var/lib/apt/lists/*

# Allow MariaDB to listen on all interfaces
RUN sed -i 's/^bind-address/#bind-address/' /etc/mysql/mariadb.conf.d/50-server.cnf

# Create directory for socket file if missing
RUN mkdir -p /run/mysqld && chown -R mysql:mysql /run/mysqld

# Install Composer (if not present)
RUN curl -sS https://getcomposer.org/installer | php && mv composer.phar /usr/local/bin/composer

# Working directory
WORKDIR /workspaces/${localWorkspaceFolderBasename}

# Copy startup script
COPY .devcontainer/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

# Start MariaDB and keep container alive
CMD ["/usr/local/bin/start.sh"]
