import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

try {
  const coverageData = JSON.parse(readFileSync(resolve('apps/api/coverage/coverage-final.json'), 'utf8'));
  const statementsPct = coverageData.total.statements.pct;
  console.log(`STATEMENTS_PCT=${statementsPct}`);
  
  // Write to GITHUB_OUTPUT if available
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(process.env.GITHUB_OUTPUT, `STATEMENTS_PCT=${statementsPct}\n`, { flag: 'a' });
  }
} catch (error) {
  console.error('Failed to extract coverage:', error);
  process.exit(1);
}