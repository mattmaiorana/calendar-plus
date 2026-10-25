<script lang="ts">
  import { debounce } from "obsidian";
  import { get } from "svelte/store";

  import CalendarBase from "./calendar-ui/components/Calendar.svelte";
  import { configureGlobalMomentLocale } from "./calendar-ui/localization";
  import type { ICalendarSource } from "./calendar-ui/types";
  import { getMonthsWithNotes } from "src/io/yearNotes";

  import type { ISettings, PeriodicNoteSettings } from "src/settings";
  import { moment } from "src/types/moment";
  import type { Moment } from "src/types/moment";
  import { activeFile, activeSecondDailyFile, dailyNotes, monthlyNotes, quarterlyNotes, secondDailyNotes, settings, weeklyNotes, yearlyNotes } from "./stores";

  let {
    sources,
    onHoverDay,
    onHoverWeek,
    onClickDay,
    onClickWeek,
    onClickMonth,
    onClickYear,
    onClickQuarter,
    onClickToday,
    onContextMenuDay,
    onContextMenuWeek,
  }: {
    sources: ICalendarSource[];
    onHoverDay: (date: Moment, targetEl: EventTarget, isMetaPressed: boolean) => void;
    onHoverWeek: (date: Moment, targetEl: EventTarget, isMetaPressed: boolean) => void;
    onClickDay: (date: Moment, isMetaPressed: boolean, isAltPressed?: boolean) => void;
    onClickWeek: (date: Moment, isMetaPressed: boolean) => void;
    onClickMonth: (date: Moment, isMetaPressed: boolean) => void;
    onClickYear: (date: Moment, isMetaPressed: boolean) => void;
    onClickQuarter: (date: Moment, isMetaPressed: boolean) => void;
    onClickToday: (date: Moment) => void;
    onContextMenuDay: (date: Moment, event: MouseEvent) => void;
    onContextMenuWeek: (date: Moment, event: MouseEvent) => void;
  } = $props();

  let today = $state(moment());
  // `displayedMonth` is local per-view UI state (which month the calendar
  // shows). It is two-way bound to CalendarBase (nav arrows / year popup
  // mutate it) and pushed imperatively from the view via setDisplayedMonth.
  // Initialized to the current month (moment(), same instant as `today`); it
  // then diverges as the user navigates, so it intentionally does NOT track
  // `today` reactively.
  let displayedMonth = $state(moment());

  // Settings → locale + store reindex. Side effects, so this lives in
  // $effect.pre (runs before the DOM updates, keeping the legacy `$:`
  // ordering: stores populated before children render).
  //
  // Reindexing a note store walks its folder and parses every filename, so it
  // is both *selective* (only stores whose folder/format/enabled changed) and
  // *debounced* on subsequent changes — a folder/format field saves on every
  // keystroke, and rescanning a populated folder per keystroke lagged on large
  // vaults. The locale config and the (cheap) `today` bump stay immediate so
  // dot-style / week-start / other display settings still respond instantly;
  // only the expensive folder rescan waits for a typing pause. The very first
  // run (mount) reindexes immediately so the calendar is populated on open.
  let reindexedSettings: ISettings | null = null;
  let mounted = false;

  const debouncedReindex = debounce(() => {
    const s = get(settings);
    if (reindexChangedStores(s, reindexedSettings)) {
      // Reflect the freshly-scanned stores in the cells (their metadata reads
      // the stores non-reactively, so a `today` bump is what re-derives them).
      today = moment();
    }
    reindexedSettings = s;
  }, 300, true);

  $effect.pre(() => {
    const s = $settings;
    configureGlobalMomentLocale(s.localeOverride, s.weekStart);
    today = moment();
    if (!mounted) {
      mounted = true;
      reindexChangedStores(s, null);
      reindexedSettings = s;
    } else {
      debouncedReindex();
    }
  });

  // Cancel a pending rescan / tick if the view is torn down before they fire.
  $effect(() => () => {
    debouncedReindex.cancel();
    coalescedTick.cancel();
  });

  // Stable empty reference used when the year overview is disabled (below), so
  // the derived doesn't churn identity while off.
  const EMPTY_MONTHS: boolean[] = Array.from({ length: 12 }, () => false);

  // Recomputed when the displayed year changes (via the year-overview arrows,
  // which mutate displayedMonth) or when any note store changes. Keyed on the
  // year (a primitive `$derived`) rather than `displayedMonth` directly, so
  // plain month navigation within the same year doesn't re-run the (store-wide)
  // getMonthsWithNotes scan — the derived's value equality skips it.
  //
  // Gated on `showYearOverview`: when the year popup is disabled (the majority
  // case), the note-store reads below are never evaluated, so they aren't
  // dependencies and this scan does NOT re-run on every file create/delete/
  // rename (store mutations bypass tick coalescing, so this was the one
  // uncoalesced per-mutation cost — notably during a sync burst / bulk import).
  const displayedYear = $derived(displayedMonth.year());
  const monthsWithNotes = $derived(
    $settings.showYearOverview
      ? getMonthsWithNotes(displayedYear, $dailyNotes, $weeklyNotes, $monthlyNotes)
      : EMPTY_MONTHS
  );

  // Locale data for the calendar grid. getMonth/getDaysOfWeek read moment's
  // *global* locale directly and use this only as a reactivity trigger, so it
  // just needs a fresh identity when the locale actually changes. Key it on the
  // settings that drive the locale (applied by configureGlobalMomentLocale in
  // the $effect.pre above) via `moment()` — NOT `today` — so it stays stable
  // across content ticks and the 42-cell month grid stops rebuilding every tick.
  const localeData = $derived.by(() => {
    void $settings.localeOverride;
    void $settings.weekStart;
    return { ...moment().localeData() };
  });

  // Imperative API exposed to the view (CalendarView) via mount()'s exports.
  //
  // A tick re-derives every visible cell's metadata (the sources read the note
  // stores non-reactively, so reassigning `today` is what re-runs them). File
  // events fan out into redundant ticks: editing the active daily note fires
  // both onFileModified and onMetadataCacheChanged, and a sync burst fires one
  // per modified file. Coalescing back-to-back calls into a single `today` bump
  // (next frame) collapses those duplicates — a tick is idempotent, so merging
  // them only removes wasted recompute; the refresh is delayed by at most the
  // debounce window, which is imperceptible. (The thumbnail ready-callback is
  // already debounced the same way.)
  const coalescedTick = debounce(() => {
    today = moment();
  }, 16);
  export function tick() {
    coalescedTick();
  }

  // Jump the calendar to a given month — used by the "Reveal active note"
  // command. displayedMonth is per-view local state, so the view drives it
  // through this setter rather than a shared store (see FUTURE_PLANS.md).
  export function setDisplayedMonth(date: Moment) {
    displayedMonth = date;
  }

  // A store only needs rescanning when the inputs that determine its contents
  // change: enabled, folder, or format. (Display-only settings like dotMode or
  // weekendDays don't affect which notes exist; file create/delete/rename are
  // handled incrementally by the vault listeners in view.ts.)
  function periodChanged(
    a: PeriodicNoteSettings,
    b: PeriodicNoteSettings | undefined
  ): boolean {
    return (
      !b || a.enabled !== b.enabled || a.folder !== b.folder || a.format !== b.format
    );
  }

  // Returns true if any store was actually rescanned.
  function reindexChangedStores(s: ISettings, prev: ISettings | null): boolean {
    let any = false;
    if (periodChanged(s.daily, prev?.daily)) {
      dailyNotes.reindex();
      any = true;
    }
    if (periodChanged(s.weekly, prev?.weekly)) {
      weeklyNotes.reindex();
      any = true;
    }
    if (periodChanged(s.monthly, prev?.monthly)) {
      monthlyNotes.reindex();
      any = true;
    }
    if (periodChanged(s.yearly, prev?.yearly)) {
      yearlyNotes.reindex();
      any = true;
    }
    if (periodChanged(s.quarterly, prev?.quarterly)) {
      quarterlyNotes.reindex();
      any = true;
    }
    if (periodChanged(s.secondDaily, prev?.secondDaily)) {
      secondDailyNotes.reindex();
      any = true;
    }
    return any;
  }

  // 1 minute heartbeat to keep `today` reflecting the current day. Only act
  // when the day actually rolls over — otherwise this would reassign `today`
  // every 60s and needlessly recompute every cell's metadata once a minute.
  $effect(() => {
    const heartbeat = setInterval(() => {
      const now = moment();
      if (now.isSame(today, "day")) return;

      // Day rolled over (e.g. midnight). If we were viewing the (old) current
      // month, follow into the new month so "today" stays visible.
      const wasViewingCurrentMonth = displayedMonth.isSame(today, "month");
      today = now;
      if (wasViewingCurrentMonth) {
        displayedMonth = now;
      }
    }, 1000 * 60);

    return () => clearInterval(heartbeat);
  });
</script>

<div
  class="calendar-plus-wrapper"
  class:daily-enabled={$settings.daily.enabled}
  class:monthly-enabled={$settings.monthly.enabled}
  class:quarterly-enabled={$settings.quarterly.enabled}
  class:yearly-enabled={$settings.yearly.enabled}
  class:weekend-shading-enabled={$settings.shadeWeekendColumns}
  class:mood-emoji-enabled={$settings.moodEmoji.enabled}
>
  <CalendarBase
    {sources}
    {today}
    {onHoverDay}
    {onHoverWeek}
    {onContextMenuDay}
    {onContextMenuWeek}
    {onClickDay}
    {onClickWeek}
    {onClickMonth}
    {onClickYear}
    {onClickQuarter}
    {onClickToday}
    bind:displayedMonth
    {localeData}
    selectedId={$activeFile}
    selectedSecondDailyId={$activeSecondDailyFile}
    showWeekNums={$settings.weekly.enabled}
    showWeekNumsRight={$settings.showWeeklyNoteRight}
    quarterVisible={$settings.quarterly.enabled}
    weekendDays={$settings.weekendDays}
    showTodayButtonOnMobile={$settings.showTodayButtonOnMobile}
    showYearOverview={$settings.showYearOverview}
    {monthsWithNotes}
  />
</div>
