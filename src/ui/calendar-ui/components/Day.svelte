<script lang="ts">
  import type { Moment } from "src/types/moment";
  import { getDateUID } from "src/io/periodicNoteHelpers";

  import Dot from "./Dot.svelte";
  import MetadataResolver from "./MetadataResolver.svelte";
  import type { IDayMetadata } from "../types";
  import { isAltPressed, isMetaPressed, isWeekend } from "../utils";

  let {
    // Properties
    date,
    metadata,
    onHover,
    onClick,
    onContextMenu,
    // Global state
    today,
    displayedMonth = null,
    selectedId = null,
    selectedSecondDailyId = null,
    weekendDays = [0, 6],
  }: {
    date: Moment;
    metadata: Promise<IDayMetadata> | null;
    onHover: (date: Moment, targetEl: EventTarget, isMetaPressed: boolean) => void;
    onClick: (date: Moment, isMetaPressed: boolean, isAltPressed?: boolean) => void;
    onContextMenu: (date: Moment, event: MouseEvent) => void;
    today: Moment;
    displayedMonth?: Moment | null;
    selectedId?: string | null;
    selectedSecondDailyId?: string | null;
    weekendDays?: number[];
  } = $props();

  const isWeekendDay = $derived(isWeekend(date, weekendDays));
  const dailyUid = $derived(getDateUID(date, "daily"));
  const isSecondDailyActive = $derived(selectedSecondDailyId === dailyUid);
</script>

<td class:weekend={isWeekendDay}>
  <MetadataResolver {metadata}>
    {#snippet children(metadata)}
      <div
        class={`day ${(metadata.classes ?? []).join(" ")}`}
        class:active={selectedId === dailyUid && !isSecondDailyActive}
        class:second-daily-active={isSecondDailyActive}
        class:adjacent-month={displayedMonth && !date.isSame(displayedMonth, "month")}
        class:today={date.isSame(today, "day")}
        class:has-background-image={!!metadata.backgroundImage}
        style={metadata.backgroundImage
          ? `background-image: url("${metadata.backgroundImage}")`
          : ""}
        onclick={onClick && ((e) => onClick(date, isMetaPressed(e), isAltPressed(e)))}
        oncontextmenu={onContextMenu && ((e) => onContextMenu(date, e))}
        onpointerover={onHover &&
          ((e) => onHover(date, e.currentTarget, isMetaPressed(e)))}
        {...metadata.dataAttributes || {}}
      >
        <span class="day-number">{date.format("D")}</span>
        <div class="day-emoji">{metadata.emoji ?? ""}</div>
        <div class="dot-container">
          {#each metadata.dots ?? [] as dot}
            <Dot {...dot} />
          {/each}
        </div>
      </div>
    {/snippet}
  </MetadataResolver>
</td>

<style>
  .day {
    background-color: var(--color-background-day);
    border-radius: 4px;
    color: var(--color-text-day);
    cursor: pointer;
    font-size: 0.8em;
    height: 100%;
    /* isolation: isolate creates a stacking context so ::before/::after
       z-index values are resolved within .day, not the document root.
       This lets z-index: 0 overlays sit above the background image but
       below z-index: 1 text and dots. */
    isolation: isolate;
    padding: 4px;
    position: relative;
    text-align: center;
    transition: background-color 0.1s ease-in, color 0.1s ease-in;
    vertical-align: baseline;
  }
  .day:hover {
    background-color: var(--interactive-hover);
  }

  .day.active:hover {
    background-color: var(--interactive-accent-hover);
  }

  .adjacent-month {
    opacity: 0.25;
  }

  .today {
    color: var(--color-text-today);
  }

  .day:active,
  .day.active,
  .day.active.today {
    color: var(--text-on-accent);
    background-color: var(--interactive-accent);
  }

  /* The second daily note for this day is the active file. Use a neutral grey
     overlay (distinct from the accent fill used for the primary daily note) so
     it reads as selected without competing with the purple. Implemented as a
     translucent ::after so it works the same over plain cells and feature-image
     cells; sits above the cell background / image (z-index: 0) but below the
     number and dots (z-index: 1). The `.active` class is suppressed on these
     cells (see the markup), so the two highlights never stack. */
  .day.second-daily-active::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 4px;
    background-color: var(--text-muted);
    opacity: 0.4;
    pointer-events: none;
    z-index: 0;
  }

  /* Today's number is normally accent-colored (--color-text-today); under the
     grey second-daily overlay that reads as out-of-place purple, so restore
     the normal day text color to match every other second-daily-active cell.
     (The primary-active state has the analogous `.day.active.today` override.) */
  .day.second-daily-active.today {
    color: var(--color-text-day);
  }

  /* Featured image support ------------------------------------------------ */

  .day.has-background-image {
    background-size: cover;
    background-position: center;
    overflow: hidden;
  }

  /* Readability overlay: a dark gradient in front of the image so the date
     number and dots are visible regardless of photo content. Kept heavy on
     purpose — the goal is an at-a-glance "this day has an image" cue, not to
     show photo detail. z-index: 0 sits above the background image but below
     .day-number / .dot-container (z-index: 1 within the isolation context). */
  .day.has-background-image::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 4px;
    background: linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.35));
    pointer-events: none;
    transition: background 0.1s ease-in;
    z-index: 0;
  }

  /* Hover over an image cell: the base `.day:hover` background-color is hidden
     behind the photo, so instead lighten the ::before overlay (the photo
     appears to brighten). Keeping background-color stable (transparent) avoids
     a repaint that re-composites the image on every hover — that was the
     source of hover lag on image-heavy vaults. */
  .day.has-background-image:hover,
  .day.has-background-image.active:hover {
    background-color: transparent;
  }

  .day.has-background-image:hover::before {
    background: linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.1));
  }

  /* Active state over an image: suppress the solid accent background and
     use a translucent accent overlay instead so the photo stays visible
     underneath while the cell still reads as selected. */
  .day.has-background-image.active,
  .day.has-background-image.active.today,
  .day.has-background-image:active {
    background-color: transparent;
  }

  .day.has-background-image.active::after,
  .day.has-background-image.active.today::after,
  .day.has-background-image:active::after {
    content: '';
    position: absolute;
    inset: 0;
    background-color: var(--interactive-accent);
    border-radius: 4px;
    opacity: 0.65;
    pointer-events: none;
    z-index: 0;
  }

  /* The number is wrapped in a span purely for z-index: it must sit above
     both overlays within the isolation stacking context. No visual styling
     here — color, weight, and the today/active rules all come from the
     existing .day / .today / .day.active.today rules and inherit through the
     span, so the number looks identical whether or not the cell has an image. */
  .day-number {
    position: relative;
    z-index: 1;
  }

  /* Same stacking treatment as .day-number / .dot-container so the emoji sits
     above the feature-image and active overlays. */
  .day-emoji {
    font-size: 1.4em;
    line-height: 1.2;
    position: relative;
    z-index: 1;
  }

  .dot-container {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    line-height: 6px;
    min-height: 6px;
    position: relative;
    z-index: 1;
  }
</style>
