/**
 * Centralised validation rules for image conversion.
 * Used by both the standalone converter dropzone and the
 * piece upload pipeline to give consistent error messages.
 */

export interface ValidationOptions {
  /** Maximum file size in bytes. Default 25 MB. */
  maxSizeBytes?: number;
  /** Minimum dimension (longest side) in px. Default 200. */
  minDimension?: number;
}

export interface ValidationError {
  file: File;
  reason: string;
}

export interface ValidationResult {
  valid: File[];
  errors: ValidationError[];
}

const DEFAULT_MAX = 25 * 1024 * 1024;

const ACCEPTED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const ACCEPTED_EXT = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

const formatMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const isAcceptedFormat = (file: File): boolean => {
  if (file.type && ACCEPTED_MIME.has(file.type.toLowerCase())) return true;
  const lower = file.name.toLowerCase();
  return ACCEPTED_EXT.some((ext) => lower.endsWith(ext));
};

/**
 * Synchronous validation: format + size only (no decode).
 * Use this in the dropzone to reject obvious bad files instantly.
 */
export const validateFiles = (
  files: File[],
  opts: ValidationOptions = {},
): ValidationResult => {
  const max = opts.maxSizeBytes ?? DEFAULT_MAX;
  const valid: File[] = [];
  const errors: ValidationError[] = [];
  for (const file of files) {
    if (!isAcceptedFormat(file)) {
      errors.push({
        file,
        reason: `Formato não suportado (${file.type || "desconhecido"}). Use JPG, PNG, WebP ou HEIC.`,
      });
      continue;
    }
    if (file.size > max) {
      errors.push({
        file,
        reason: `Arquivo muito grande (${formatMb(file.size)}). Limite: ${formatMb(max)}.`,
      });
      continue;
    }
    if (file.size === 0) {
      errors.push({ file, reason: "Arquivo vazio." });
      continue;
    }
    valid.push(file);
  }
  return { valid, errors };
};

/**
 * Async validation: includes a decode pass to verify the image
 * is actually parseable and meets the minimum dimension.
 */
export const validateFileDeep = async (
  file: File,
  opts: ValidationOptions = {},
): Promise<{ ok: true } | { ok: false; reason: string }> => {
  const sync = validateFiles([file], opts);
  if (sync.errors.length) return { ok: false, reason: sync.errors[0].reason };
  const min = opts.minDimension ?? 200;
  try {
    const { readImageMeta } = await import("./imageConverter");
    const meta = await readImageMeta(file);
    const longest = Math.max(meta.width, meta.height);
    if (longest < min) {
      return {
        ok: false,
        reason: `Imagem muito pequena (${meta.width}×${meta.height}). Mínimo: ${min}px.`,
      };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: `Não foi possível decodificar a imagem (${(e as Error).message ?? "erro desconhecido"}).`,
    };
  }
};

export const VALIDATION_LIMITS = {
  maxSizeBytes: DEFAULT_MAX,
  maxSizeMb: 25,
  minDimension: 200,
  acceptedFormats: ACCEPTED_EXT,
};
