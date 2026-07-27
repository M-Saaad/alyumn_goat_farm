"use client";

import { useEffect, useState } from "react";
import { actionSignMediaUrls } from "@/lib/server-actions";
import type { AnimalMedia } from "@/lib/types";
import { AnimalMediaUpload } from "@/components/AnimalMediaUpload";

type Props = {
  media: AnimalMedia[];
  animalId: number;
  supabaseEnabled: boolean;
};

export function AnimalMediaGallery({ media, animalId, supabaseEnabled }: Props) {
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(media.length > 0);

  useEffect(() => {
    if (media.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    actionSignMediaUrls(media.map((m) => m.storage_path))
      .then((result) => {
        if (!cancelled) setUrls(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [media]);

  return (
    <section className="mb-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <h2 className="mb-2 text-sm font-bold">Photos &amp; videos ({media.length})</h2>
      {media.length === 0 ? (
        <p className="text-sm text-stone-500">No media yet.</p>
      ) : loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-stone-100" />
      ) : (
        <ul className="space-y-3">
          {media.map((m) => {
            const url = urls[m.storage_path];
            return (
              <li key={m.id} className="overflow-hidden rounded-xl bg-stone-50">
                {url ? (
                  m.media_type === "video" ? (
                    <video
                      src={url}
                      controls
                      className="max-h-64 w-full bg-black object-contain"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={m.caption || "Goat media"}
                      className="max-h-64 w-full object-cover"
                    />
                  )
                ) : (
                  <p className="p-3 text-sm text-stone-500">Could not load media</p>
                )}
                {m.caption && <p className="px-3 py-2 text-xs text-stone-600">{m.caption}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {supabaseEnabled ? (
        <AnimalMediaUpload animalId={animalId} />
      ) : (
        <p className="mt-3 text-xs text-stone-500">
          Media upload is available when Supabase is configured.
        </p>
      )}
    </section>
  );
}
