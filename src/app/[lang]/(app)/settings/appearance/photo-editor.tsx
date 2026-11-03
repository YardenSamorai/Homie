"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { useI18n } from "@/i18n/dictionary-provider";
import { PHOTO_LIMITS, type Photo } from "@/lib/look";
import { backgroundLink, compressImage, uploadBackground, type BackgroundUpload } from "@/lib/supabase/media";
import { supabaseConfigured } from "@/lib/supabase/env";

const links = new Map<string, string>();

/** A link for showing a background photo here, before or after it's saved. */
export function usePhotoUrl(path: string | null) {
  const [url, setUrl] = useState<{ path: string; url: string } | null>(null);
  const known = path ? links.get(path) : undefined;
  useEffect(() => {
    if (!path || known) return;
    let live = true;
    void backgroundLink(path).then((link) => {
      if (!link) return;
      links.set(path, link.url);
      if (live) setUrl({ path, url: link.url });
    });
    return () => {
      live = false;
    };
  }, [path, known]);
  return known ?? (path && url?.path === path ? url.url : null);
}

const MAX_SEND = 4 * 1024 * 1024;

/** A phone photo is redrawn smaller on the device first (the server checks it again and strips what's left). */
async function sendPhoto(file: File): Promise<BackgroundUpload> {
  if (file.type && !file.type.startsWith("image/")) return { ok: false, reason: "type" };
  let photo: Blob = file;
  try {
    photo = await compressImage(file, { side: 2400 });
  } catch {
    if (file.size > MAX_SEND) return { ok: false, reason: "size" };
  }
  if (photo.size > MAX_SEND) return { ok: false, reason: "size" };
  return uploadBackground(photo);
}

function Slider({ label, value, min, max, step = 1, onChange, suffix = "" }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void; suffix?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex items-baseline justify-between text-[15px]">
        {label}
        <span className="text-[13px] tabular-nums text-label-secondary">
          {value}
          {suffix}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full accent-[var(--accent)]"
      />
    </div>
  );
}

/** Upload, then frame: where the focus is, how close, how soft, how veiled. Replace and remove keep the rest of the look. */
export function PhotoEditor({ photo, onChange, onRemove }: { photo: Photo | null; onChange: (photo: Photo) => void; onRemove: () => void }) {
  const { dict } = useI18n();
  const copy = dict.look;
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<keyof typeof copy.photoErrors | null>(null);
  const url = usePhotoUrl(photo?.path ?? null);

  if (!supabaseConfigured()) return <p className="text-[13px] leading-snug text-label-secondary">{copy.photoUnavailable}</p>;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const result = await sendPhoto(file);
    setBusy(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    onChange({ path: result.path, x: 50, y: 50, zoom: 1, blur: 0, veil: 60 });
  };

  const focusFrom = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!photo) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)));
    const y = Math.round(Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100)));
    onChange({ ...photo, x, y });
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(event) => {
          void pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {photo ? (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-[15px]">{copy.photoFocus}</span>
            <button
              type="button"
              aria-label={copy.photoFocusHint}
              onPointerDown={focusFrom}
              className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-fill"
            >
              {url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
              )}
              <span
                aria-hidden
                className="absolute size-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.35),0_2px_8px_rgb(0_0_0/0.3)]"
                style={{ left: `${photo.x}%`, top: `${photo.y}%` }}
              />
            </button>
            <p className="text-[13px] leading-snug text-label-secondary">{copy.photoFocusHint}</p>
          </div>
          <Slider label={copy.photoX} value={photo.x} min={0} max={100} suffix="%" onChange={(x) => onChange({ ...photo, x })} />
          <Slider label={copy.photoY} value={photo.y} min={0} max={100} suffix="%" onChange={(y) => onChange({ ...photo, y })} />
          <Slider label={copy.photoZoom} value={photo.zoom} min={PHOTO_LIMITS.zoom[0]} max={PHOTO_LIMITS.zoom[1]} step={0.05} suffix="×" onChange={(zoom) => onChange({ ...photo, zoom })} />
          <Slider label={copy.photoBlur} value={photo.blur} min={PHOTO_LIMITS.blur[0]} max={PHOTO_LIMITS.blur[1]} onChange={(blur) => onChange({ ...photo, blur })} />
          <Slider label={copy.photoVeil} value={photo.veil} min={PHOTO_LIMITS.veil[0]} max={PHOTO_LIMITS.veil[1]} suffix="%" onChange={(veil) => onChange({ ...photo, veil })} />
          <p className="text-[13px] leading-snug text-label-secondary">{copy.photoVeilHint}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
              className="min-h-11 rounded-full bg-fill px-4 text-[15px] font-semibold transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-40"
            >
              {busy ? copy.photoUploading : copy.photoReplace}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onRemove}
              className="min-h-11 rounded-full px-4 text-[15px] font-semibold text-danger transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-40"
            >
              {copy.photoRemove}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-fill px-4 text-[15px] font-semibold text-accent transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-40"
        >
          <ImagePlus aria-hidden size={18} />
          {busy ? copy.photoUploading : copy.photoPick}
        </button>
      )}
      {error && (
        <p role="alert" className="text-[13px] leading-snug text-danger">
          {copy.photoErrors[error]}
        </p>
      )}
      <p className="text-[13px] leading-snug text-label-secondary">{copy.photoPrivate}</p>
    </div>
  );
}
