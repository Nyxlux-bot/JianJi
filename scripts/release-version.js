#!/usr/bin/env node

const fs = require('fs');
const { execFileSync } = require('child_process');

const ALLOWED_BUMPS = new Set(['patch', 'minor', 'major', 'beta']);
const versionArgument = process.argv[2] || 'patch';

function run(command, args, options = {}) {
  const output = execFileSync(command, args, {
    encoding: 'utf8',
    stdio: options.stdio || 'pipe',
  });
  return typeof output === 'string' ? output.trim() : '';
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  fs.writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

// beta 为 0 表示正式版；1.9.0-beta.2 的 beta 为 2
function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-beta\.([1-9]\d*))?$/.exec(version);
  if (!match) {
    throw new Error(`版本号格式无效：${version}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    beta: Number(match[4] || 0),
  };
}

function formatVersion({ major, minor, patch, beta }) {
  return `${major}.${minor}.${patch}${beta ? `-beta.${beta}` : ''}`;
}

function bumpVersion(version, bumpType) {
  const next = parseVersion(version);
  if (bumpType === 'beta') {
    // 已是 beta 就接着数；从正式版起步则是下一个补丁版的第一个 beta
    if (!next.beta) {
      next.patch += 1;
    }
    next.beta += 1;
    return formatVersion(next);
  }
  const wasBeta = next.beta > 0;
  next.beta = 0;
  // 当前是 beta 时，patch 就是把这一版转正
  if (wasBeta && bumpType === 'patch') {
    return formatVersion(next);
  }
  if (bumpType === 'major') {
    next.major += 1;
    next.minor = 0;
    next.patch = 0;
  } else if (bumpType === 'minor') {
    next.minor += 1;
    next.patch = 0;
  } else {
    next.patch += 1;
  }
  return formatVersion(next);
}

// 同一版本号里 beta 排在正式版之前
function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch || (a.beta || 99) - (b.beta || 99);
}

function resolveNextVersion(currentVersion, argument) {
  if (ALLOWED_BUMPS.has(argument)) {
    return bumpVersion(currentVersion, argument);
  }

  parseVersion(argument);
  if (compareVersions(argument, currentVersion) <= 0) {
    throw new Error(`目标版本必须高于当前版本：${currentVersion} -> ${argument}`);
  }
  return argument;
}

// 1.9.0-beta.2 → 1090002，1.9.0 → 1090099：beta 和正式版同一包名互相覆盖安装，同一版本的 beta 必须排在正式版前。
// 旧规则（1.8.1 → 10801）的号都比新规则小，从旧版升级不受影响
function getVersionCode(version, currentCode) {
  const { major, minor, patch, beta } = parseVersion(version);
  if (minor > 99 || patch > 99 || beta > 98) {
    throw new Error(`版本号超出 versionCode 编码范围（次版本、补丁 ≤ 99，beta ≤ 98）：${version}`);
  }
  const calculated = major * 1000000 + minor * 10000 + patch * 100 + (beta || 99);
  return Number.isFinite(currentCode) && currentCode >= calculated
    ? currentCode + 1
    : calculated;
}

function assertCleanWorkingTree() {
  const status = run('git', ['status', '--porcelain']);
  if (status) {
    throw new Error('工作区不干净。请先提交当前改动，再执行发版脚本。');
  }
}

function assertTagAvailable(tag) {
  const localTag = run('git', ['tag', '--list', tag]);
  if (localTag) {
    throw new Error(`本地已存在 tag：${tag}`);
  }

  const remoteTag = run('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`]);
  if (remoteTag) {
    throw new Error(`远端已存在 tag：${tag}`);
  }
}

function assertBranchNotBehindRemote() {
  const branch = run('git', ['branch', '--show-current']);
  if (!branch) {
    throw new Error('当前不在本地分支上，不能执行发版脚本。');
  }

  const remoteRef = `origin/${branch}`;
  try {
    run('git', ['rev-parse', '--verify', '--quiet', remoteRef]);
  } catch {
    return branch;
  }

  const counts = run('git', ['rev-list', '--left-right', '--count', `${branch}...${remoteRef}`]);
  const [, behindText] = counts.split(/\s+/);
  const behind = Number(behindText || 0);
  if (behind > 0) {
    throw new Error(`本地 ${branch} 落后 ${remoteRef} ${behind} 个提交。请先执行 git pull --rebase origin ${branch}。`);
  }
  return branch;
}

function main() {
  if (!ALLOWED_BUMPS.has(versionArgument) && !/^\d+\.\d+\.\d+(-beta\.[1-9]\d*)?$/.test(versionArgument)) {
    throw new Error('用法：npm run release:patch | release:minor | release:major | release:beta，或 node scripts/release-version.js 1.9.0 / 1.9.0-beta.1');
  }

  assertCleanWorkingTree();

  run('git', ['fetch', 'origin', '--tags', '--prune'], { stdio: 'inherit' });
  const branch = assertBranchNotBehindRemote();

  const appJson = readJson('app.json');
  const packageJson = readJson('package.json');
  const packageLock = readJson('package-lock.json');
  const currentVersion = appJson.expo.version;
  const nextVersion = resolveNextVersion(currentVersion, versionArgument);
  const nextTag = `v${nextVersion}`;
  const currentCode = Number(appJson.expo.android?.versionCode || 0);
  const nextCode = getVersionCode(nextVersion, currentCode);

  assertTagAvailable(nextTag);

  appJson.expo.version = nextVersion;
  appJson.expo.android.versionCode = nextCode;
  packageJson.version = nextVersion;
  packageLock.version = nextVersion;
  if (packageLock.packages && packageLock.packages['']) {
    packageLock.packages[''].version = nextVersion;
  }

  writeJson('app.json', appJson);
  writeJson('package.json', packageJson);
  writeJson('package-lock.json', packageLock);

  run('git', ['add', 'app.json', 'package.json', 'package-lock.json'], { stdio: 'inherit' });
  run('git', ['commit', '-m', `chore: bump version to ${nextVersion}`], { stdio: 'inherit' });
  run('git', ['tag', nextTag], { stdio: 'inherit' });

  run('git', ['push', '--atomic', 'origin', branch, nextTag], { stdio: 'inherit' });

  const kind = parseVersion(nextVersion).beta ? 'beta 预发布' : '正式 Release';
  console.log(`已推送 ${nextTag}，versionCode ${nextCode}。GitHub Actions 将打包并创建${kind}，请确认任务结果。`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = { resolveNextVersion, getVersionCode };
