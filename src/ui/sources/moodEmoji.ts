import type { App } from "obsidian";
import { get } from "svelte/store";

import type { Moment } from "src/types/moment";
import type { ICalendarSource, IDayMetadata } from "src/ui/calendar-ui/types";
import { getPeriodicNote as helperGetPeriodicNote } from "src/io/periodicNoteHelpers";
import { dailyNotes, settings } from "../stores";

// A leading emoji, keeping variation selectors, skin-tone modifiers and ZWJ
// sequences (👨‍👩‍👧) intact. Built with the RegExp constructor because the
// tsconfig target (ES2017) rejects `\p{…}` in regex literals.
const LEADING_EMOJI_RE = new RegExp(
  "^\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier}|\\u200D\\p{Extended_Pictographic}\\uFE0F?)*",
  "u"
);

/**
 * The first emoji of a frontmatter value (`"🙂 good"` → `"🙂"`), or null when
 * the value is not a string or does not start with an emoji.
 */
export function firstEmoji(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return LEADING_EMOJI_RE.exec(value.trim())?.[0] ?? null;
}

/**
 * Returns an ICalendarSource that populates `emoji` on day cells from a
 * frontmatter property of the daily note (e.g. `mood: 🙂 good` → 🙂).
 *
 * Reads only the metadata cache (no file-content reads). Self-gated: returns
 * empty metadata when `moodEmoji.enabled` is false.
 */
export function createMoodEmojiSource(app: App): ICalendarSource {
  return {
    getDailyMetadata: async (date: Moment): Promise<IDayMetadata> => {
      const s = get(settings);
      if (!s.moodEmoji.enabled || !s.daily.enabled || !s.moodEmoji.property) return {};
      const file = helperGetPeriodicNote(date, "daily", get(dailyNotes) ?? {});
      if (!file) return {};
      const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
      const emoji = firstEmoji(frontmatter?.[s.moodEmoji.property]);
      return emoji ? { emoji } : {};
    },
  };
}
