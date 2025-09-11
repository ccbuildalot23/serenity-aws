# Serenity AWS - Execution Plan

**Generated:** September 10, 2025  
**Branch:** auth-compliance-ci-hardening  
**Mode:** Plan → Execute  
**Goal:** Ensure all claims are truthfully artifact-backed in GitHub

---

## 1) CI-Truth (Docs Automation)
- [ ] Collect latest CI + Nightly permalinks (job names: "Run web-phase2 compliance tests" + "PHI Protection E2E Tests")
- [ ] Create/update `scripts/generate-consent-docs.mjs` to populate docs from environment vars (--ciRunUrl, --nightlyRunUrl, --coverageFile)
- [ ] Update consent docs + release notes via automated script with live metrics
- [ ] Add CI workflow step to regenerate docs on main branch merges
- [ ] Verify all line anchors replaced with stable job names + permalinks

## 2) Test-Stabilizer (web-phase2/auth)
- [ ] Verify Headers/Request/Response + NextResponse.json shim loads correctly in test setup
- [ ] Ensure `/** @jest-environment node */` + dev-mode config in both route specs
- [ ] Re-run the 2 auth route specs: `me/__tests__/route.test.ts` + `verify-session/__tests__/route.test.ts`
- [ ] Generate and paste 18/18 PASS verification table with file paths
- [ ] Confirm tests remain stable and don't introduce flakiness

## 3) Coverage-Booster (API) — *Buffer Only If Trivial*
- [ ] Parse current coverage (75.16%) and identify 1-2 uncovered branches
- [ ] Target areas: expired-PHI timeout / malformed Authorization header / Zod validation errors
- [ ] Add minimal, stable tests ONLY if they increase coverage by ~+0.5-1.0% safely
- [ ] Re-run `npm run test:cov` and capture exact statements percentage
- [ ] STOP if adding tests creates instability or complexity

## 4) Infra-Pilot (Terraform) — *Validation Only*
- [ ] Normalize module interfaces (ensure all modules have proper variables.tf/outputs.tf)
- [ ] Fix any duplicate variable declarations preventing `terraform validate`
- [ ] Verify `terraform init -input=false && terraform validate` passes locally
- [ ] Confirm GitHub Actions `terraform` job runs init/validate on PRs using hashicorp/setup-terraform@v3
- [ ] Append CDK↔Terraform coexistence section to `docs/INFRASTRUCTURE_GUIDE.md`
- [ ] Document terraform local vs CI usage patterns

## 5) Compliance-Reporter (Consent Docs)
- [ ] Regenerate `FINAL_CONSENT_CHECKPOINT.md` with current test counts (88/88 API, 18/18 web)
- [ ] Update `CONSENT_CHECKPOINT_BMAD.md` with exact coverage (75.16% statements)
- [ ] Refresh `docs/DEPLOYMENT_CONSENT_CHECKPOINT.md` with live metrics + permalinks
- [ ] Replace all aspirational claims with artifact-backed evidence
- [ ] Insert sign-off slots for Dr. Colston + Tech Lead approval
- [ ] Ensure all GitHub Actions permalinks are current and functional

## 6) MVP Readiness (PRD Mapping)
- [ ] Map each PRD v1.1 feature to implementation status: (feature flag, test coverage, owner)
- [ ] Create comprehensive matrix in `MVP_FEATURE_READINESS.md`
- [ ] Update `PILOT_RUNBOOK.md` with deployment checks & rollback procedures
- [ ] Generate "GO/NO-GO" decision matrix with objective criteria
- [ ] Verify all core features (check-in, crisis alerts, provider dashboard, audit logging) are tested
- [ ] Document feature flag configuration for pilot deployment

---

## RISKS & MITIGATIONS

### Coverage Testing Risks
- **Risk:** Coverage tests introduce flakiness
- **Mitigation:** Run specific suites with `--runInBand` flag; only add tests if they're trivially stable

### Terraform Infrastructure Risks
- **Risk:** Provider/backend configuration conflicts
- **Mitigation:** Keep S3 backend commented for local validation; CI only runs init/validate without apply

### Documentation Consistency Risks
- **Risk:** Manual doc updates become stale
- **Mitigation:** Automated script generation from environment variables and live test results

---

## ROLLBACK STRATEGY

### Version Control
- Each major change in its own atomic commit
- Revert capability by specific SHA if needed
- Feature flags for any behavior changes

### Test Safety
- No existing tests modified unless fixing clear bugs
- New tests isolated and easily removable
- Coverage targets are additive, not replacement

---

## SUCCESS CRITERIA

### Technical Validation
- [ ] All tests passing: API (88/88) + Web auth (18/18) = 106/106 total
- [ ] Coverage at or above 75.16% statements
- [ ] Terraform validates successfully in both local and CI environments
- [ ] All GitHub Actions workflows functional with artifact uploads

### Documentation Truth
- [ ] All claims backed by concrete artifacts (test results, coverage files, workflow runs)
- [ ] No line anchors remaining - only stable job names and permalinks
- [ ] Consent documents reflect exact current metrics, not aspirational targets

### Deployment Readiness
- [ ] PRD feature mapping complete with test coverage verification
- [ ] Infrastructure ready for pilot deployment
- [ ] GO/NO-GO criteria clearly defined and measurable

---

**STATUS:** Ready for approval  
**NEXT:** Await "OK to begin?" then execute step-by-step with artifact verification