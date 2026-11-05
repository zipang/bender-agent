// Prompt template loading and rendering.
//
// The template lives in prompts/blueprint.md so it can be tuned without a code change.
// Sections use the form "[name]" and the body runs until the next section.

import { join } from 'node:path';

export const VIEWS = ['front', 'left', 'back', 'right', 'top', 'bottom'] as const;
export type View = (typeof VIEWS)[number];

export const DEFAULT_TEMPLATE = join(import.meta.dir, '..', 'prompts', 'blueprint.md');
export const CLEAN_TEMPLATE = join(import.meta.dir, '..', 'prompts', 'clean.md');
export const DRAFT_TEMPLATE = join(import.meta.dir, '..', 'prompts', 'draft.md');

export type PromptContext = {
  subjectType: string;
  style: string;
  subjectName: string;
  // The viewpoints the reference image holds, in panel order. Empty when unknown.
  // A two-panel reference must be read as two panels, or the model reproduces both in every view.
  referenceViews: string[];
  // Notes from the art director for this run. Empty when none.
  notes: string[];
};

export type PromptTemplate = {
  shared: string;
  views: Record<View, string>;
};

// A template is a list of named sections. "shared" is required.
export function parseSections(source: string): Map<string, string> {
  const sections = new Map<string, string[]>();
  let current: string | null = null;
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trimEnd();
    if (line.trimStart().startsWith('#')) continue;
    const header = line.match(/^\[([a-zA-Z0-9_-]+)\]\s*$/);
    if (header) {
      current = header[1].toLowerCase();
      sections.set(current, []);
      continue;
    }
    if (current) sections.get(current)?.push(line);
  }
  return new Map([...sections].map(([name, lines]) => [name, lines.join('\n').trim()]));
}

export function parseTemplate(source: string): PromptTemplate {
  const sections = new Map<string, string[]>();
  let current: string | null = null;
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trimEnd();
    if (line.trimStart().startsWith('#')) continue;
    const header = line.match(/^\[([a-zA-Z0-9_-]+)\]\s*$/);
    if (header) {
      current = header[1].toLowerCase();
      sections.set(current, []);
      continue;
    }
    if (current) sections.get(current)?.push(line);
  }

  const body = (name: string): string => (sections.get(name) ?? []).join('\n').trim();
  const shared = body('shared');
  if (!shared) throw new Error('Prompt template has no [shared] section');

  const views = {} as Record<View, string>;
  for (const view of VIEWS) {
    const text = body(view);
    if (!text) throw new Error(`Prompt template has no [${view}] section`);
    views[view] = text;
  }
  return { shared, views };
}

export async function loadTemplate(path = DEFAULT_TEMPLATE): Promise<PromptTemplate> {
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`Prompt template not found: ${path}`);
  return parseTemplate(await file.text());
}

function apply(text: string, values: Record<string, string>): string {
  return text.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (match, key: string) => {
    const value = values[key];
    if (value === undefined) throw new Error(`Unknown placeholder ${match} in the prompt template`);
    return value;
  });
}

// "a front three-quarter view from the left" + "a rear three-quarter view from the right"
// -> "two viewpoints side by side: a front three-quarter view from the left, and a rear ..."
function joinChoice(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]}, and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

const VIEW_COUNT_WORD = ['one', 'two', 'three', 'four', 'five', 'six'];

// The reference sheet may hold several panels. Say so, and say which panel serves which view.
// Without this paragraph the model tends to reproduce every panel side by side in every view.
function referenceViewsBlock(views: string[]): string {
  if (views.length === 0) {
    return (
      'The attached reference image is the identity source: it shows this {subject} from one ' +
      'viewpoint. Reproduce one single view, and do not add a second panel.'
    );
  }
  if (views.length === 1) {
    return (
      `The attached reference image is the identity source: it shows this {subject} seen from ` +
      `${views[0]}. It holds one single panel. Reproduce one single view, and do not add a ` +
      'second panel.'
    );
  }
  const count = VIEW_COUNT_WORD[views.length - 1] ?? String(views.length);
  return [
    `The attached reference image is the identity source. It shows this {subject} seen from ${count} viewpoints side by side:`,
    ...views.map((view, index) => `  ${index + 1}. ${view}.`),
    '',
    `Each panel shows the same single {subject} from one of those viewpoints. For the {view} view,`,
    'use only the panel whose viewpoint matches this view, and ignore every other panel.',
    'The result is ONE single view: do not reproduce two or more panels side by side in the output,',
    'do not draw a divider or a frame, and do not merge two panels into one shape. When no panel',
    'shows this view, extrapolate it from the nearest panel, and keep the same proportions.',
  ].join('\n');
}

// Instructions from the art director for this run. They are ordered last, so they are read after
// the general rules, and they win over an extrapolation the model would otherwise invent.
function notesBlock(notes: string[]): string {
  if (notes.length === 0) return 'No extra instruction for this view.';
  if (notes.length === 1) return `Extra instruction for this view: ${notes[0]}.`;
  return ['Extra instructions for this view:', ...notes.map((note) => `- ${note}.`)].join('\n');
}

export function buildPrompt(
  template: PromptTemplate,
  view: View,
  context: PromptContext,
): string {
  // The block carries its own {subject} and {view} placeholders. Render it first: apply() does not
  // rescan the text it has just inserted.
  const referenceViewsBlockText = apply(referenceViewsBlock(context.referenceViews), {
    subject: subjectNoun(context.subjectType),
    view,
  });
  const values = {
    subjectType: context.subjectType,
    style: context.style,
    view,
    subjectName: context.subjectName,
    referenceViewsBlock: referenceViewsBlockText,
    notesBlock: notesBlock(context.notes),
  };
  return `${apply(template.shared, values)}\n\n${apply(template.views[view], values)}`;
}

// Clean template: one [shared] section. The defects come from --defects.
export async function loadCleanTemplate(path = CLEAN_TEMPLATE): Promise<string> {
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`Clean template not found: ${path}`);
  const shared = parseSections(await file.text()).get('shared');
  if (!shared) throw new Error(`Clean template has no [shared] section: ${path}`);
  return shared;
}

// Draft template: one [shared] body, plus the style paragraph to use when style images exist.
// The two style variants are separate sections so an empty set never leaves a dangling sentence.
export type DraftTemplate = {
  shared: string;
  styleImages: string;
  noStyleImages: string;
};

export async function loadDraftTemplate(path = DRAFT_TEMPLATE): Promise<DraftTemplate> {
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`Draft prompt template not found: ${path}`);
  const sections = parseSections(await file.text());
  const shared = sections.get('shared');
  const styleImages = sections.get('style');
  const noStyleImages = sections.get('no-style');
  if (!shared) throw new Error(`Draft template has no [shared] section: ${path}`);
  if (!styleImages) throw new Error(`Draft template has no [style] section: ${path}`);
  if (!noStyleImages) throw new Error(`Draft template has no [no-style] section: ${path}`);
  return { shared, styleImages, noStyleImages };
}

export type DraftPromptContext = {
  subjectType: string;
  subjectName: string;
  style: string;
  // One pose per panel. One pose gives a single view, several give a panel row.
  poses: string[];
  // Frame ratio, as "16:9". Spoken in the prompt because a text-only image model
  // receives no size and no aspectRatio parameter.
  aspect: string;
  subjectCount: number;
  styleCount: number;
  // The art director describes the reference material: what the images are, what they show,
  // what they leave out. Free prose, no structure.
  subjectNote: string;
  // The art director states what must survive and how to read an ambiguous image: the identity
  // features, a marking, a specific part, a correction to a wrong colour. This field is the
  // strongest rule in the prompt, so it beats every image when they disagree.
  specificSubjectDetails: string;
  styleNote: string;
};

const NUMBER_WORD = ['one', 'two', 'three', 'four', 'five', 'six'];

// "This single image must show two different sides of the same subject, including opposite ones."
function panelIntroText(count: number): string {
  if (count === 1) return 'This single image shows the subject from one clear, informative angle.';
  const word = NUMBER_WORD[count - 1] ?? String(count);
  if (count === 2)
    return (
      'This single image must show TWO DIFFERENT SIDES of the same subject, and they must be ' +
      'opposite sides: a front and a back, or a left and a right.'
    );
  return (
    `This single image must show ${word.toUpperCase()} DIFFERENT SIDES of the same subject. ` +
    'At least two of them must be opposite sides. Together they must cover as much of the ' +
    'subject as possible, so that the shapes hidden from one angle are seen from another.'
  );
}
// "Two equal panels side by side: a left panel and a right panel."
function layoutText(count: number): string {
  if (count === 1) return 'One single panel: no split, no grid, no inset.';
  if (count === 2)
    return (
      'Two equal panels side by side: a left panel and a right panel. No divider line: ' +
      'the white field alone separates them.'
    );
  if (count === 3)
    return (
      'Three equal panels side by side: a left panel, a centre panel, and a right panel. ' +
      'No divider line: the white field alone separates them.'
    );
  return (
    `${NUMBER_WORD[count - 1] ?? count} equal panels side by side, from left to right. ` +
    'No divider line: the white field alone separates them.'
  );
}

// Panel names must agree with the requested count. A two-panel row has a left and a right panel,
// never a centre panel: a stray "Centre" makes the model draw three.
function panelNames(count: number): string[] {
  if (count === 2) return ['Left', 'Right'];
  if (count === 3) return ['Left', 'Centre', 'Right'];
  return Array.from({ length: count }, (_, index) => `Panel ${index + 1}`);
}

function panelListText(poses: string[]): string {
  if (poses.length === 1) return `View: ${poses[0]}.`;
  const names = panelNames(poses.length);
  return poses
    .map((pose, index) => `- ${names[index]} panel: ${pose}.`)
    .join('\n');
}

// The panel count is the most common failure of a multi-panel image: a model fills a grid,
// repeats an angle, or adds a bonus thumbnail to occupy empty space.
function panelRulesText(count: number): string {
  if (count === 1) {
    return (
      'Draw exactly one view. Do not add a second view, a detail shot, a thumbnail, or a grid.\n' +
      'Do not draw a divider line, a frame, a border, a caption, or a label.'
    );
  }
  const countWord = count === 2 ? 'Both' : `All ${count}`;
  return [
    `The panel count is exact: exactly ${count} panels, and no more. Use one single row.`,
    'Do not add a second row. Do not stack the panels in a grid. Do not repeat an angle that is',
    'already there. Do not add a thumbnail, a detail shot, or a bonus angle to fill empty space.',
    'If the frame has unused space, leave it white.',
    '',
    `${countWord} panels show ONE single {subject}, drawn ${count} times, not ${count} similar`,
    'subjects. Every panel shares the same parts, the same proportions, the same colours, the same',
    'markings, the same materials, the same scale, the same camera distance, and the same',
    'lighting. Only the viewing angle differs. No panel is a mirror of another unless the',
    '{subject} is truly symmetric, and no two panels repeat the same angle.',
  ].join('\n');
}

function orientationText(aspect: string): string {
  const [width, height] = aspect.split(':').map(Number);
  if (!width || !height) return 'landscape';
  if (width > height) return 'landscape';
  if (width < height) return 'portrait';
  return 'square';
}

export function buildDraftPrompt(template: DraftTemplate, context: DraftPromptContext): string {
  const styleFirst = context.subjectCount + 1;
  // "Image 4" reads better than "Images 4 to 4" when a set holds one file.
  const range = (first: number, last: number): string =>
    first === last ? `Image ${first}` : `Images ${first} to ${last}`;
  const styleRange = range(styleFirst, context.subjectCount + context.styleCount);
  const panelCount = context.poses.length;
  const values = {
    subject: subjectNoun(context.subjectType),
    subjectType: context.subjectType,
    subjectName: context.subjectName,
    style: context.style,
    pose: context.poses[0] ?? '',
    aspect: context.aspect,
    orientation: orientationText(context.aspect),
    panelCount: String(panelCount),
    panelIntro: panelIntroText(panelCount),
    panelLayout: layoutText(panelCount),
    panelList: panelListText(context.poses),
    panelRules: apply(panelRulesText(panelCount), {
      subject: subjectNoun(context.subjectType),
    }),
    subjectCount: String(context.subjectCount),
    subjectRange: range(1, context.subjectCount),
    styleCount: String(context.styleCount),
    styleFirst: String(styleFirst),
    styleRange,
    imageCount: String(context.subjectCount + context.styleCount),
    subjectNote: context.subjectNote || 'none',
    specificSubjectDetails: context.specificSubjectDetails || 'none given: read the images and keep what they agree on',
    styleNote: context.styleNote || 'none',
  };
  const styleBlock = apply(
    context.styleCount > 0 ? template.styleImages : template.noStyleImages,
    values,
  );
  return apply(template.shared, { ...values, styleBlock });
}

// Readable English noun for the subject, used in the cleaning prompt and the draft prompt.
// An unknown type falls back to "subject", never to a category guess such as "object".
const SUBJECT_NOUN: Record<string, string> = {
  vehicule: 'vehicle',
  character: 'character',
  object: 'object',
};

export function subjectNoun(subjectType: string): string {
  return SUBJECT_NOUN[subjectType.toLowerCase()] ?? 'subject';
}

export function buildCleanPrompt(
  template: string,
  context: {
    subjectType: string;
    subjectName: string;
    defects: string;
    // Authorized content changes: erase a logo, blank a plate, close a window.
    // Empty means the pass must not touch the subject at all.
    edits: string[];
    // Number of panels in the reference image. A two-panel reference must stay two-panel.
    panels: number;
  },
): string {
  return apply(template, {
    subject: subjectNoun(context.subjectType),
    subjectType: context.subjectType,
    subjectName: context.subjectName,
    defects: context.defects,
    editsBlock: editsText(context.edits),
    panelNote: panelNoteText(context.panels),
  });
}

// One bullet per authorized edit. An empty list is stated, not left blank: a dangling "if any:"
// invites the model to invent a change.
function editsText(edits: string[]): string {
  if (edits.length === 0) return '   None. Change nothing about the subject itself.';
  return edits.map((edit) => `   - ${edit}`).join('\n');
}

// A two-panel reference must not collapse into one panel, and a one-panel reference must not grow
// a second view. The repair pass is the easiest place to lose that, because it re-renders freely.
function panelNoteText(panels: number): string {
  if (panels <= 1) {
    return (
      'The image holds one single view of the subject. Keep exactly one view: do not add a second ' +
      'angle, a detail shot, a thumbnail, or a grid.'
    );
  }
  const list =
    panels === 2
      ? 'a left panel and a right panel'
      : `panels ${Array.from({ length: panels }, (_, i) => i + 1).join(', ')} side by side`;
  return (
    `The image holds ${panels} panels side by side: ${list}. Keep every panel, in the same order, ` +
    'at the same position, at the same scale, and from the same viewing angle. Do not merge them, ' +
    'do not drop one, do not add one, and do not change a panel into another angle. Apply every ' +
    'instruction below to every panel, so all panels still show the same single subject.'
  );
}

export function isView(value: string): value is View {
  return (VIEWS as readonly string[]).includes(value);
}

export function parseViews(raw: string): View[] {
  if (raw.trim() === '' || raw.trim() === 'all') return [...VIEWS];
  const parsed = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const invalid = parsed.filter((item) => !isView(item));
  if (invalid.length > 0) {
    throw new Error(`Unknown view: ${invalid.join(', ')}. Valid views: ${VIEWS.join(', ')}`);
  }
  return parsed as View[];
}

// Folder name to subject type. An unknown category stays a plain "subject": a category guess such
// as "object" would put the wrong noun into the prompt of a character or a vehicle.
const SUBJECT_TYPE_BY_CATEGORY: Record<string, string> = {
  vehicules: 'vehicule',
  vehicles: 'vehicule',
  characters: 'character',
  objects: 'object',
  props: 'object',
};

export function subjectTypeForCategory(category: string): string {
  return SUBJECT_TYPE_BY_CATEGORY[category.toLowerCase()] ?? 'subject';
}
