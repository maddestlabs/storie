import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const targetRoots = [
  path.join(repoRoot, 'docs', 'demos'),
  path.join(repoRoot, 'documentation'),
];

const FRONTMATTER_MARKER = 'authoringCheck: explicit-conditionals';
const COMMENT_MARKER_PATTERN = /^<!--\s*authoring-check:\s*explicit-conditionals\s*-->$/m;

function collectMarkdownFiles(targetPath) {
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    return [targetPath];
  }

  const files = [];
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    const fullPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

function isJavaScriptFence(infoString) {
  const info = String(infoString || '').trim().toLowerCase();
  return info === 'js' || info === 'javascript' || info.startsWith('js ') || info.startsWith('javascript ');
}

function isMarkedForAuthoringCheck(text) {
  if (text.startsWith('---\n')) {
    const end = text.indexOf('\n---\n', 4);
    if (end >= 0) {
      const frontmatter = text.slice(4, end);
      if (frontmatter.includes(FRONTMATTER_MARKER)) {
        return true;
      }
    }
  }

  return COMMENT_MARKER_PATTERN.test(text);
}

function looksLikeTernary(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('//')) return false;
  if (!trimmed.includes('?') || !trimmed.includes(':')) return false;
  if (trimmed.includes('??')) return false;

  const questionIndex = trimmed.indexOf('?');
  const colonIndex = trimmed.indexOf(':', questionIndex + 1);
  if (questionIndex < 0 || colonIndex < 0) return false;

  const before = trimmed[questionIndex - 1] || '';
  const after = trimmed[questionIndex + 1] || '';
  if (before === '.' || after === '.') return false;

  return true;
}

function scanFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  if (!isMarkedForAuthoringCheck(text)) {
    return null;
  }
  const lines = text.split(/\r?\n/);
  const issues = [];

  let inFence = false;
  let fenceLanguage = '';

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = line.match(/^```(.*)$/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceLanguage = fenceMatch[1] || '';
      } else {
        inFence = false;
        fenceLanguage = '';
      }
      continue;
    }

    if (!inFence || !isJavaScriptFence(fenceLanguage)) continue;
    if (!looksLikeTernary(line)) continue;

    issues.push({
      line: index + 1,
      content: line.trim(),
    });
  }

  return issues;
}

const markdownFiles = targetRoots.flatMap((targetPath) => collectMarkdownFiles(targetPath));
const failures = [];
let checkedFileCount = 0;

for (const filePath of markdownFiles) {
  const issues = scanFile(filePath);
  if (!issues) continue;
  checkedFileCount += 1;
  if (issues.length === 0) continue;
  failures.push({ filePath, issues });
}

if (failures.length > 0) {
  console.error('Authored conditional style check failed. Prefer explicit if/else over ternaries in authored Storie Markdown code.');
  for (const failure of failures) {
    const relativePath = path.relative(repoRoot, failure.filePath);
    for (const issue of failure.issues) {
      console.error(`- ${relativePath}:${issue.line} ${issue.content}`);
    }
  }
  process.exit(1);
}

console.log(`Authored conditional style check passed for ${checkedFileCount} Markdown file(s).`);