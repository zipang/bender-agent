// Blueprint generator. Three stages, one script.
//
// Stage 0, draft:   blueprints/drafts/<draft>/subject/* + style/*  ->  <draft>/<model-slug>--<NN>.<ext>
//                   The art director promotes one candidate to <subject>/reference.<ext>.
// Stage 1, clean:   <subject>/reference.<ext> (backed up to source.ext first) -> <subject>/<model-slug>--<NN>.<ext>
// Stage 2, views:   <subject>/reference.<ext> -> <subject>/<view>/<model-slug>--<NN>.<ext>
//
// The art director reviews the variants and copies the chosen one to reference.<ext>.
// This script never selects, scores, or deletes an image.

import { gateway, generateImage, generateText } from 'ai';
import { mkdir } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { fetchCatalog, formatCapabilityTable, listUsableModels, resolveModels, type ModelApi } from './lib/models';
import { loadDraft, type Draft, type DraftNotes } from './lib/drafts';
import {
  buildCleanPrompt,
  buildDraftPrompt,
  buildPrompt,
  DRAFT_TEMPLATE,
  loadCleanTemplate,
  loadDraftTemplate,
  loadTemplate,
  parseViews,
  subjectTypeForCategory,
  VIEWS,
  type DraftTemplate,
  type PromptTemplate,
  type View,
} from './lib/prompts';
import {
  DRAFT_DIR,
  ensureViewDirs,
  extensionForMime,
  findSubjects,
  hashFile,
  isViewSelected,
  kebabModelId,
  loadSubject,
  markSelections,
  nextVariant,
  readManifest,
  writeManifest,
  type EntrySlot,
  type Manifest,
  type ManifestEntry,
  type Subject,
} from './lib/subjects';

const PROMPT_VERSION = 'blueprint-v6-multiview';

// Repository root. The script lives in <root>/scripts/blueprint-generate/.
const PROJECT_ROOT = resolve(import.meta.dir, '..', '..');
const BLUEPRINTS_ROOT = resolve(PROJECT_ROOT, 'blueprints');

function fromRoot(path: string): string {
  return resolve(PROJECT_ROOT, path);
}
const DEFAULT_ASPECT = '1:1';

type AspectRatio = `${number}:${number}`;

type Options = {
  subject: string | null;
  all: boolean;
  models: string[];
  views: View[];
  variants: number;
  aspect: AspectRatio;
  concurrency: number;
  style: string;
  subjectType: string | null;
  template: string | null;
  // The viewpoints the reference image holds, in panel order. Empty when unknown.
  referenceViews: string[];
  // Extra instructions for this run, passed to the view prompt. Empty when none.
  notes: string[];
  clean: boolean;
  defects: string;
  // Authorized content changes for the repair pass. Empty means none.
  edits: string[];
  // Number of panels in the reference image that the repair pass must preserve.
  panels: number;
  cleanTemplate: string | null;
  draft: string | null;
  draftTemplate: string | null;
  // One pose per panel. One pose gives a single-view sheet, two or more give a multi-panel sheet.
  poses: string[];
  maxImages: number;
  subjectNote: string | null;
  styleNote: string | null;
  // What the art director wants kept, and how to read an ambiguous reference.
  // The strongest rule in the prompt: it wins over every image.
  specificSubjectDetails: string | null;
  // Ask the art director targeted questions instead of generating when the material is thin.
  ask: boolean;
  promote: boolean;
  file: string | null;
  listModels: boolean;
};

const DEFAULT_STYLE = 'low-poly stylized video game figurine';
const DEFAULT_DEFECTS = 'white outline around the subject, cast shadow, halo, speckles';
// A drafting pose. It carries the most identity in one frame, and the six views come later.
const DEFAULT_POSE = 'front three-quarter view from the left, camera at mid height, no perspective exaggeration';
// The opposite side of DEFAULT_POSE. A two-view sheet shows one panel per side.
const DEFAULT_POSE_B = 'rear three-quarter view from the right, camera at mid height, no perspective exaggeration';

// The default image model. Set it once in .env.local instead of retyping --models.
// Comma separated IDs are accepted, the same as --models.
function defaultModels(): string[] {
  return (process.env.DEFAULT_GENERATION_MODEL ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

// Real spend from the AI Gateway, per model, for one UTC day. The report is account wide,
// so a run takes the difference between two snapshots. An unavailable report returns an empty map.
async function spendByModel(): Promise<Map<string, number>> {
  const day = new Date().toISOString().slice(0, 10);
  const report = await gateway.getSpendReport({ startDate: day, endDate: day, groupBy: 'model' });
  const costs = new Map<string, number>();
  for (const row of report.results) {
    if (row.model && Number.isFinite(row.totalCost)) costs.set(row.model, row.totalCost);
  }
  return costs;
}

function spendDelta(before: Map<string, number>, after: Map<string, number>, model: string): number | null {
  const value = after.get(model);
  if (value === undefined) return null;
  return value - (before.get(model) ?? 0);
}

function parseAspect(raw: string): AspectRatio {
  if (!/^\d+:\d+$/.test(raw)) throw new Error(`--aspect must look like 1:1 or 16:9, got "${raw}"`);
  return raw as AspectRatio;
}

function readOptions(argv: string[]): Options {
  const value = (name: string): string | null => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? (argv[index + 1] ?? null) : null;
  };
  const flag = (name: string): boolean => argv.includes(`--${name}`);
  const variantsRaw = value('variants');
  const concurrencyRaw = value('concurrency');
  const maxImagesRaw = value('max-images');
  // --poses wins. Then the older --pose / --pose-b / --two-view forms keep working.
  const poses = (() => {
    const list = (value('poses') ?? '')
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
    if (list.length > 0) return list;
    const first = value('pose') ?? DEFAULT_POSE;
    const second = value('pose-b');
    if (second) return [first, second];
    if (flag('two-view')) return [first, DEFAULT_POSE_B];
    return [first];
  })();
  return {
    subject: value('subject'),
    all: flag('all'),
    models: (() => {
      const explicit = (value('models') ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      return explicit.length > 0 ? explicit : defaultModels();
    })(),
    views: parseViews(value('views') ?? 'all'),
    variants: variantsRaw ? Number(variantsRaw) : 1,
    aspect: parseAspect(value('aspect') ?? DEFAULT_ASPECT),
    concurrency: concurrencyRaw ? Number(concurrencyRaw) : 2,
    style: value('style') ?? DEFAULT_STYLE,
    subjectType: value('subject-type'),
    template: value('template'),
    // One --reference-views flag per viewpoint, or several separated by a pipe or a semicolon.
    referenceViews: argv
      .flatMap((arg, index) => (arg === '--reference-views' ? [argv[index + 1] ?? ''] : []))
      .flatMap((item) => item.split(/[|;]/))
      .map((item) => item.trim())
      .filter(Boolean),
    // One --notes flag per instruction, repeatable.
    notes: argv
      .flatMap((arg, index) => (arg === '--notes' ? [argv[index + 1] ?? ''] : []))
      .map((item) => item.trim())
      .filter(Boolean),
    clean: flag('clean'),
    defects: value('defects') ?? DEFAULT_DEFECTS,
    // One --edits flag per edit, repeatable. No comma split: an edit is prose, and prose
    // contains commas. A semicolon separates several edits inside one flag.
    edits: argv
      .flatMap((arg, index) => (arg === '--edits' ? [argv[index + 1] ?? ''] : []))
      .flatMap((item) => item.split(';'))
      .map((item) => item.trim())
      .filter(Boolean),
    panels: (() => {
      const raw = value('panels');
      if (!raw) return 1;
      const count = Number(raw);
      if (!Number.isInteger(count) || count < 1) {
        throw new Error(`--panels must be a positive integer, got "${raw}"`);
      }
      return count;
    })(),
    cleanTemplate: value('clean-template'),
    draft: value('draft'),
    draftTemplate: value('draft-template'),
    poses,
    maxImages: maxImagesRaw ? Number(maxImagesRaw) : 6,
    subjectNote: value('subject-note'),
    styleNote: value('style-note'),
    specificSubjectDetails: value('specific-subject-details'),
    ask: flag('ask'),
    promote: flag('promote'),
    file: value('file'),
    listModels: flag('list-models'),
  };
}

function usage(): string {
  return [
    'Blueprint generator',
    '',
    'Usage:',
    '  bun run blueprint-generate.ts --draft blueprints/drafts/r5 --variants 3',
    '  bun run blueprint-generate.ts --promote --draft blueprints/drafts/r5 --file meta-muse-image-1-0--02.webp --subject blueprints/vehicules/renault-5-01',
    '  bun run blueprint-generate.ts --clean --subject blueprints/vehicules/blue-van-01',
    '  bun run blueprint-generate.ts --subject blueprints/vehicules/blue-van-01',
    '  bun run blueprint-generate.ts --all',
    '  bun run blueprint-generate.ts --list-models',
    '',
    'Draft stage (stage 0):',
    '  --draft <dir>       Draft folder with subject/ and style/ subfolders of reference images.',
    '  --poses "<a> | <b> | <c>"  One pose per panel, separated by |. Two or more make a multi-panel sheet.',
    '  --pose <text>       Camera pose of a single-view sheet. Default: front three-quarter view.',
    '  --pose-b <text>     Camera pose of the second panel. Shorthand for two poses.',
    '  --two-view          Shorthand for --pose plus --pose-b.',
    '  --subject-note <t>  Art director words about the reference images. Overrides notes.md.',
    '  --specific-subject-details <t>  What to keep and how to read an ambiguous reference. Wins over images.',
    '  --style-note <t>    Art director words about the style. Overrides notes.md.',
    '  --max-images <n>    Maximum reference images sent in one request. Default 6.',
    '  --draft-template <path>  Draft prompt template. Default prompts/draft.md.',
    '  --ask               Ask interactive questions when the references are thin or ambiguous.',
    '  --promote           Copy one draft candidate to <subject>/reference.<ext>.',
    '  --file <name>       The candidate to promote, inside the draft folder.',
    '',
    'Clean stage (stage 1):',
    '  --clean             Repair the reference. Backs reference up to source first.',
    '  --defects <text>    Artifacts to remove. Default: white outline, cast shadow, halo, speckles.',
    '  --edits <text>      One authorized content change. Repeat the flag for several edits, or',
    '                      separate them with a semicolon. Example: --edits "blank the plate text"',
    '  --panels <n>        Panels in the reference image, preserved by the repair. Default 1.',
    '  --clean-template <path>  Repair prompt template. Default prompts/clean.md.',
    '',
    'View stage (stage 2):',
    '  --subject <dir>     One subject folder that contains reference.png or reference.webp',
    '  --all               Every subject under blueprints/<category>/<subject>/',
    '  --views <list>      front,left,back,right,top,bottom. Default all.',
    '  --reference-views "<a> | <b>"  Viewpoints held by the reference image, in panel order.',
    '  --notes <text>      Extra instruction for this view. Repeat the flag for several notes.',
    '  --template <path>   View prompt template. Default prompts/blueprint.md.',
    '',
    'Shared:',
    '  --models <ids>      Comma separated provider/model IDs. Default: DEFAULT_GENERATION_MODEL.',
    '  --variants <n>      Variants per request and per model. Default 1.',
    '  --aspect <ratio>    Requested aspect ratio. Default 1:1.',
    '  --style <text>      Rendering style injected into the prompt.',
    '  --subject-type <t>  vehicule, character, or object. Default from the folder name.',
    '  --concurrency <n>   Parallel image requests. Default 2.',
    '  --list-models       Print the catalog models that accept image input and output.',
  ].join('\n');
}

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const size = Math.max(1, Math.min(limit, items.length));
  const runners = Array.from({ length: size }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

type Task = { view: EntrySlot; model: string; variant: number; prompt: string };

// A view candidate goes to <subject>/<view>. A cleaned reference goes to <subject>/reference-clean.
function outputDirFor(subject: Subject, slot: EntrySlot): string {
  // Cleaned candidates go to the subject root, next to source.* and reference.*.
  return slot === 'reference' ? subject.dir : join(subject.dir, slot);
}

function buildTasks(
  subject: Subject,
  options: Options,
  selectedViews: Set<View>,
  variantStarts: Map<string, number>,
  template: PromptTemplate,
  subjectType: string,
): Task[] {
  const tasks: Task[] = [];
  for (const view of options.views) {
    if (selectedViews.has(view)) continue;
    const prompt = buildPrompt(template, view, {
      subjectType,
      style: options.style,
      subjectName: subject.id,
      referenceViews: options.referenceViews,
      notes: options.notes,
    });
    for (const model of options.models) {
      const start = variantStarts.get(`${view}/${model}`) ?? 1;
      for (let index = 0; index < options.variants; index += 1) {
        tasks.push({ view, model, variant: start + index, prompt });
      }
    }
  }
  return tasks;
}

// One reference image as the model receives it: raw bytes plus the media type.
type SourceImage = { bytes: Uint8Array; mimeType: string };

async function readSources(paths: Array<{ path: string; mimeType: string }>): Promise<SourceImage[]> {
  const sources: SourceImage[] = [];
  for (const item of paths) {
    sources.push({ bytes: new Uint8Array(await Bun.file(item.path).arrayBuffer()), mimeType: item.mimeType });
  }
  return sources;
}

function manifestFor(subject: Subject): Manifest {
  return {
    subject: relative(PROJECT_ROOT, subject.dir),
    reference: subject.reference
      ? { file: subject.reference.path.split('/').pop() ?? '', mimeType: subject.reference.mimeType, sha256: subject.reference.sha256 }
      : null,
    promptVersion: PROMPT_VERSION,
    modelParams: {},
    entries: [],
  };
}

// Size in pixels for an aspect ratio. Providers that reject aspectRatio need a concrete size.
function sizeForAspect(aspect: AspectRatio): `${number}x${number}` {
  const [width, height] = aspect.split(':').map(Number);
  if (width >= height) return `${Math.round((1024 * width) / height)}x1024` as `${number}x${number}`;
  return `1024x${Math.round((1024 * height) / width)}` as `${number}x${number}`;
}

function aspectRejected(warnings: ReadonlyArray<{ message?: string; feature?: string }> | undefined): boolean {
  if (!warnings) return false;
  return warnings.some((warning) => {
    const text = `${warning.feature ?? ''} ${warning.message ?? ''}`.toLowerCase();
    return text.includes('aspectratio');
  });
}

type ParamStyle = 'aspectRatio' | 'size' | 'none';

type GenerationOutcome = {
  entry: ManifestEntry;
  paramStyle: ParamStyle;
};

type ProducedImage = { mediaType: string; bytes: Uint8Array };

// Real output size. A provider that ignores the requested aspect ratio is visible here,
// and an unexpected canvas is usually why a multi-panel sheet gained a second row.
async function imageSize(bytes: Uint8Array): Promise<{ width?: number; height?: number }> {
  try {
    const meta = await new Bun.Image(bytes).metadata();
    return { width: meta.width, height: meta.height };
  } catch {
    return {};
  }
}

// Image models take the reference images in prompt.images, in the given order.
function callImageApi(task: Task, options: Options, sources: SourceImage[], style: ParamStyle) {
  const base = {
    model: task.model,
    prompt: { text: task.prompt, images: sources.map((source) => source.bytes) },
  };
  if (style === 'size') return generateImage({ ...base, size: sizeForAspect(options.aspect) });
  return generateImage({ ...base, aspectRatio: options.aspect });
}

// Language models that emit images take the references as file content parts,
// and return the generated image in result.files.
async function callLanguageApi(task: Task, sources: SourceImage[]): Promise<ProducedImage> {
  const result = await generateText({
    model: task.model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: task.prompt },
          ...sources.map((source) => ({
            type: 'file' as const,
            data: source.bytes,
            mediaType: source.mimeType,
          })),
        ],
      },
    ],
  });
  const image = result.files.find((file) => file.mediaType.startsWith('image/'));
  if (!image) {
    const hint = result.text ? ` Text answer: ${result.text.slice(0, 120)}` : '';
    throw new Error(`Model returned no image file.${hint}`);
  }
  return { mediaType: image.mediaType, bytes: image.uint8Array };
}

function mediaTypeRejected(warnings: ReadonlyArray<{ message?: string; feature?: string }> | undefined): boolean {
  if (!warnings) return false;
  return warnings.some((warning) => {
    const text = `${warning.feature ?? ''} ${warning.message ?? ''}`.toLowerCase();
    return text.includes('aspectratio');
  });
}

async function generateOne(
  outDir: string,
  task: Task,
  options: Options,
  price: number | null,
  api: ModelApi,
  preferredStyle: ParamStyle,
  sources: SourceImage[],
): Promise<GenerationOutcome> {
  const started = performance.now();

  const baseEntry = {
    view: task.view,
    model: task.model,
    variant: task.variant,
    promptVersion: PROMPT_VERSION,
    prompt: task.prompt,
    aspectRatio: options.aspect,
    api,
    createdAt: new Date().toISOString(),
    selected: false,
  };

  try {
    let image: ProducedImage;
    let style: ParamStyle = preferredStyle;

    if (api === 'image') {
      if (style === 'none') style = 'aspectRatio';
      const first = await callImageApi(task, options, sources, style);
      if (style === 'aspectRatio' && mediaTypeRejected(first.warnings)) {
        console.log(`       ${task.model} rejects aspectRatio, retrying with size ${sizeForAspect(options.aspect)}`);
        style = 'size';
        image = await callImageApi(task, options, sources, style).then((result) => ({
          mediaType: result.image.mediaType || 'image/png',
          bytes: result.image.uint8Array,
        }));
      } else {
        image = { mediaType: first.image.mediaType || 'image/png', bytes: first.image.uint8Array };
      }
    } else {
      style = 'none';
      image = await callLanguageApi(task, sources);
    }

    const extension = extensionForMime(image.mediaType);
    const name = `${kebabModelId(task.model)}--${String(task.variant).padStart(2, '0')}.${extension}`;
    await Bun.write(join(outDir, name), image.bytes);
    return {
      paramStyle: style,
      entry: {
        ...baseEntry,
        // A draft candidate and a cleaning candidate both live at their folder root.
        // A view candidate lives in its own view folder.
        file: task.view === 'draft' || task.view === 'reference' ? name : `${task.view}/${name}`,
        mediaType: image.mediaType,
        latencyMs: Math.round(performance.now() - started),
        status: 'generated',
        costEstimateUsd: price,
        bytes: image.bytes.length,
        ...(await imageSize(image.bytes)),
      } as ManifestEntry,
    };
  } catch (error) {
    return {
      paramStyle: preferredStyle,
      entry: {
        ...baseEntry,
        file: '',
        mediaType: '',
        latencyMs: Math.round(performance.now() - started),
        status: 'error',
        costEstimateUsd: null,
        error: String(error),
      } as ManifestEntry,
    };
  }
}

async function processSubject(
  subject: Subject,
  options: Options,
  prices: Map<string, number | null>,
  apis: Map<string, ModelApi>,
  template: PromptTemplate,
  subjectType: string,
): Promise<{ generated: number; failed: number; skipped: number }> {
  await ensureViewDirs(subject.dir, VIEWS);
  const existing = await readManifest(subject.dir);
  const manifest = existing ?? manifestFor(subject);
  manifest.promptVersion = PROMPT_VERSION;
  manifest.subject = relative(PROJECT_ROOT, subject.dir);
  manifest.subjectType = subjectType;
  manifest.style = options.style;
  manifest.referenceViews = options.referenceViews;
  manifest.template = options.template
    ? relative(PROJECT_ROOT, fromRoot(options.template))
    : 'scripts/blueprint-generate/prompts/blueprint.md';
  manifest.reference = {
    file: subject.reference.path.split('/').pop() ?? '',
    mimeType: subject.reference.mimeType,
    sha256: subject.reference.sha256,
  };

  if (existing && existing.reference && existing.reference.sha256 !== subject.reference.sha256) {
    console.warn(`  ! reference image changed since the last run; previous variants may not match`);
  }

  const selectedViews = new Set<View>();
  await markSelections(subject.dir, manifest);
  for (const view of VIEWS) {
    if (await isViewSelected(join(subject.dir, view))) selectedViews.add(view);
  }

  const variantStarts = new Map<string, number>();
  for (const view of options.views) {
    for (const model of options.models) {
      variantStarts.set(`${view}/${model}`, await nextVariant(join(subject.dir, view), model));
    }
  }

  const tasks = buildTasks(subject, options, selectedViews, variantStarts, template, subjectType);
  const skipped = selectedViews.size;
  const entriesBefore = manifest.entries.length;
  if (tasks.length === 0) {
    console.log(`  nothing to do: ${[...selectedViews].join(', ') || 'all views locked'}`);
    await writeManifest(subject.dir, manifest);
    return { generated: 0, failed: 0, skipped };
  }

  console.log(`  ${tasks.length} request(s): ${options.views.filter((view) => !selectedViews.has(view)).join(', ')}`);

  await runGeneration({
    outDirFor: (task) => outputDirFor(subject, task.view),
    manifest,
    tasks,
    options,
    prices,
    apis,
    sources: await readSources([subject.reference]),
  });

  await markSelections(subject.dir, manifest);
  await writeManifest(subject.dir, manifest);

  const runEntries = manifest.entries.slice(entriesBefore);
  const generated = runEntries.filter((entry) => entry.status === 'generated').length;
  const failed = runEntries.filter((entry) => entry.status === 'error').length;
  return { generated, failed, skipped };
}

type GenerationBatch = {
  // A batch can write to one folder (clean, draft) or to one folder per task (views).
  outDirFor: (task: Task) => string;
  manifest: Manifest;
  tasks: Task[];
  options: Options;
  prices: Map<string, number | null>;
  apis: Map<string, ModelApi>;
  sources: SourceImage[];
};

// Run a batch of requests. The first request of each model also learns how the provider
// wants the aspect ratio, so a provider that rejects aspectRatio costs one retry, not one per task.
async function runGeneration(batch: GenerationBatch): Promise<{ generated: number; failed: number }> {
  const { manifest, tasks, options, prices, apis, sources } = batch;
  const paramStyle = new Map<string, ParamStyle>();
  for (const [model, style] of Object.entries(manifest.modelParams ?? {})) paramStyle.set(model, style);

  const report = (outcome: GenerationOutcome, task: Task): void => {
    manifest.entries.push(outcome.entry);
    const label =
      task.view === 'draft'
        ? `${kebabModelId(task.model)}--${String(task.variant).padStart(2, '0')}`
        : `${task.view}/${kebabModelId(task.model)}--${String(task.variant).padStart(2, '0')}`;
    const { width, height } = outcome.entry;
    const size = width && height ? `  ${width}x${height}` : '';
    console.log(
      outcome.entry.status === 'generated'
        ? `  ok   ${label}  ${(outcome.entry.latencyMs / 1000).toFixed(1)}s  ${outcome.entry.bytes ?? 0} bytes${size}`
        : `  fail ${label}  ${outcome.entry.error?.split('\n')[0] ?? 'unknown error'}`,
    );
    // A provider that ignores the requested aspect can turn a panel row into a grid.
    if (width && height) {
      const requested = parseAspect(options.aspect);
      const [rw, rh] = requested.split(':').map(Number);
      const drift = Math.abs(width / height - rw / rh) / (rw / rh);
      if (drift > 0.05) {
        console.log(`       ${task.model} returned ${(width / height).toFixed(2)} instead of ${options.aspect}`);
      }
    }
  };

  const pending = [...tasks];
  for (const model of options.models) {
    if (paramStyle.has(model)) continue;
    const index = pending.findIndex((task) => task.model === model);
    if (index < 0) continue;
    const task = pending.splice(index, 1)[0];
    const outcome = await generateOne(
      batch.outDirFor(task),
      task,
      options,
      prices.get(model) ?? null,
      apis.get(model) ?? 'image',
      'aspectRatio',
      sources,
    );
    paramStyle.set(model, outcome.paramStyle);
    report(outcome, task);
  }

  await runPool(pending, options.concurrency, async (task) => {
    const outcome = await generateOne(
      batch.outDirFor(task),
      task,
      options,
      prices.get(task.model) ?? null,
      apis.get(task.model) ?? 'image',
      paramStyle.get(task.model) ?? 'size',
      sources,
    );
    report(outcome, task);
  });

  manifest.modelParams = Object.fromEntries(paramStyle);
  const generated = manifest.entries.slice(-tasks.length).filter((entry) => entry.status === 'generated').length;
  const failed = manifest.entries.slice(-tasks.length).filter((entry) => entry.status === 'error').length;
  return { generated, failed };
}


// Clean the chosen reference image. This pass isolates the subject on pure white.
// The reference is the raw material until this pass runs: it is backed up to source.<ext> first,
// so the original bytes are never lost. The art director then picks a candidate as the new
// reference.<ext> at the subject root.
async function cleanSubject(
  subject: Subject,
  options: Options,
  prices: Map<string, number | null>,
  apis: Map<string, ModelApi>,
  cleanTemplate: string,
  subjectType: string,
): Promise<{ generated: number; failed: number; skipped: boolean }> {
  const cleanDir = subject.dir;

  // The reference is the input. It is backed up to source.<ext> before anything is written,
  // so a later cleaning pass can always restart from the untouched identity image.
  let input = subject.source;
  if (!input) {
    const extension = subject.reference.path.split('.').pop() ?? 'webp';
    const backup = join(subject.dir, `source.${extension}`);
    if (!(await Bun.file(backup).exists())) {
      await Bun.write(backup, await Bun.file(subject.reference.path).arrayBuffer());
      console.log(`  backup: ${basename(subject.reference.path)} -> source.${extension}`);
    }
    input = { path: backup, mimeType: subject.reference.mimeType, sha256: subject.reference.sha256 };
  }

  const manifest = (await readManifest(subject.dir)) ?? manifestFor(subject);
  manifest.subject = relative(PROJECT_ROOT, subject.dir);
  manifest.subjectType = subjectType;
  manifest.cleanTemplate = options.cleanTemplate
    ? relative(PROJECT_ROOT, fromRoot(options.cleanTemplate))
    : 'scripts/blueprint-generate/prompts/clean.md';

  const prompt = buildCleanPrompt(cleanTemplate, {
    subjectType,
    subjectName: subject.id,
    defects: options.defects,
    edits: options.edits,
    panels: options.panels,
  });

  const tasks: Task[] = [];
  for (const model of options.models) {
    const start = await nextVariant(cleanDir, model);
    for (let index = 0; index < options.variants; index += 1) {
      tasks.push({ view: 'reference', model, variant: start + index, prompt });
    }
  }

  console.log(`  cleaning ${basename(input.path)}: ${tasks.length} request(s)`);
  console.log(`  defects: ${options.defects}`);
  console.log(`  panels:  ${options.panels}`);
  if (options.edits.length > 0) {
    for (const edit of options.edits) console.log(`  edit:    ${edit}`);
  } else {
    console.log('  edits:   none (the subject is not changed)');
  }

  const result = await runGeneration({
    outDirFor: () => cleanDir,
    manifest,
    tasks,
    options,
    prices,
    apis,
    sources: await readSources([input]),
  });

  await markSelections(subject.dir, manifest);
  await writeManifest(subject.dir, manifest);

  return { ...result, skipped: false };
}

// A draft is thin when the evidence cannot settle the subject on its own. The questions are
// deterministic and cheap: they name what is missing and what the art director can add. The image
// model never answers them, because a generation cannot ask a question in return.
function draftQuestions(draft: Draft, options: Options, notes: DraftNotes): string[] {
  const questions: string[] = [];
  const count = draft.subject.length;
  const details = options.specificSubjectDetails ?? notes.specificSubjectDetails;
  const styleNote = options.styleNote ?? notes.style;
  const note = options.subjectNote ?? notes.subject;

  if (count < 2) {
    questions.push(
      `Only ${count} subject image is present. Add a second image from an opposite side, or state ` +
        'the hidden sides in "specific subject details" so the model extrapolates them.',
    );
  }
  if (!note) {
    questions.push(
      'No subject note. Say what each subject image shows: the angle, the side, the camera height, ' +
        'and what is not visible. Write "## Subject" in notes.md or pass --subject-note.',
    );
  }
  if (!details) {
    questions.push(
      'No specific subject details. State what must survive and what is ambiguous: the identity ' +
        'features, a colour that a photo gets wrong, a part whose position is unclear. ' +
        'Write "## Specific subject details" in notes.md or pass --specific-subject-details.',
    );
  }
  if (draft.style.length === 0) {
    questions.push(
      `No style image. The run will render only "${options.style}". Add a style image, or accept ` +
        'the style written in words.',
    );
  } else if (!styleNote) {
    questions.push(
      'No style note. Say what the style image shows and what must NOT be copied from it: its ' +
        'subject, its colours, its markings. Write "## Style" in notes.md or pass --style-note.',
    );
  }
  if (options.poses.length < 2) {
    questions.push(
      'One panel requested. Two opposite three-quarter panels give the views stage more to work ' +
        'with. Pass --two-view, or --poses "a | b".',
    );
  }
  return questions;
}

// Stage 0: build one modeling reference image from a subject set and a style set.
// Images are attached in order: subject first, then style. The prompt states each role.
async function generateDraft(
  draft: Draft,
  options: Options,
  prices: Map<string, number | null>,
  apis: Map<string, ModelApi>,
  template: DraftTemplate,
  subjectType: string,
): Promise<{ generated: number; failed: number; skipped: boolean }> {
  const images = [...draft.subject, ...draft.style];
  const total = images.length;

  if (draft.subject.length === 0) {
    console.log(`  no subject image in ${DRAFT_DIR}/${draft.id}/subject/`);
    return { generated: 0, failed: 0, skipped: true };
  }
  if (total > options.maxImages) {
    console.log(
      `  ${total} reference images exceeds --max-images ${options.maxImages}. ` +
        `Keep the strongest subject images and the strongest style image.`,
    );
    return { generated: 0, failed: 0, skipped: true };
  }

  const prompt = buildDraftPrompt(template, {
    subjectType,
    subjectName: draft.id,
    style: options.style,
    poses: options.poses,
    aspect: options.aspect,
    subjectCount: draft.subject.length,
    styleCount: draft.style.length,
    subjectNote: options.subjectNote ?? draft.notes.subject,
    specificSubjectDetails: options.specificSubjectDetails ?? draft.notes.specificSubjectDetails,
    styleNote: options.styleNote ?? draft.notes.style,
  });

  const manifest = (await readManifest(draft.dir)) ?? {
    subject: relative(PROJECT_ROOT, draft.dir),
    reference: null,
    promptVersion: PROMPT_VERSION,
    modelParams: {},
    entries: [],
  };
  manifest.subject = relative(PROJECT_ROOT, draft.dir);
  manifest.subjectType = subjectType;
  manifest.style = options.style;
  manifest.pose = options.poses[0] ?? '';
  manifest.poses = options.poses;
  manifest.draftTemplate = relative(
    PROJECT_ROOT,
    options.draftTemplate ? fromRoot(options.draftTemplate) : DRAFT_TEMPLATE,
  );
  manifest.sources = images.map((image) => ({
    file: relative(draft.dir, image.path),
    sha256: image.sha256,
    role: image.path.includes('/style/') ? ('style' as const) : ('subject' as const),
  }));

  const tasks: Task[] = [];
  for (const model of options.models) {
    const start = await nextVariant(draft.dir, model);
    for (let index = 0; index < options.variants; index += 1) {
      tasks.push({ view: 'draft', model, variant: start + index, prompt });
    }
  }

  console.log(
    `  ${draft.subject.length} subject image(s), ${draft.style.length} style image(s): ${tasks.length} request(s)`,
  );

  const result = await runGeneration({
    outDirFor: () => draft.dir,
    manifest,
    tasks,
    options,
    prices,
    apis,
    sources: await readSources(images),
  });

  await writeManifest(draft.dir, manifest);
  return { ...result, skipped: false };
}

// Promote one draft candidate to the identity image of a subject folder.
// The copy is the art director's decision. This function only moves bytes.
async function promoteDraft(options: Options): Promise<void> {
  if (!options.draft || !options.file || !options.subject) {
    console.error('--promote needs --draft <dir> --file <candidate> --subject <dir>');
    process.exit(1);
  }
  const draftDir = fromRoot(options.draft);
  const candidate = join(draftDir, options.file);
  if (!(await Bun.file(candidate).exists())) {
    console.error(`Candidate not found: ${relative(PROJECT_ROOT, candidate)}`);
    process.exit(1);
  }
  const targetDir = fromRoot(options.subject);
  const extension = options.file.split('.').pop() ?? 'webp';
  const target = join(targetDir, `reference.${extension}`);
  if (await Bun.file(target).exists()) {
    console.error(`Already chosen: ${relative(PROJECT_ROOT, target)}. Remove it first.`);
    process.exit(1);
  }

  await mkdir(targetDir, { recursive: true });
  const bytes = await Bun.file(candidate).arrayBuffer();
  await Bun.write(target, bytes);
  const sha256 = await hashFile(target);

  const manifestPath = join(draftDir, 'manifest.json');
  if (await Bun.file(manifestPath).exists()) {
    const manifest = (await Bun.file(manifestPath).json()) as Manifest;
    manifest.promotions = manifest.promotions ?? [];
    manifest.promotions.push({
      file: options.file,
      target: relative(PROJECT_ROOT, target),
      sha256,
      at: new Date().toISOString(),
    });
    await writeManifest(draftDir, manifest);
  }

  console.log(`promoted ${relative(PROJECT_ROOT, candidate)}`);
  console.log(`      -> ${relative(PROJECT_ROOT, target)}  (${bytes.byteLength} bytes, sha256 ${sha256.slice(0, 16)})`);
  console.log('');
  console.log('Next step: generate the six views from that reference, or run --clean first');
  console.log('if the subject is not isolated on a uniform white field.');
}

async function main(): Promise<void> {
  const options = readOptions(Bun.argv.slice(2));

  if (options.listModels) {
    const catalog = await fetchCatalog();
    console.log(formatCapabilityTable(listUsableModels(catalog)));
    return;
  }

  if (options.promote) {
    await promoteDraft(options);
    return;
  }

  if (!options.subject && !options.all && !options.draft) {
    console.error(usage());
    process.exit(1);
  }
  if (options.models.length === 0) {
    console.error(
      'Missing model. Pass --models <id>, or set DEFAULT_GENERATION_MODEL in .env.local.\n' +
        'Use --list-models to see compatible models.',
    );
    process.exit(1);
  }
  if (!Number.isInteger(options.variants) || options.variants < 1) {
    console.error('--variants must be a positive integer');
    process.exit(1);
  }

  const template = options.draft
    ? null
    : await loadTemplate(options.template ? fromRoot(options.template) : undefined);
  const cleanTemplate =
    options.clean && !options.draft
      ? await loadCleanTemplate(options.cleanTemplate ? fromRoot(options.cleanTemplate) : undefined)
      : null;
  // One template serves one panel and several panels. An explicit --draft-template wins.
  const draftTemplatePath = options.draftTemplate ? fromRoot(options.draftTemplate) : DRAFT_TEMPLATE;
  const draftTemplate = options.draft ? await loadDraftTemplate(draftTemplatePath) : null;

  const catalog = await fetchCatalog();
  const capabilities = resolveModels(catalog, options.models);
  const unusable = capabilities.filter((model) => !model.usable);
  if (unusable.length > 0) {
    console.error(formatCapabilityTable(capabilities));
    console.error('\nRemove the unusable models. A reference image is required for every generation.');
    process.exit(1);
  }
  const prices = new Map(capabilities.map((model) => [model.id, model.pricePerImageUsd]));
  const apis = new Map(capabilities.map((model) => [model.id, model.api ?? 'image']));

  // Stage 0: the draft stage reads blueprints/drafts/<name>/ and writes one folder.
  if (options.draft && draftTemplate) {
    const draftDir = fromRoot(options.draft);
    const draft = await loadDraft(draftDir);

    // --ask never spends. It prints what the evidence cannot settle and stops there, so the art
    // director can fill the gap in notes.md instead of paying for a guess.
    if (options.ask) {
      const questions = draftQuestions(draft, options, draft.notes);
      if (questions.length === 0) {
        console.log('ask:        no gap found. The material is complete enough to generate.');
        console.log('Next step: rerun without --ask.');
      } else {
        console.log(`ask:        ${questions.length} gap(s) in the reference material`);
        questions.forEach((question, index) => console.log(`  ${index + 1}. ${question}`));
        console.log('');
        console.log('No request was sent and nothing was spent.');
      }
      return;
    }

    const type = options.subjectType ?? 'subject';
    const planned = options.variants * options.models.length;
    let estimate = 0;
    for (const model of options.models) {
      const price = prices.get(model) ?? null;
      if (price !== null) estimate += price * options.variants;
    }

    console.log(`mode:       draft reference`);
    console.log(`template:   ${relative(PROJECT_ROOT, draftTemplatePath)}`);
    console.log(`type:       ${type}${options.subjectType ? '' : '  (default: pass --subject-type for a better noun)'}`);
    console.log(`style:      ${options.style}`);
    console.log(`panels:     ${options.poses.length}`);
    options.poses.forEach((pose, index) => console.log(`  ${index + 1}.        ${pose}`));
    console.log(`models:     ${options.models.join(', ')}`);
    console.log(`draft:      ${relative(PROJECT_ROOT, draftDir)}`);
    console.log(`images:     ${draft.subject.length} subject, ${draft.style.length} style`);
    console.log(`variants:   ${options.variants} per model`);
    console.log(`planned:    ${planned} request(s)`);
    if (estimate > 0) console.log(`estimate:   $${estimate.toFixed(2)}`);
    console.log('');

    // The gateway spend report needs a paid plan. Measure it when it answers, and fall back
    // to the catalog price per image when it does not, so a run always ends with a figure.
    const spendBefore = await spendByModel().catch(() => new Map<string, number>());
    const started = performance.now();
    const result = await generateDraft(draft, options, prices, apis, draftTemplate, type);
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    const spendAfter = await spendByModel().catch(() => new Map<string, number>());

    const measured: Array<{ model: string; usd: number }> = [];
    for (const model of options.models) {
      const delta = spendDelta(spendBefore, spendAfter, model);
      if (delta !== null && delta > 0) measured.push({ model, usd: delta });
    }

    console.log('');
    console.log(`done in ${seconds}s`);
    console.log(`  candidates: ${result.generated}`);
    if (result.failed > 0) console.log(`  failed entries: ${result.failed}`);

    if (measured.length > 0) {
      const total = measured.reduce((sum, row) => sum + row.usd, 0);
      for (const row of measured) console.log(`  cost       ${row.model}  $${row.usd.toFixed(4)}`);
      console.log(`  cost       total  $${total.toFixed(4)}  (measured by the gateway)`);
      const manifest = await readManifest(draftDir);
      if (manifest) {
        manifest.costUsd = measured;
        await writeManifest(draftDir, manifest);
      }
    } else {
      // Catalog fallback: the exact price per image when the catalog declares one. A model priced
      // by tokens instead has no per-image figure, and the manifest keeps the measured report only.
      // The count is per model: result.generated covers every model of the run.
      const produced = new Map<string, number>();
      const runManifest = await readManifest(draftDir);
      for (const entry of runManifest?.entries ?? []) {
        produced.set(entry.model, (produced.get(entry.model) ?? 0) + 1);
      }
      for (const model of options.models) {
        const price = prices.get(model) ?? null;
        const count = produced.get(model) ?? 0;
        if (price === null) {
          console.log(`  cost       ${model}  price per image not declared by the catalog`);
        } else {
          console.log(`  cost       ${model}  ~$${(price * count).toFixed(4)} for ${count} image(s)`);
        }
      }
      console.log('  cost       estimate only: the gateway spend report needs a paid plan');
      if (runManifest) {
        runManifest.costUsd = options.models.flatMap((model) => {
          const price = prices.get(model) ?? null;
          const count = produced.get(model) ?? 0;
          return price === null || count === 0 ? [] : [{ model, usd: price * count, estimated: true }];
        });
        await writeManifest(draftDir, runManifest);
      }
    }
    console.log('');
    console.log('Next step: the art director promotes one candidate:');
    console.log(
      `  bun run blueprint-generate.ts --promote --draft ${options.draft} --file <candidate> --subject blueprints/<category>/<subject>`,
    );

    if (result.generated === 0) process.exit(1);
    return;
  }

  const subjectDirs = options.all
    ? await findSubjects(BLUEPRINTS_ROOT, { requireChosen: !options.clean })
    : [fromRoot(options.subject as string)];
  if (subjectDirs.length === 0) {
    console.error(
      options.clean
        ? `No subject folder with a source or reference image was found under blueprints/ (${DRAFT_DIR}/ is skipped).`
        : `No subject folder with a chosen reference image was found under blueprints/ (${DRAFT_DIR}/ is skipped).`,
    );
    process.exit(1);
  }

  const subjects: Subject[] = [];
  for (const dir of subjectDirs) subjects.push(await loadSubject(dir));

  const started = performance.now();
  let generated = 0;
  let failed = 0;
  let skipped = 0;

  if (cleanTemplate) {
    const planned = options.variants * options.models.length * subjects.length;
    let estimate = 0;
    for (const model of options.models) {
      const price = prices.get(model) ?? null;
      if (price !== null) estimate += price * options.variants * subjects.length;
    }
    console.log(`mode:       reference cleaning`);
    console.log(`template:   ${options.cleanTemplate ?? 'scripts/blueprint-generate/prompts/clean.md'}`);
    console.log(`models:     ${options.models.join(', ')}`);
    console.log(`subjects:   ${subjects.length}`);
    console.log(`variants:   ${options.variants} per model`);
    console.log(`planned:    ${planned} request(s)`);
    if (estimate > 0) console.log(`estimate:   $${estimate.toFixed(2)}`);
    console.log('');

    for (const subject of subjects) {
      const type = options.subjectType ?? subjectTypeForCategory(subject.category);
      console.log(`${subject.category}/${subject.id}  (${type})`);
      const result = await cleanSubject(subject, options, prices, apis, cleanTemplate, type);
      generated += result.generated;
      failed += result.failed;
      if (result.skipped) skipped += 1;
      console.log('');
    }

    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    console.log(`done in ${seconds}s`);
    console.log(`  cleaned candidates: ${generated}`);
    if (skipped > 0) console.log(`  already locked, skipped: ${skipped}`);
    if (failed > 0) console.log(`  failed entries: ${failed}`);
    console.log('');
    console.log('Next step: review the candidates at the subject root.');
    console.log('Copy the chosen file to reference.<ext> at the subject root.');
    console.log('View generation then uses that file as the identity source.');

    if (generated === 0 && failed > 0) process.exit(1);
    return;
  }

  const plannedViews = options.views.length * options.models.length * options.variants;
  const plannedCalls = plannedViews * subjects.length;
  let estimate = 0;
  let priced = 0;
  for (const subject of subjects) {
    for (const view of options.views) {
      for (const model of options.models) {
        const price = prices.get(model) ?? null;
        if (price !== null) {
          estimate += price * options.variants;
          priced += options.variants;
        }
      }
    }
  }

  if (!template) throw new Error('View prompt template missing');
  console.log(`template:   ${options.template ?? 'scripts/blueprint-generate/prompts/blueprint.md'}`);
  console.log(`style:      ${options.style}`);
  console.log(`models:     ${options.models.join(', ')}`);
  console.log(`subjects:   ${subjects.length}`);
  console.log(`views:      ${options.views.join(', ')}`);
  console.log(`variants:   ${options.variants} per view and per model`);
  console.log(`planned:    ${plannedCalls} request(s)`);
  if (priced > 0) {
    console.log(`estimate:   $${estimate.toFixed(2)} for ${priced} priced request(s)`);
  }
  console.log('');

  for (const subject of subjects) {
    const type = options.subjectType ?? subjectTypeForCategory(subject.category);
    console.log(`${subject.category}/${subject.id}  (${type}, ${options.style}, source reference.*)`);
    const result = await processSubject(subject, options, prices, apis, template, type);
    generated += result.generated;
    failed += result.failed;
    skipped += result.skipped;
    console.log('');
  }

  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(`done in ${seconds}s`);
  console.log(`  generated entries: ${generated}`);
  if (skipped > 0) console.log(`  locked views skipped: ${skipped}`);
  if (failed > 0) console.log(`  failed entries: ${failed}`);
  console.log('');
  console.log('Next step: the art director copies the chosen variant to <view>/reference.<ext>.');
  console.log('That copy locks the view for later runs.');

  if (generated === 0 && failed > 0) process.exit(1);
}

await main();
