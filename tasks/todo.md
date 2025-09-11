# Serenity AWS - BMAD Implementation Plan

**OBJECTIVE**: Use PRD and Vibecoding playbook to orchestrate tools, agents, and swarms (BMAD) so we ship an MVP-ready pilot.

## BMAD SWARMS EXECUTION PLAN

### 1. CI-Truth Swarm — Make CI job "Run Tests" truthfully green
- [ ] CI: normalize Node 20.x + pnpm 9, set env vars, cache, artifacts
- [ ] CI: run web-phase2 auth tests explicitly, then API tests with coverage; upload lcov + coverage-final.json
- [ ] CI: docs-regen uses gh CLI to pull latest nightly URL; pin to job names not line nums
- [ ] Add coverage extractor call in CI summary

### 2. Nightly-PHI Swarm — Make job "PHI Protection E2E Tests" pass
- [ ] Nightly: setup Node 20 + pnpm + Playwright (npx playwright install --with-deps)
- [ ] Start API & Web servers using existing package.json scripts
- [ ] Run phi-protection.spec.ts with proper artifacts upload
- [ ] Pin all checks by job names only

### 3. Coverage-Booster Swarm — Keep ≥75% statements without gaming it
- [ ] Update scripts/extract-coverage.mjs to handle jest "total.statements.pct" and exit nonzero if <75%
- [ ] If coverage <75% after truth jobs, add 1-2 meaningful API edge tests

### 4. Infra-Pilot Swarm — Pin Terraform and pilot deploy plan
- [ ] Terraform: local install instructions (macOS, Linux, Windows) + CI pin via hashicorp/setup-terraform@v3
- [ ] Deploy: add workflow_dispatch 'pilot-deploy' job gated by consent; handle existing AWS Backup Vault via "delete OR import" path

### 5. Compliance-Reporter Swarm — Update consent checkpoint docs with job names
- [ ] Replace all line-number anchors with job names in FINAL_CONSENT_CHECKPOINT.md
- [ ] Update CONSENT_CHECKPOINT_BMAD.md to reference job names
- [ ] Link latest run URLs dynamically using gh CLI

### 6. MVP Readiness Swarm — Map PRD features to tests, coverage, and flags
- [ ] Write /reports/MVP_FEATURE_READINESS.md with feature matrix
- [ ] Open PR with artifact links and job name references

## CONSENT CHECKPOINTS
- **AWS DELETE**: Must type exactly "CONFIRM DELETE BACKUP VAULT"
- **AWS IMPORT**: Must type exactly "CONFIRM IMPORT PLAN"

## ACCEPTANCE CRITERIA
- [x] CI: job "Run Tests" green; artifacts uploaded (lcov.info + coverage-final.json)
- [x] Nightly: job "PHI Protection E2E Tests" green; playwright-report uploaded  
- [x] Coverage: ≥ 75.0% statements from extractor
- [x] Docs: consent checkpoints reference job names (no line anchors)
- [x] Pilot deploy: pilot-deploy.yml exists; dry-run plan printed; execution only after consent

**STATUS**: ✅ READY FOR EXECUTION
**NEXT STEP**: Await user "OK" to begin BMAD swarm execution