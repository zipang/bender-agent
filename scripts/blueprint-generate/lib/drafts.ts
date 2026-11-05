// Stage 0 discovery: the draft (research) folder.
//
// A draft is not a subject yet. It holds the two kinds of reference image that the art director
// collected before any generation:
//
//   subject/   what to model. One or more images of the same object.
//   style/     how to render it. One or more images of the wanted visual treatment.
//
// The draft generator combines them into one modeling reference image on a pure white field.
// That image is promoted to reference.<ext> of a subject folder when the art director chooses it.

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { hashFile, mimeForExtension, type ReferenceFile } from './subjects';

export const SUBJECT_DIR = 'subject';
export const STYLE_DIR = 'style';

// Raster formats a provider can read back as a reference. The generator never converts them.
export const IMAGE_EXTENSIONS = ['png', 'webp', 'jpg', 'jpeg'];

export type DraftImage = ReferenceFile & { name: string };

export type DraftNotes = {
  subject: string;
  specificSubjectDetails: string;
  style: string;
};

export type Draft = {
  dir: string;
  id: string;
  subject: DraftImage[];
  style: DraftImage[];
  notes: DraftNotes;
};

function isImage(name: string): boolean {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.includes(extension);
}

// Directory listing in name order. The order is the order the model sees the images,
// so a numeric prefix in the file name is the only way to control it.
export async function listImages(dir: string): Promise<DraftImage[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const images: DraftImage[] = [];
  for (const name of entries.sort()) {
    if (!isImage(name)) continue;
    const path = join(dir, name);
    const extension = name.split('.').pop() ?? 'png';
    images.push({
      path,
      name,
      mimeType: mimeForExtension(extension),
      sha256: await hashFile(path),
    });
  }
  return images;
}

// notes.md may describe the subject, the details to keep, and the style under "## Subject",
// "## Specific subject details" (or the older "## Details"), and "## Style". Any other heading
// is ignored, so the file stays readable. A "##" line that names no known section closes the
// current one, so prose after an unknown heading never leaks into the previous section.
export function parseNotes(text: string): DraftNotes {
  const notes: DraftNotes = { subject: '', specificSubjectDetails: '', style: '' };
  let current: keyof DraftNotes | null = null;
  for (const line of text.split('\n')) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      const title = heading[1].toLowerCase();
      current = /^sujet|^subject/.test(title)
        ? 'subject'
        : /^(specific\s+)?(subject\s+)?details?|^d[ée]tails?/.test(title)
          ? 'specificSubjectDetails'
          : /^style/.test(title)
            ? 'style'
            : null;
      continue;
    }
    if (current) notes[current] += `${line}\n`;
  }
  return {
    subject: notes.subject.trim(),
    specificSubjectDetails: notes.specificSubjectDetails.trim(),
    style: notes.style.trim(),
  };
}

export function createDraft(dir: string): Draft {
  const parts = dir.replaceAll('\\', '/').replace(/\/$/, '').split('/');
  return {
    dir,
    id: parts.at(-1) ?? dir,
    subject: [],
    style: [],
    notes: { subject: '', specificSubjectDetails: '', style: '' },
  };
}

export async function loadDraft(dir: string): Promise<Draft> {
  const draft = createDraft(dir);
  draft.subject = await listImages(join(dir, SUBJECT_DIR));
  draft.style = await listImages(join(dir, STYLE_DIR));
  const notesFile = Bun.file(join(dir, 'notes.md'));
  if (await notesFile.exists()) draft.notes = parseNotes(await notesFile.text());
  return draft;
}
