#!/bin/sh
set -eu

output_directory="${1:-./backups}"
mkdir -p "$output_directory"
timestamp="$(date +%Y%m%d-%H%M%S)"
docker compose exec -T postgres pg_dump -U vector -d vector --clean --if-exists | gzip > "$output_directory/vector-$timestamp.sql.gz"
echo "Backup created: $output_directory/vector-$timestamp.sql.gz"
