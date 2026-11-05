// Subject discovery, candidate naming, and manifest bookkeeping.

import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { View } from './prompts';

// The chosen identity image. It sits at the subject root.
export const REFERENCE_NAMES = ['reference.png', 'reference.webp', 'reference.jpg', 'reference.jpeg'];

// The raw material, exactly as provided. Never modified, never overwritten.
export const SOURCE_NAMES = ['source.png', 'source.webp', 'source.jpg', 'source.jpeg'];

// A candidate belongs either to a view, to the reference cleaning pass, or to the draft stage.
export type EntrySlot = View | 'reference' | 'draft';

export type ManifestEntry = {
  view: EntrySlot;
  model: string;
  variant: number;
  file: string;
  mediaType: string;
  promptVersion: string;
  prompt: string;
  aspectRatio: string;
  latencyMs: number;
  api?: 'image' | 'language';
  status: 'generated' | 'error';
  costEstimateUsd: number | null;
  createdAt: string;
  selected: boolean;
  bytes?: number;
  // Real output geometry. A provider that ignores the requested aspect shows up here.
  width?: number;
  height?: number;
  error?: string;
};

export type Manifest = {
  subject: string;
  reference: { file: string; mimeType: string; sha256: string } | null;
  promptVersion: string;
  subjectType?: string;
  style?: string;
  template?: string;
  cleanTemplate?: string;
  draftTemplate?: string;
  pose?: string;
  poses?: string[];
  // Viewpoints the reference image holds, in panel order. Empty when unknown.
  referenceViews?: string[];
  sources?: Array<{ file: string; sha256: string; role: 'subject' | 'style' }>;
  promotions?: Array<{ file: string; target: string; sha256: string; at: string }>;
  modelParams?: Record<string, 'aspectRatio' | 'size' | 'none'>;
  // Real cost reported by the gateway for the run, per model. Null when the report is unavailable.
  costUsd?: Array<{ model: string; usd: number; estimated?: boolean }>;
  entries: ManifestEntry[];
};

export type ReferenceFile = { path: string; mimeType: string; sha256: string };

export type Subject = {
  dir: string;
  id: string;
  category: string;
  // Identity source for generation: reference.* when chosen, else source.*.
  reference: ReferenceFile;
  chosen: boolean;
  // The raw material, always kept as provided.
  source: ReferenceFile | null;
  notes: string | null;
};

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

export function mimeForExtension(extension: string): string {
  return MIME_BY_EXTENSION[extension.toLowerCase()] ?? 'application/octet-stream';
}

export function extensionForMime(mimeType: string): string {
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  return 'png';
}

export function kebabModelId(model: string): string {
  return model
    .toLowerCase()
    .replaceAll('/', '-')
    .replaceAll('.', '-')
    .replaceAll('_', '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function hashFile(path: string): Promise<string> {
  const digest = new Bun.CryptoHasher('sha256');
  digest.update(await Bun.file(path).arrayBuffer());
  return digest.digest('hex');
}

export async function findReference(
  dir: string,
  names: string[] = REFERENCE_NAMES,
): Promise<ReferenceFile | null> {
  for (const name of names) {
    const path = join(dir, name);
    const file = Bun.file(path);
    if (await file.exists()) {
      const extension = name.split('.').pop() ?? 'png';
      return { path, mimeType: mimeForExtension(extension), sha256: await hashFile(path) };
    }
  }
  return null;
}

export async function loadSubject(dir: string): Promise<Subject> {
  const parts = dir.replaceAll('\\', '/').replace(/\/$/, '').split('/');
  const id = parts.at(-1) ?? dir;
  const category = parts.at(-2) ?? 'unknown';
  // reference.* is the chosen identity image. source.* is the raw material.
  const reference = await findReference(dir);
  const source = await findReference(dir, SOURCE_NAMES);
  if (!reference && !source) {
    throw new Error(
      `No identity image in ${dir}. Expected ${REFERENCE_NAMES.join(' or ')} (chosen) or ${SOURCE_NAMES.join(' or ')} (raw).`,
    );
  }
  const notesFile = Bun.file(join(dir, 'notes.md'));
  const notes = (await notesFile.exists()) ? (await notesFile.text()).trim() : null;
  return {
    dir,
    id,
    category,
    // Generation reads the chosen image. Fall back to the raw one before the choice.
    reference: (reference ?? source) as ReferenceFile,
    chosen: Boolean(reference),
    source,
    notes: notes || null,
  };
}

// Folder that holds material which is not ready for generation yet.
export const DRAFT_DIR = 'drafts';

// A subject is ready for view generation only when the art director chose an identity image.
export async function isReferenceChosen(dir: string): Promise<boolean> {
  return (await findReference(dir)) !== null;
}

// requireChosen: true keeps only subjects with a chosen reference.* image.
// The cleaning pass sets it to false, because a subject without a choice is its input.
export async function findSubjects(
  root: string,
  options: { requireChosen?: boolean } = {},
): Promise<string[]> {
  const requireChosen = options.requireChosen ?? true;
  const found: string[] = [];
  const categories = await readdir(root, { withFileTypes: true });
  for (const category of categories) {
    if (!category.isDirectory() || category.name.startsWith('.')) continue;
    if (category.name === DRAFT_DIR) continue;
    const categoryDir = join(root, category.name);
    const subjects = await readdir(categoryDir, { withFileTypes: true });
    for (const subject of subjects) {
      if (!subject.isDirectory() || subject.name.startsWith('.')) continue;
      const subjectDir = join(categoryDir, subject.name);
      const ready = requireChosen
        ? await isReferenceChosen(subjectDir)
        : (await findReference(subjectDir)) !== null || (await findReference(subjectDir, SOURCE_NAMES)) !== null;
      if (ready) found.push(subjectDir);
    }
  }
  return found.sort();
}

export async function readManifest(dir: string): Promise<Manifest | null> {
  const file = Bun.file(join(dir, 'manifest.json'));
  if (!(await file.exists())) return null;
  return (await file.json()) as Manifest;
}

export async function writeManifest(dir: string, manifest: Manifest): Promise<void> {
  await Bun.write(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

// The next free counter for one model in one folder.
// Never test the folder with Bun.file: that answers for regular files only, and a folder
// reports false. The readdir alone decides, and an absent folder gives an empty list.
export async function nextVariant(viewDir: string, model: string): Promise<number> {
  const slug = kebabModelId(model);
  const entries = await readdir(viewDir).catch(() => [] as string[]);
  let highest = 0;
  for (const entry of entries) {
    const match = entry.match(new RegExp(`^${slug}--(\\d+)\\.[a-z]+$`));
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return highest + 1;
}

export async function isViewSelected(viewDir: string): Promise<boolean> {
  for (const name of REFERENCE_NAMES) {
    if (await Bun.file(join(viewDir, name)).exists()) return true;
  }
  return false;
}

export async function markSelections(subjectDir: string, manifest: Manifest): Promise<number> {
  let selected = 0;
  for (const view of new Set(manifest.entries.map((entry) => entry.view))) {
    // A draft candidate is never selected by a reference file. It is promoted instead.
    if (view === 'draft') continue;
    // A cleaning candidate lives at the subject root, next to reference.<ext>, not in a folder
    // named "reference".
    const viewDir = view === 'reference' ? subjectDir : join(subjectDir, view);
    const reference = await findReference(viewDir);
    for (const entry of manifest.entries.filter((item) => item.view === view)) {
      if (!reference) {
        entry.selected = false;
        continue;
      }
      const candidatePath = join(subjectDir, entry.file);
      const exists = await Bun.file(candidatePath).exists();
      const match = exists ? (await hashFile(candidatePath)) === reference.sha256 : false;
      entry.selected = match;
      if (match) selected += 1;
    }
  }
  return selected;
}

export async function ensureViewDirs(subjectDir: string, views: readonly View[]): Promise<void> {
  for (const view of views) await mkdir(join(subjectDir, view), { recursive: true });
}
