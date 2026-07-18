#!/bin/bash

# Navigate to the project root directory relative to this script's location
cd "$(dirname "$0")/.."

# Configuration
domains=("example.com" "www.example.com")
email="admin@example.com" # Required for Let's Encrypt
staging=0 # Set to 1 if you are testing to avoid hitting ACME rate limits

data_path="./infrastructure/nginx/certbot"
rsa_key_size=4096

# Detect docker compose version
if docker compose version >/dev/null 2>&1; then
    docker_compose="docker compose"
elif docker-compose version >/dev/null 2>&1; then
    docker_compose="docker-compose"
else
    echo "Error: docker compose or docker-compose command not found. Please install Docker Compose first."
    exit 1
fi

if [ ! -e "$data_path/conf/options-ssl-nginx.conf" ] || [ ! -e "$data_path/conf/ssl-dhparams.pem" ]; then
  echo "### Downloading recommended TLS parameters..."
  mkdir -p "$data_path/conf"
  curl -s https://raw.githubusercontent.com/wmnnd/nginx-certbot/master/data/nginx/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
  curl -s https://raw.githubusercontent.com/wmnnd/nginx-certbot/master/data/nginx/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"
  echo
fi

echo "### Creating dummy certificate for $domains..."
path="/etc/letsencrypt/live/$domains"
mkdir -p "$data_path/conf/live/$domains"
$docker_compose run --entrypoint \
  "openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout '$path/privkey.pem' \
    -out '$path/fullchain.pem' \
    -subj '/CN=localhost'" certbot
echo

echo "### Starting nginx..."
$docker_compose up --force-recreate -d nginx
echo

echo "### Deleting dummy certificate for $domains..."
$docker_compose run --entrypoint \
  "rm -Rf /etc/letsencrypt/live/$domains && \
   rm -Rf /etc/letsencrypt/archive/$domains && \
   rm -Rf /etc/letsencrypt/renewal/$domains.conf" certbot
echo

echo "### Requesting Let's Encrypt certificate for $domains..."
# Join domains to -d args
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

# Select email arg
email_arg="--register-unsafely-without-email"
if [ -n "$email" ]; then
  email_arg="--email $email --no-eff-email"
fi

# Enable staging mode if requested
staging_arg=""
if [ $staging -ne 0 ]; then
  staging_arg="--staging"
fi

$docker_compose run --entrypoint \
  "certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    $domain_args \
    --agree-tos \
    --no-bootstrap \
    --force-renewal" certbot
echo

echo "### Reloading nginx..."
$docker_compose exec nginx nginx -s reload
echo "### Let's Encrypt Certificate setup completed successfully."
