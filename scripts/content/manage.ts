#!/usr/bin/env node
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  ContentPackageImporter,
  HybridContentRepository,
  buildStructuredData,
  contentCoverage,
  robotsTxt,
  sitemapXml,
  writeQAReports,
} from "@six/domain/content-framework";

function arg(name, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function print(value) {
  console.log(JSON.stringify(value, null, 2));
}

const command = process.argv[2] ?? "qa";
const rootDir = process.cwd();
const packageDir = arg("package", "fixtures/content/p4-demo-package");
const targetDir = arg("target", "tmp/content-import-rehearsal");
const reportsDir = resolve(rootDir, "reports/content");

try {
  if (command === "validate") {
    print(new ContentPackageImporter({ rootDir, targetDir }).validateOnly(resolve(rootDir, packageDir)));
  } else if (command === "dry-run") {
    print(new ContentPackageImporter({ rootDir, targetDir }).dryRun(resolve(rootDir, packageDir)));
  } else if (command === "import") {
    const targetPath = resolve(rootDir, targetDir);
    if (targetDir.startsWith("tmp/") && existsSync(targetPath)) rmSync(targetPath, { recursive: true, force: true });
    print(new ContentPackageImporter({ rootDir, targetDir }).apply(resolve(rootDir, packageDir)));
  } else if (command === "index") {
    const repository = new HybridContentRepository({ rootDir, includePreview: false });
    const entries = repository.list();
    mkdirSync(reportsDir, { recursive: true });
    print({ ok: true, entries: entries.length, coverage: contentCoverage(entries) });
  } else if (command === "seo") {
    const repository = new HybridContentRepository({ rootDir, includePreview: false });
    const entries = repository.list();
    mkdirSync(reportsDir, { recursive: true });
    print({
      ok: true,
      robots: robotsTxt({ appEnv: process.env.APP_ENV ?? "development" }),
      sitemapUrlCount: (sitemapXml(entries).match(/<url>/gu) ?? []).length,
      structuredDataSamples: entries.slice(0, 3).map((entry) => buildStructuredData(entry)),
    });
  } else if (command === "qa") {
    const repository = new HybridContentRepository({ rootDir, includePreview: true });
    const qa = writeQAReports({ rootDir, entries: repository.loadEntries() });
    print({ ok: qa.ok, errors: qa.errors.length, warnings: qa.warnings.length, coverage: qa.coverage });
    if (!qa.ok) process.exitCode = 1;
  } else if (command === "links") {
    const repository = new HybridContentRepository({ rootDir, includePreview: true });
    const qa = writeQAReports({ rootDir, entries: repository.loadEntries() });
    print({ ok: qa.errors.filter((item) => item.code.includes("LINK")).length === 0, warnings: qa.warnings.filter((item) => item.code.includes("LINK")) });
  } else if (command === "rehearsal") {
    const importer = new ContentPackageImporter({ rootDir, targetDir });
    const pkg = resolve(rootDir, packageDir);
    const validate = importer.validateOnly(pkg);
    const dryRun = importer.dryRun(pkg);
    const apply = importer.apply(pkg);
    const targetPath = resolve(rootDir, targetDir);
    if (targetDir.startsWith("tmp/") && existsSync(targetPath)) rmSync(targetPath, { recursive: true, force: true });
    print({ ok: validate.ok && dryRun.ok && apply.applied, validate, dryRun, apply, cleaned: targetDir.startsWith("tmp/") && !existsSync(targetPath) });
  } else {
    throw new Error(`Unknown content command: ${command}`);
  }
} catch (err) {
  print({ ok: false, error: err.message });
  process.exitCode = 1;
}
