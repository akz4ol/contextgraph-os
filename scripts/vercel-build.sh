#!/bin/bash
set -e

echo "=== ContextGraph OS Vercel Build ==="

# Download and install mdBook
MDBOOK_VERSION="0.4.40"
echo "Installing mdBook v${MDBOOK_VERSION}..."
curl -sSL "https://github.com/rust-lang/mdBook/releases/download/v${MDBOOK_VERSION}/mdbook-v${MDBOOK_VERSION}-x86_64-unknown-linux-gnu.tar.gz" | tar -xz
chmod +x mdbook
export PATH="$PWD:$PATH"

echo "mdBook version: $(./mdbook --version)"

# Build documentation
echo "Building documentation..."
./mdbook build docs-site

# Create dist directory
echo "Assembling site..."
rm -rf dist
mkdir -p dist

# Copy website files
cp -r website/* dist/

# Copy docs
mkdir -p dist/docs
cp -r docs-site/book/* dist/docs/

echo "Build complete!"
echo "  Website: dist/"
echo "  Documentation: dist/docs/"
ls -la dist/
