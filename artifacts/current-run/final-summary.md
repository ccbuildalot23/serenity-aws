=== TEST SUMMARY REPORT ===
Generated: Tue, Sep  9, 2025 10:26:18 AM

## API Tests (apps/api)
- Status: ✅ PASSED (67/67 tests pass)
- Coverage: 65.03% statements (below 80% threshold)
- PHI Timeout: ✅ VERIFIED in auth.routes.ts lines 393, 469, 497

## Web-phase2 Tests (apps/web-phase2)
- Status: ❌ FAILING (route tests have response format issues)
- PHI Timeout: ✅ VERIFIED in route.ts lines 119, 132

## CI Configuration
- web-phase2 tests: ✅ CONFIGURED in ci.yml lines 112-123
- Nightly E2E: ✅ CONFIGURED in nightly-compliance.yml lines 235-312

## Core HIPAA Claims Verification
✅ 15-min PHI timeout enforced in API /me endpoint
✅ 15-min PHI timeout enforced in API /verify-session endpoint
✅ 15-min PHI timeout enforced in web-phase2 /me endpoint
✅ 15-min PHI timeout enforced in web-phase2 /verify-session endpoint
