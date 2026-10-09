"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/submissions/input";

export type UploadedImage = { path: string; previewUrl: string; name: string };
type Pending = { id: string; name: string };

/**
 * Uploads straight to Storage at {user_id}/{challenge_slug}/{uuid}.{ext}.
 * Storage RLS only allows writes into the user's own folder; the server re-checks paths on submit.
 */
export function ScreenshotUploader({
  userId,
  slug,
  label,
  min,
  max,
  images,
  onChange,
  error,
  disabled,
}: {
  userId: string;
  slug: string;
  label: string;
  min: number;
  max: number;
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  error?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Disabled until hydrated: a file picked before React attaches onChange would be silently lost.
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const remaining = max - images.length - pending.length;

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploadError(null);
    const list = Array.from(files).slice(0, Math.max(remaining, 0));
    if (files.length > list.length) setUploadError(`You can upload up to ${max} screenshots.`);

    const supabase = createClient();
    const added: UploadedImage[] = [];
    await Promise.all(
      list.map(async (file) => {
        const ext = IMAGE_TYPES[file.type as keyof typeof IMAGE_TYPES];
        if (!ext) return setUploadError(`${file.name}: use PNG, JPG or WebP.`);
        if (file.size > MAX_IMAGE_BYTES) return setUploadError(`${file.name}: max 10 MB.`);
        const id = crypto.randomUUID();
        setPending((p) => [...p, { id, name: file.name }]);
        const path = `${userId}/${slug}/${id}.${ext}`;
        const { error } = await supabase.storage
          .from("submissions")
          .upload(path, file, { contentType: file.type, upsert: false });
        setPending((p) => p.filter((x) => x.id !== id));
        if (error) return setUploadError(`${file.name}: upload failed (${error.message}).`);
        added.push({ path, previewUrl: URL.createObjectURL(file), name: file.name });
      }),
    );
    if (added.length) onChange([...images, ...added]);
    if (inputRef.current) inputRef.current.value = "";
  }

  const describedBy = error || uploadError ? "screenshots-error" : "screenshots-hint";

  return (
    <fieldset className="grid gap-3" aria-describedby={describedBy}>
      <legend className="mb-1 font-medium">Screenshots</legend>
      <p id="screenshots-hint" className="text-muted-foreground text-sm">
        {label} · {min === max ? `${min}` : `${min}–${max}`} image{max > 1 ? "s" : ""}, PNG/JPG/WebP, max 10 MB each.
      </p>

      {(images.length > 0 || pending.length > 0) && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img) => (
            <li key={img.path} className="relative overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img src={img.previewUrl} alt={img.name} className="aspect-video w-full object-cover" />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute top-1 right-1 size-7"
                aria-label={`Remove ${img.name}`}
                disabled={disabled}
                onClick={() => onChange(images.filter((i) => i.path !== img.path))}
              >
                <X />
              </Button>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.id} className="text-muted-foreground flex aspect-video items-center justify-center gap-2 rounded-lg border text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Uploading…
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        id="screenshots-input"
        type="file"
        accept={Object.keys(IMAGE_TYPES).join(",")}
        multiple
        className="sr-only"
        aria-label="Choose screenshot files"
        tabIndex={-1}
        disabled={!ready || disabled || remaining <= 0}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        disabled={!ready || disabled || remaining <= 0}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus aria-hidden />
        Add screenshots
      </Button>
      {(error || uploadError) && (
        <p id="screenshots-error" role="alert" className="text-destructive text-sm">
          {uploadError ?? error}
        </p>
      )}
    </fieldset>
  );
}
