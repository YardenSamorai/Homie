"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/i18n/dictionary-provider";
import { pickPhoto, useCameraReady } from "@/lib/camera";
import { useHousehold } from "@/lib/household-store";
import { supabaseConfigured } from "@/lib/supabase/env";
import { compressImage, removeAvatar, saveAvatar, signedUrls } from "@/lib/supabase/media";

/** Settings: this parent's photo, shown instead of the first letter wherever they appear. */
export function ProfilePhoto() {
  const { dict } = useI18n();
  const currentUserId = useHousehold((s) => s.currentUserId);
  const me = useHousehold((s) => s.members.find((member) => member.id === s.currentUserId));
  const setMemberPhoto = useHousehold((s) => s.setMemberPhoto);
  const cameraReady = useCameraReady();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!me || !supabaseConfigured()) return null;

  const choose = async () => {
    if (!cameraReady) return setMessage(dict.stories.update);
    const file = await pickPhoto({ camera: false });
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const photo = await compressImage(file, { side: 512, square: true });
      const path = await saveAvatar(currentUserId, photo, me.photoPath ?? null);
      const url = (await signedUrls([path]))[path] ?? URL.createObjectURL(photo);
      setMemberPhoto(currentUserId, path, url);
    } catch {
      setMessage(dict.profile.failed);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await removeAvatar(currentUserId, me.photoPath ?? null);
      setMemberPhoto(currentUserId, null, null);
    } catch {
      setMessage(dict.profile.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={dict.profile.title}>
      <div className="flex items-center gap-4 p-4">
        <button
          type="button"
          onClick={() => void choose()}
          disabled={busy}
          aria-label={dict.profile.change}
          className="relative shrink-0 rounded-full transition-transform duration-150 ease-out active:scale-95 disabled:opacity-60"
        >
          <Avatar member={me} size={72} />
          <span className="absolute -bottom-0.5 -end-0.5 flex size-7 items-center justify-center rounded-full bg-accent text-accent-contrast ring-[3px] ring-surface">
            <Camera aria-hidden size={14} strokeWidth={2.2} />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-snug text-label-secondary">{message ?? dict.profile.hint}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <button type="button" disabled={busy} onClick={() => void choose()} className="min-h-9 text-[15px] font-semibold text-accent active:opacity-60 disabled:opacity-40">
              {busy ? dict.profile.saving : dict.profile.change}
            </button>
            {me.photoPath && !busy && (
              <button type="button" onClick={() => void remove()} className="min-h-9 text-[15px] font-medium text-danger active:opacity-60">
                {dict.profile.remove}
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
