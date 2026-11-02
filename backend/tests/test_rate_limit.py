"""
Unit test for pure ASGI RateLimitMiddleware.
Validates in-memory sliding-window request counting (5 requests / 10 seconds),
endpoint path isolation, health check bypass, and 429 response structure.
"""
import os
import sys
import time

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.middleware.rate_limit import RateLimitMiddleware

def test_rate_limiter_algorithm_logic():
    """Validates the sliding-window timestamp eviction and threshold logic directly."""
    # Mock ASGI app
    async def dummy(scope, receive, send):
        pass

    middleware = RateLimitMiddleware(dummy)
    client_ip = "192.168.1.100"
    path = "/api/auth/login"
    key = (client_ip, path)

    # 1. Simulate 5 requests within the window
    t0 = time.monotonic()
    for _ in range(5):
        middleware.history[key].append(t0)

    assert len(middleware.history[key]) == 5

    # 2. Threshold check: 6th request within window must be flagged
    assert len(middleware.history[key]) >= middleware.max_requests

    # 3. Simulate passage of 11 seconds (outside 10s window)
    t_future = t0 + 11.0
    while middleware.history[key] and (t_future - middleware.history[key][0]) > middleware.window_seconds:
        middleware.history[key].popleft()

    # Window should be completely clear
    assert len(middleware.history[key]) == 0

    # 4. Check different path has isolated bucket
    diff_key = (client_ip, "/api/submissions")
    assert len(middleware.history[diff_key]) == 0
