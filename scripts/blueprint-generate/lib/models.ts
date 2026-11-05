// Blueprint model catalog access and capability filtering.
//
// The AI Gateway catalog distinguishes two kinds of image producers:
//   type "image"    -> called with generateImage(); image input goes in prompt.images
//   type "language" -> called with generateText(); image input is a file content part,
//                      and the result image arrives in result.files
//
// A model that produces images but declares text-only input cannot preserve a subject.

export type CatalogModel = {
  id: string;
  name?: string;
  type?: string;
  tags?: string[];
  modalities?: { input?: string[]; output?: string[] };
  pricing?: { image?: string };
};

export type ModelApi = 'image' | 'language';

export type ModelCapability = {
  id: string;
  usable: boolean;
  api: ModelApi | null;
  reason: string;
  acceptsImageInput: boolean;
  producesImageOutput: boolean;
  pricePerImageUsd: number | null;
};

export const CATALOG_URL =
  process.env.AI_GATEWAY_MODELS_URL ?? 'https://ai-gateway.vercel.sh/v1/models';

// Tools that emit vector formats are not usable as raster view generators.
const VECTOR_ONLY_MODELS = ['quiverai/arrow-2', 'quiverai/arrow-2-telos'];

export async function fetchCatalog(): Promise<CatalogModel[]> {
  const response = await fetch(CATALOG_URL);
  if (!response.ok) throw new Error(`Model catalog request failed: ${response.status}`);
  const payload = (await response.json()) as { data?: CatalogModel[] };
  return payload.data ?? [];
}

export function inspectModel(model: CatalogModel): ModelCapability {
  const input = model.modalities?.input ?? [];
  const output = model.modalities?.output ?? [];
  const acceptsImageInput = input.includes('image');
  const producesImageOutput = output.includes('image');
  const price = model.pricing?.image ? Number(model.pricing.image) : null;
  const api: ModelApi = model.type === 'image' ? 'image' : 'language';

  const reject = (reason: string): ModelCapability => ({
    id: model.id,
    usable: false,
    api: null,
    reason,
    acceptsImageInput,
    producesImageOutput,
    pricePerImageUsd: price,
  });

  if (VECTOR_ONLY_MODELS.includes(model.id)) return reject('vector output, not raster');
  if (!producesImageOutput) return reject('does not produce image output');
  if (!acceptsImageInput) return reject('does not accept reference image input');

  return {
    id: model.id,
    usable: true,
    api,
    reason: api === 'image' ? 'image API, image input' : 'language API, image input, image output',
    acceptsImageInput,
    producesImageOutput,
    pricePerImageUsd: price,
  };
}

export function resolveModels(catalog: CatalogModel[], requested: string[]): ModelCapability[] {
  const byId = new Map(catalog.map((model) => [model.id, model]));
  return requested.map((id) => {
    const model = byId.get(id);
    if (!model) {
      return {
        id,
        usable: false,
        api: null,
        reason: 'not present in the current catalog',
        acceptsImageInput: false,
        producesImageOutput: false,
        pricePerImageUsd: null,
      } satisfies ModelCapability;
    }
    return inspectModel(model);
  });
}

export function listUsableModels(catalog: CatalogModel[]): ModelCapability[] {
  return catalog
    .map(inspectModel)
    .filter((model) => model.usable)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function formatCapabilityTable(models: ModelCapability[]): string {
  const header = 'model                                     api       price/img  status';
  const rows = models.map((model) => {
    const api = (model.api ?? '-').padEnd(8);
    const price =
      model.pricePerImageUsd === null ? '   n/a  ' : `$${model.pricePerImageUsd.toFixed(3)}`.padStart(8);
    const status = model.usable ? 'usable' : `unusable: ${model.reason}`;
    return `${model.id.padEnd(40)} ${api} ${price}  ${status}`;
  });
  return [header, ...rows].join('\n');
}
