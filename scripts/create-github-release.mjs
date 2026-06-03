import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const version = stringValue(packageJson.version);

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`package.json has an invalid release version: ${version}`);
}

const tagName = `v${version}`;
const releaseName = `Agent Memory OS ${tagName}`;
const releaseBody = extractReleaseNotes(readFileSync("CHANGELOG.md", "utf8"), version);
const repository = requiredEnv("GITHUB_REPOSITORY");
const token = requiredEnv("GITHUB_TOKEN");

const existingRelease = await githubRequest(`/repos/${repository}/releases/tags/${tagName}`, {
  allowNotFound: true,
  token,
});

if (existingRelease) {
  console.log(`GitHub Release ${tagName} already exists; leaving it unchanged.`);
  process.exit(0);
}

await githubRequest(`/repos/${repository}/releases`, {
  body: {
    body: releaseBody,
    draft: false,
    make_latest: "true",
    name: releaseName,
    prerelease: false,
    tag_name: tagName,
    target_commitish: process.env.GITHUB_SHA ?? "main",
  },
  method: "POST",
  token,
});

console.log(`Created GitHub Release ${tagName}.`);

function extractReleaseNotes(changelog, targetVersion) {
  const headingPattern = new RegExp(
    `^##\\s+(?:agent-memory-os@)?${escapeRegExp(targetVersion)}(?:\\s|$).*`,
    "m",
  );
  const headingMatch = headingPattern.exec(changelog);

  if (!headingMatch || headingMatch.index === undefined) {
    throw new Error(`CHANGELOG.md does not contain a section for ${targetVersion}.`);
  }

  const sectionStart = headingMatch.index;
  const afterHeadingStart = sectionStart + headingMatch[0].length;
  const nextHeadingMatch = /^##\s+/m.exec(changelog.slice(afterHeadingStart));
  const sectionEnd =
    nextHeadingMatch && nextHeadingMatch.index !== undefined
      ? afterHeadingStart + nextHeadingMatch.index
      : changelog.length;
  const notes = changelog.slice(afterHeadingStart, sectionEnd).trim();

  if (!notes) {
    throw new Error(`CHANGELOG.md section for ${targetVersion} is empty.`);
  }

  return notes;
}

async function githubRequest(path, options) {
  const response = await fetch(`https://api.github.com${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${options.token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    method: options.method ?? "GET",
  });

  if (options.allowNotFound && response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(
      `GitHub API ${options.method ?? "GET"} ${path} failed: ${response.status} ${responseBody}`,
    );
  }

  return response.json();
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function stringValue(value) {
  return typeof value === "string" ? value : "";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
