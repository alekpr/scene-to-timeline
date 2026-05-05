#!/bin/bash
# Integration test runner with Anthropic API
# Usage: ./test-with-api.sh
# Requires: ANTHROPIC_API_KEY environment variable set

set -e

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "❌ Error: ANTHROPIC_API_KEY is not set"
  echo "Setup:"
  echo "  1. Copy .env.example to .env"
  echo "  2. Add your Anthropic API key"
  echo "  3. source .env"
  echo "  4. Run this script again"
  exit 1
fi

echo "📝 Running integration tests with Anthropic API..."
echo ""

npm run test:integration
