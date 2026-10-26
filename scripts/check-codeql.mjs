import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function checkCodeQL(report) {
  if (report.version !== '2.1.0' || !report.runs?.length)
    throw new Error('Expected a nonempty SARIF 2.1.0 report.');
  const failures = [];
  for (const run of report.runs) {
    if (!Array.isArray(run.results)) throw new Error('Missing SARIF results.');
    if (
      run.invocations?.some(
        (invocation) => invocation.executionSuccessful === false,
      )
    )
      throw new Error('CodeQL analysis did not complete successfully.');
    const rules = run.tool.driver.rules ?? [];
    for (const result of run.results) {
      const rule =
        rules.find((item) => item.id === result.ruleId) ??
        rules[result.ruleIndex];
      const severity = rule?.properties?.['security-severity'];
      if (severity !== undefined && !Number.isFinite(Number(severity)))
        throw new Error('Invalid CodeQL security severity.');
      if (Number(severity) >= 7 || result.level === 'error')
        failures.push(result.ruleId ?? rule?.id ?? 'unknown rule');
    }
  }
  if (failures.length)
    throw new Error(`Blocking CodeQL findings: ${failures.join(', ')}`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const directory = process.argv[2];
  const files = readdirSync(directory).filter((file) =>
    file.endsWith('.sarif'),
  );
  if (!files.length) throw new Error('CodeQL did not produce a SARIF report.');
  for (const file of files)
    checkCodeQL(JSON.parse(readFileSync(join(directory, file), 'utf8')));
  console.log('No high or critical CodeQL findings.');
}
