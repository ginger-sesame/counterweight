#!/usr/bin/env bash
set -euo pipefail
# Controlled Linux x86_64 setup; other platforms need the same release with its verified checksum.
[[ "$(uname -s)" == Linux && "$(uname -m)" == x86_64 ]] || { echo 'This installer supports Linux x86_64 only' >&2; exit 1; }
install_dir="${1:-$PWD/.tools/foundry}"
staging_dir="$(mktemp -d)"
trap 'rm -rf "$staging_dir"' EXIT
curl --fail --location --retry 2 --max-time 180 \
  https://github.com/foundry-rs/foundry/releases/download/v1.8.1/foundry_v1.8.1_linux_amd64.tar.gz \
  --output "$staging_dir/foundry.tar.gz"
(cd "$staging_dir" && echo '37b45855232e57624d90113b049ca54f0c92055bb5c1997fcbdc3076c7b89c10  foundry.tar.gz' | sha256sum --check)
mkdir -p "$install_dir"
tar -xzf "$staging_dir/foundry.tar.gz" -C "$install_dir" forge anvil cast
"$install_dir/forge" --version
