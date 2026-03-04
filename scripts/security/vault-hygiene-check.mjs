import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_DIRECTORIES = [
  'server/modules/vault',
  'server/modules/security/stepup',
];
const FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const CONSOLE_USAGE_PATTERN = /\bconsole\.(log|info|debug|warn|error)\s*\(/i;
const SENSITIVE_LOG_PATTERN = /\blog\.(info|warn|error|debug)\b.*\b(ciphertext|authTag|wrappedKey|ENCRYPTION_KEY)\b/i;

const toPosixPath = (value) => value.split(path.sep).join('/');

const collectFiles = async (directoryPath) => {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
      continue;
    }

    if (!FILE_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }

    files.push(fullPath);
  }

  return files;
};

const checkFileContent = async (fullPath) => {
  const content = await fs.readFile(fullPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const issues = [];

  lines.forEach((line, index) => {
    if (CONSOLE_USAGE_PATTERN.test(line)) {
      issues.push(`${toPosixPath(path.relative(ROOT, fullPath))}:${index + 1} uses console logging`);
    }

    if (SENSITIVE_LOG_PATTERN.test(line)) {
      issues.push(`${toPosixPath(path.relative(ROOT, fullPath))}:${index + 1} logs sensitive keyword`);
    }
  });

  return issues;
};

const run = async () => {
  const allIssues = [];

  for (const relativeDirectory of TARGET_DIRECTORIES) {
    const absoluteDirectory = path.join(ROOT, relativeDirectory);
    const files = await collectFiles(absoluteDirectory);

    for (const file of files) {
      const issues = await checkFileContent(file);
      allIssues.push(...issues);
    }
  }

  if (allIssues.length > 0) {
    process.stderr.write('Vault security hygiene check failed.\n');
    allIssues.forEach((issue) => {
      process.stderr.write(`- ${issue}\n`);
    });
    process.exit(1);
  }

  process.stdout.write('Vault security hygiene check passed.\n');
};

run().catch((error) => {
  process.stderr.write(`Vault security hygiene check crashed: ${String(error)}\n`);
  process.exit(1);
});
