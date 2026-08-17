import { isSupabaseDb } from "../db";
import { createServiceClient } from "../supabase/admin";
import { applyWritePlan } from "../db/writes";
import type { MediaType } from "../types";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "3gp", "mkv"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

function extensionFromName(name: string): string {
  const fromName = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  return fromName && /^[a-z0-9]+$/.test(fromName) ? fromName : "";
}

function mediaTypeFromFile(mime: string, filename: string): MediaType {
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";
  const ext = extensionFromName(filename);
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  throw new Error("Only image and video uploads are supported");
}

function extFromName(name: string, mime: string): string {
  const ext = extensionFromName(name);
  if (ext) return ext;
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/webm") return "webm";
  if (mime === "video/quicktime") return "mov";
  return "bin";
}

export async function uploadAnimalMedia(input: {
  animalId: number;
  file: File;
  caption?: string | null;
}) {
  if (!isSupabaseDb()) {
    throw new Error("Media uploads require Supabase. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const mime = input.file.type || "application/octet-stream";
  const mediaType = mediaTypeFromFile(mime, input.file.name);
  const max = mediaType === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (input.file.size > max) {
    throw new Error(
      mediaType === "video"
        ? "Video must be 50MB or smaller"
        : "Image must be 10MB or smaller"
    );
  }

  const client = createServiceClient();
  const { data: animalRow, error: animalErr } = await client
    .from("animals")
    .select("id")
    .eq("id", input.animalId)
    .maybeSingle();
  if (animalErr) throw new Error(animalErr.message);
  if (!animalRow) throw new Error("Animal not found");

  const ext = extFromName(input.file.name, mime);
  const id = crypto.randomUUID();
  const storagePath = `${input.animalId}/${id}.${ext}`;
  const buffer = Buffer.from(await input.file.arrayBuffer());

  const { error: uploadError } = await client.storage
    .from("animal-media")
    .upload(storagePath, buffer, { contentType: mime, upsert: false });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const now = new Date().toISOString();
  const media = {
    id,
    animal_id: input.animalId,
    storage_path: storagePath,
    media_type: mediaType,
    caption: input.caption ?? null,
    created_at: now,
  };
  await applyWritePlan({ upsertMedia: [media] });
  return media;
}

export async function signedMediaUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
  if (!isSupabaseDb()) return null;
  const client = createServiceClient();
  const { data, error } = await client.storage
    .from("animal-media")
    .createSignedUrl(storagePath, expiresIn);
  if (error) return null;
  return data.signedUrl;
}
