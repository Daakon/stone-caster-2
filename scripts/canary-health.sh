#!/bin/bash
# Phase 7: Canary health check script
# Exits 0 if healthy, non-zero if unhealthy

set -euo pipefail

# Configuration (can be overridden via env)
API_BASE="${API_BASE:-http://localhost:3000}"
ERROR_RATE_THRESHOLD="${ERROR_RATE_THRESHOLD:-0.005}"  # 0.5%
P95_THRESHOLD_CREATE="${P95_THRESHOLD_CREATE:-600}"    # ms
P95_THRESHOLD_TURNS="${P95_THRESHOLD_TURNS:-200}"      # ms
MIN_REQUESTS="${MIN_REQUESTS:-100}"                    # Minimum requests for valid check

echo "Checking canary health for ${API_BASE}..."

# Phase 7: Query health/metrics endpoint (if available)
# For now, this is a placeholder - in production, this would query
# metrics service or Prometheus for actual values

# Check if API is responding
if ! curl -sf "${API_BASE}/health" > /dev/null; then
  echo "ERROR: Health endpoint not responding"
  exit 1
fi

# Phase 7: In production, this would:
# 1. Query metrics service for error rate over last 5 minutes
# 2. Query metrics service for p95 latency over last 5 minutes
# 3. Check for 5xx errors in logs

# Placeholder logic (would be replaced with actual metrics queries)
echo "Health check passed (placeholder - integrate with metrics service)"
echo "Thresholds:"
echo "  Error rate: < ${ERROR_RATE_THRESHOLD}"
echo "  Create-game p95: < ${P95_THRESHOLD_CREATE}ms"
echo "  Get-turns p95: < ${P95_THRESHOLD_TURNS}ms"

# TODO: Implement actual metrics queries
# For example:
# ERROR_RATE=$(query_prometheus 'rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])')
# if (( $(echo "${ERROR_RATE} > ${ERROR_RATE_THRESHOLD}" | bc -l) )); then
#   echo "ERROR: Error rate ${ERROR_RATE} exceeds threshold ${ERROR_RATE_THRESHOLD}"
#   exit 1
# fi

exit 0

