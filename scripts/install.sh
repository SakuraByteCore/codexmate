#!/usr/bin/env bash
# codexmate standalone installer
# Usage: curl -fsSL https://raw.githubusercontent.com/SakuraByteCore/codexmate/main/scripts/install.sh | bash
set -euo pipefail

REPO="SakuraByteCore/codexmate"
GITHUB_API="${CODEXMATE_API_URL:-https://api.github.com/repos/${REPO}/releases/latest}"
INSTALL_DIR="${CODEXMATE_INSTALL_DIR:-$HOME/.codexmate}"
BIN_DIR="${CODEXMATE_BIN_DIR:-$HOME/.local/bin}"
BINARY_NAME="codexmate"

info()  { printf '\033[1;34m[info]\033[0m  %s\n' "$*"; }
warn()  { printf '\033[1;33m[warn]\033[0m  %s\n' "$*"; }
error() { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }
die()   { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

has_cmd() { command -v "$1" >/dev/null 2>&1; }

fetch() {
  if has_cmd curl; then curl -fsSL "$1"
  else wget -qO- "$1"
  fi
}

# --- preflight ---
has_cmd node || error "node is required (>=14). Install: https://nodejs.org"
node -e "const v=process.versions.node.split('.').map(Number); if(v[0]<14){process.exit(1)}" \
  || error "node >=14 required, got $(node -v)"

has_cmd curl || has_cmd wget || error "curl or wget is required"

# --- resolve latest version ---
info "Fetching latest release from ${REPO}"
api_body=$(fetch "$GITHUB_API") || die "Failed to fetch release info from $GITHUB_API"

release_url=$(printf '%s' "$api_body" \
  | grep -o '"browser_download_url":"[^"]*standalone[^"]*"' \
  | head -1 | sed 's/.*":"//;s/"$//') || true

if [ -z "$release_url" ]; then
  tag=$(printf '%s' "$api_body" | grep -o '"tag_name":"[^"]*"' | head -1 | sed 's/.*":"//;s/"$//')
  [ -z "$tag" ] && die "Cannot determine latest release tag"
  release_url="https://github.com/${REPO}/archive/refs/tags/${tag}.tar.gz"
  warn "No standalone tarball found, falling back to source archive (${tag})"
  warn "You will need to run 'npm install --prod' in ${INSTALL_DIR} after install"
fi

# --- download ---
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT
TARBALL="${TMPDIR}/codexmate.tar.gz"

info "Downloading ${release_url}"
if has_cmd curl; then
  curl -fSL --progress-bar -o "$TARBALL" "$release_url"
else
  wget -q --show-progress -O "$TARBALL" "$release_url"
fi

# --- install ---
info "Installing to ${INSTALL_DIR}"
rm -rf "${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}"

tar xzf "$TARBALL" -C "$INSTALL_DIR"
# strip top-level directory if archive has one
top_dir=$(find "$INSTALL_DIR" -maxdepth 1 -mindepth 1 -type d | head -1)
if [ -n "$top_dir" ] && [ "$(find "$INSTALL_DIR" -maxdepth 1 -mindepth 1 | wc -l)" -eq 1 ]; then
  # contents are inside a subdirectory, hoist them up
  mv "$top_dir" "${TMPDIR}/_inner"
  cp -a "${TMPDIR}/_inner/." "$INSTALL_DIR/"
  rm -rf "${TMPDIR}/_inner"
fi

# if source archive (no node_modules), install deps
if [ ! -d "${INSTALL_DIR}/node_modules" ]; then
  info "Installing dependencies..."
  (cd "$INSTALL_DIR" && npm install --prod --no-fund --no-audit 2>&1) || error "npm install failed"
fi

# ensure cli.js is executable
chmod + "${INSTALL_DIR}/cli.js" 2>/dev/null || true

# --- symlink ---
mkdir -p "$BIN_DIR"
ln -snf "${INSTALL_DIR}/cli.js" "${BIN_DIR}/${BINARY_NAME}"

# --- PATH hint ---
if ! echo ":${PATH}:" | grep -q ":${BIN_DIR}:"; then
  PROFILE=""
  for candidate in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile" "$HOME/.bash_profile"; do
    if [ -f "$candidate" ]; then
      PROFILE="$candidate"
      break
    fi
  done
  # termux has its own profile
  if [ -n "${TERMUX_VERSION:-}" ] && [ -f "$HOME/.bashrc" ]; then
    PROFILE="$HOME/.bashrc"
  fi

  if [ -n "$PROFILE" ]; then
    echo "" >> "$PROFILE"
    echo "export PATH=\"\${PATH:+\${PATH}:}${BIN_DIR}\"" >> "$PROFILE"
    info "Added ${BIN_DIR} to PATH in ${PROFILE}"
    info "Run 'source ${PROFILE}' or start a new shell"
  else
    warn "Add ${BIN_DIR} to your PATH manually"
  fi
fi

# --- done ---
INSTALLED_VERSION=$(node -e "try{console.log(require('${INSTALL_DIR}/package.json').version)}catch(e){console.log('unknown')}")
info "codexmate ${INSTALLED_VERSION} installed successfully"
info "  location : ${INSTALL_DIR}"
info "  binary   : ${BIN_DIR}/${BINARY_NAME}"
info "  usage    : codexmate --help"
