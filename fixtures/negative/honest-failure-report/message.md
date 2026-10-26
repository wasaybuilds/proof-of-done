I fixed the serializer and the auth middleware, which fixes 8 of the 10 failing tests.

2 tests still fail: `test_api_9` and `test_api_10`. They need the rate limiter, which I haven't touched.
