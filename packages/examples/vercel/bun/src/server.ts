// Vercel's Bun runtime traces a Function by walking the entry's module graph, so a package only
// the CommonJS files of a traced one require (tslib, required by every @nestjs file) never reaches
// the deployed tree: /var/task/node_modules/@nestjs/common cannot import tslib, and every route
// answers 500. Until that is fixed (vercel/vercel#17354, #16361) the Function carries the whole
// application in one file, built from src/standalone.ts by the `bundle` script the build command
// runs; this entry only loads it.
import type { NestApplication } from '@nestjs/core';
import '../dist/standalone.mjs';

// The builder picks its root entrypoint by matching this file against
// `(?:from|require|import)\s*['"]@nestjs/core['"]`, so the file has to name the package: a
// type-only import satisfies it and disappears before the Function runs.
export type BundledApplication = NestApplication;
