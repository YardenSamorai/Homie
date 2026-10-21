"use client";

import { create } from "zustand";
import type { Story, StoryView } from "./supabase/media";

type StoriesState = {
  stories: Story[];
  views: StoryView[];
  /** Signed links to the photos, by storage path. */
  urls: Record<string, string>;
  /** Whose stories are open in the viewer, and which one. */
  viewing: { authorId: string; index: number } | null;
  /** A photo just taken, waiting for a caption and Share. */
  draft: File | null;
  setDraft: (draft: File | null) => void;
  replace: (stories: Story[], views: StoryView[], urls: Record<string, string>) => void;
  addStory: (story: Story, url: string | undefined) => void;
  removeStory: (id: string) => void;
  addView: (view: StoryView) => void;
  open: (authorId: string, index: number) => void;
  goTo: (index: number) => void;
  close: () => void;
  clear: () => void;
};

export const useStories = create<StoriesState>()((set) => ({
  stories: [],
  views: [],
  urls: {},
  viewing: null,
  draft: null,
  setDraft: (draft) => set({ draft }),
  replace: (stories, views, urls) => set((state) => ({ stories, views, urls: { ...state.urls, ...urls } })),
  addStory: (story, url) =>
    set((state) => ({
      stories: state.stories.some((known) => known.id === story.id) ? state.stories : [...state.stories, story],
      urls: url ? { ...state.urls, [story.path]: url } : state.urls,
    })),
  removeStory: (id) => set((state) => ({ stories: state.stories.filter((story) => story.id !== id) })),
  addView: (view) =>
    set((state) =>
      state.views.some((known) => known.storyId === view.storyId && known.viewerId === view.viewerId) ? {} : { views: [...state.views, view] },
    ),
  open: (authorId, index) => set({ viewing: { authorId, index } }),
  goTo: (index) => set((state) => (state.viewing ? { viewing: { ...state.viewing, index } } : {})),
  close: () => set({ viewing: null }),
  clear: () => set({ stories: [], views: [], urls: {}, viewing: null, draft: null }),
}));

const live = (story: Story) => Date.parse(story.expiresAt) > Date.now();

export function storiesBy(stories: Story[], authorId: string) {
  return stories.filter((story) => story.authorId === authorId && live(story));
}

export function seenBy(views: StoryView[], storyId: string, viewerId: string) {
  return views.some((view) => view.storyId === storyId && view.viewerId === viewerId);
}

/** Where the viewer starts: the first photo this parent hasn't seen, else the first. */
export function firstUnseen(stories: Story[], views: StoryView[], viewerId: string) {
  const index = stories.findIndex((story) => !seenBy(views, story.id, viewerId));
  return index === -1 ? 0 : index;
}
