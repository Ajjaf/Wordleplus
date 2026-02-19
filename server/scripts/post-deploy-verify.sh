#!/bin/bash
set -e

# Usage: BASE_URL=https://api.example.com bash scripts/post-deploy-verify.sh

URL="${BASE_URL:-http://localhost:8080}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local endpoint="$2"
  local expected="$3"

  response=$(curl -sf -w "\n%{http_code}" "$URL$endpoint" 2>/dev/null) || {
    echo "FAIL  $name — could not reach $URL$endpoint"
    FAIL=$((FAIL + 1))
    return
  }

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "$expected" ]; then
    echo "OK    $name ($http_code)"
    PASS=$((PASS + 1))
  else
    echo "FAIL  $name — expected $expected, got $http_code"
    echo "      $body"
    FAIL=$((FAIL + 1))
  fi
}

echo "Post-Deploy Verification: $URL"
echo "=============================="
echo ""

check "Health endpoint"    "/health" "200"
check "Readiness endpoint" "/ready"  "200"
check "Liveness endpoint"  "/alive"  "200"
check "Validate API"       "/api/validate?word=CRANE" "200"
check "Random word API"    "/api/random-word" "200"

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

echo ""
echo "All checks passed"
