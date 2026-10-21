"use client";

import { useState } from "react";
import type { Member } from "@/lib/tasks";

/** The member's photo, or a flat monogram in their color, lit softly from above like the house in the hero. */
export function Avatar({ member, size = 56 }: { member: Member; size?: number }) {
  const [broken, setBroken] = useState<string | null>(null);
  const photo = member.photo && member.photo !== broken ? member.photo : null;

  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        backgroundImage: `linear-gradient(to bottom, color-mix(in oklab, ${member.color} 86%, white), ${member.color})`,
      }}
      className="relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-medium text-white"
    >
      {Array.from(member.name)[0]}
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- a signed, expiring link to a private file; next/image would cache it past expiry.
        <img
          src={photo}
          alt=""
          draggable={false}
          onError={() => setBroken(photo)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
}
