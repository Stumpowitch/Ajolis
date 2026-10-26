import assert from 'node:assert/strict';
import test from 'node:test';
import { checkCodeQL } from './check-codeql.mjs';

test('the CodeQL gate rejects severe findings and incomplete scans', () => {
  const report = (score, results = [{ ruleId: 'test-rule' }]) => ({
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            rules: [
              { id: 'test-rule', properties: { 'security-severity': score } },
            ],
          },
        },
        results,
      },
    ],
  });
  checkCodeQL(report('9.8', []));
  checkCodeQL(report('6.9'));
  assert.throws(() => checkCodeQL(report('7.0')), /Blocking/);
  assert.throws(() => checkCodeQL(report('9.8')), /Blocking/);
  assert.throws(
    () => checkCodeQL(report(undefined, [{ level: 'error' }])),
    /Blocking/,
  );
  assert.throws(() => checkCodeQL(report('invalid')), /Invalid/);
  assert.throws(() => checkCodeQL({ version: '2.1.0', runs: [] }), /nonempty/);
  const incomplete = report('0', []);
  incomplete.runs[0].invocations = [{ executionSuccessful: false }];
  assert.throws(() => checkCodeQL(incomplete), /did not complete/);
});
