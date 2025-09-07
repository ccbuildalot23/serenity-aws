# API Fix Notes: Authentication & Risk Assessment

**Date**: September 7, 2025  
**Status**: 🔧 IN PROGRESS  
**Scope**: Fix failing unit tests for authentication routes and risk assessment logic

## Executive Summary

The build infrastructure for web-phase2 is now stable, but 13 unit tests are failing in the API layer. These failures involve missing authentication routes, incorrect HTTP status codes, and misaligned risk assessment logic. This document tracks the systematic resolution of these issues to ensure all tests pass and the API meets industry standards for HIPAA-compliant mental health platforms.

## Test Failure Analysis

### 1. Authentication Route Issues

#### Missing Routes (404 Errors)
- **`GET /api/auth/me`**: Route does not exist
  - Expected: 200 with user profile data
  - Expected: 401 when no token provided
  - Actual: 404 (route not found)

- **`POST /api/auth/verify-session`**: Route does not exist
  - Expected: 200 with session validation
  - Expected: 401 for expired sessions
  - Actual: 404 (route not found)

#### Status Code Mismatches
- **`POST /api/auth/register`**:
  - Expected: 201 (Created)
  - Actual: 200 (OK)
  - Issue: Should return 201 for successful resource creation

- **`POST /api/auth/login`** (invalid email):
  - Expected: 400 (Bad Request)
  - Actual: 401 (Unauthorized)
  - Issue: Invalid format should be 400, not 401

#### Response Structure Issues
- **`POST /api/auth/login`** (valid credentials):
  - Expected: Top-level `accessToken`, `refreshToken`, `idToken` properties
  - Actual: Tokens nested under `tokens` object
  - Issue: Response structure doesn't match test expectations

### 2. Check-in API Issues

#### Risk Assessment Logic
- **Crisis Detection**:
  - Expected: `riskLevel: "high"` for low mood (1-2) or high anxiety (8-10)
  - Actual: `riskLevel: "low"` for both scenarios
  - Issue: Risk calculation algorithm not aggressive enough

- **Moderate Risk**:
  - Expected: `riskLevel: "moderate"` for mixed metrics
  - Actual: `riskLevel: "low"`
  - Issue: Threshold logic needs adjustment

#### Insights Structure
- **Streak Tracking**:
  - Expected: `streakDays` property with value 0 for no history
  - Actual: `currentStreak` property with value 1
  - Issue: Property name mismatch and incorrect default value

### 3. Setup Test File
- **Empty Test Suite**: `setup.ts` file contains no tests, causing Jest failure
- **Issue**: Test configuration file incorrectly included in test suite

## Industry Standards Research

Based on RESTful API best practices and HIPAA compliance requirements:

### HTTP Status Codes
- **201 Created**: For successful resource creation (registration)
- **200 OK**: For successful data retrieval or updates
- **400 Bad Request**: For invalid input format or validation errors
- **401 Unauthorized**: For missing or invalid authentication
- **403 Forbidden**: For insufficient permissions
- **404 Not Found**: For non-existent resources

### Authentication Endpoints
- **`/api/auth/me`**: Standard endpoint for user profile retrieval
- **`/api/auth/verify-session`**: Session validation without refresh
- **Response Structure**: Consistent with OAuth 2.0 and JWT standards

## Implementation Plan

### Phase 1: Fix Authentication Routes (Days 1-3)

#### 1.1 Implement Missing Routes
- [ ] Create `GET /api/auth/me` endpoint
- [ ] Create `POST /api/auth/verify-session` endpoint
- [ ] Add proper error handling and status codes

#### 1.2 Fix Status Code Issues
- [ ] Update registration route to return 201
- [ ] Fix login validation to return 400 for bad format
- [ ] Align all auth routes with HTTP standards

#### 1.3 Standardize Response Structure
- [ ] Flatten token response structure for login
- [ ] Ensure consistent error message format
- [ ] Add proper CORS headers

### Phase 2: Fix Risk Assessment Logic (Days 4-5)

#### 2.1 Risk Calculation Algorithm
- [ ] Implement crisis thresholds: mood ≤ 2 OR anxiety ≥ 8
- [ ] Add moderate risk: mood 3-5 AND anxiety 5-7
- [ ] Ensure proper risk escalation logic

#### 2.2 Insights Response Structure
- [ ] Rename `currentStreak` to `streakDays`
- [ ] Fix default streak value for no history
- [ ] Align property names with test expectations

### Phase 3: Test Suite Cleanup (Day 6)
- [ ] Remove empty tests from setup.ts
- [ ] Add comprehensive test coverage
- [ ] Verify all status codes and response structures

## Security & Compliance Considerations

### HIPAA Requirements
- All PHI access must be logged via audit trail
- Session timeout after 15 minutes of inactivity
- Multi-factor authentication for production
- Encryption of all sensitive data in transit

### OWASP Best Practices
- Rate limiting on authentication endpoints
- Input sanitization and validation
- Secure session management
- Protection against timing attacks

## Expected Outcomes

Upon completion:
- ✅ All 67 unit tests passing
- ✅ Code coverage above 80% threshold
- ✅ HTTP status codes aligned with industry standards
- ✅ Risk assessment logic meeting clinical guidelines
- ✅ Authentication routes fully implemented
- ✅ HIPAA compliance maintained throughout

---

**Next Steps**: Begin implementation of missing authentication routes with proper status codes and response structures.