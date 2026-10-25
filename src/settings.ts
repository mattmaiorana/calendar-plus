import { PluginSettingTab, Setting } from "obsidian";
import type { App } from "obsidian";
import { configureGlobalMomentLocale } from "src/ui/calendar-ui/localization";
import type { ILocaleOverride, IWeekStartOption } from "src/ui/calendar-ui/localization";

import {
  DEFAULT_DAILY_NOTE_FORMAT,
  DEFAULT_MONTHLY_NOTE_FORMAT,
  DEFAULT_QUARTERLY_NOTE_FORMAT,
  DEFAULT_WEEKLY_NOTE_FORMAT,
  DEFAULT_YEARLY_NOTE_FORMAT,
} from "src/constants";
import { moment } from "src/types/moment";
import { FileSuggest, FolderSuggest } from "src/ui/file-suggest";

import type CalendarPlugin from "./main";

export type Periodicity =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export interface PeriodicNoteSettings {
  enabled: boolean;
  format: string;
  folder: string;
  template: string;
}

export interface FeatureImageSettings {
  enabled: boolean;
  /**
   * Frontmatter property names to check, in priority order. The first
   * property that contains a path to a vault image file is used. Stored as
   * an array; the settings UI shows a comma-separated text field.
   */
  frontmatterProperties: string[];
  /** When true, weekly-note cells also show featured images. */
  showForWeekly: boolean;
  /**
   * Vault paths of notes whose featured image is hidden on the calendar
   * (per-note opt-out, toggled from the day-cell context menu). Stored here
   * rather than in note frontmatter so it doesn't add a Properties box to the
   * note.
   */
  hiddenNotes: string[];
}

export interface MoodEmojiSettings {
  enabled: boolean;
  /**
   * Daily note frontmatter property to read. The first emoji of its value is
   * shown under the date (`mood: 🙂 good` → 🙂).
   */
  property: string;
}

export interface ISettings {
  weekStart: IWeekStartOption;
  shouldConfirmBeforeCreate: boolean;
  ctrlClickOpensInNewTab: boolean;
  showWeeklyNoteRight: boolean;
  shadeWeekendColumns: boolean;
  /**
   * JS/Moment weekday numbers (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
   * for the days that should receive the weekend tint when
   * `shadeWeekendColumns` is on. Independent of `weekStart`, which only
   * controls column order. Default is `[0, 6]` (Sunday + Saturday).
   */
  weekendDays: number[];
  /**
   * What the dots on day and week cells represent.
   *  - `"exists"` (default): one filled dot when the corresponding periodic
   *    note exists. Current Calendar Plus behavior.
   *  - `"word-count-tasks"`: filled dots based on the note's word count
   *    (1 dot per `wordsPerDot` words, max 5) plus one hollow task dot when
   *    the note has any open `- [ ]` / `* [ ]` checkboxes.
   * Applies to daily and weekly cells only.
   */
  dotMode: "exists" | "word-count-tasks";
  /**
   * Words per filled dot when `dotMode === "word-count-tasks"`. Default 250.
   * A value <= 0 disables word-count dots while leaving task dots in place.
   */
  wordsPerDot: number;
  /**
   * When true, render the Today button in the mobile calendar header.
   * Desktop always shows the Today button regardless of this setting.
   * Default false to preserve historical mobile behavior and avoid
   * crowding the mobile header by default.
   */
  showTodayButtonOnMobile: boolean;
  /**
   * When true, render a history button in the calendar header that opens a
   * compact 12-month year overview popup for quickly jumping between months
   * and years. Default false (opt-in).
   */
  showYearOverview: boolean;

  localeOverride: ILocaleOverride;

  // Calendar-owned periodic note settings.
  daily: PeriodicNoteSettings;
  weekly: PeriodicNoteSettings;
  monthly: PeriodicNoteSettings;
  quarterly: PeriodicNoteSettings;
  yearly: PeriodicNoteSettings;
  secondDaily: PeriodicNoteSettings;
  featureImage: FeatureImageSettings;
  moodEmoji: MoodEmojiSettings;
}

const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const defaultSettings = Object.freeze({
  shouldConfirmBeforeCreate: true,
  weekStart: "locale",
  ctrlClickOpensInNewTab: false,

  showWeeklyNoteRight: false,
  shadeWeekendColumns: false,
  weekendDays: [0, 6],
  dotMode: "exists",
  wordsPerDot: 250,
  showTodayButtonOnMobile: false,
  showYearOverview: false,

  localeOverride: "system-default",

  daily: {
    enabled: true,
    format: DEFAULT_DAILY_NOTE_FORMAT,
    folder: "",
    template: "",
  },
  weekly: {
    enabled: false,
    format: DEFAULT_WEEKLY_NOTE_FORMAT,
    folder: "",
    template: "",
  },
  monthly: {
    enabled: false,
    format: DEFAULT_MONTHLY_NOTE_FORMAT,
    folder: "",
    template: "",
  },
  quarterly: {
    enabled: false,
    format: DEFAULT_QUARTERLY_NOTE_FORMAT,
    folder: "",
    template: "",
  },
  yearly: {
    enabled: false,
    format: DEFAULT_YEARLY_NOTE_FORMAT,
    folder: "",
    template: "",
  },
  secondDaily: {
    enabled: false,
    format: DEFAULT_DAILY_NOTE_FORMAT,
    folder: "",
    template: "",
  },
  featureImage: {
    enabled: false,
    frontmatterProperties: ["banner", "image", "cover"],
    showForWeekly: true,
    hiddenNotes: [],
  },
  moodEmoji: {
    enabled: false,
    property: "mood",
  },
});

export class CalendarSettingsTab extends PluginSettingTab {
  private plugin: CalendarPlugin;

  constructor(app: App, plugin: CalendarPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    this.containerEl.empty();

    // Ensure window._bundledLocaleWeekSpec is initialized before
    // addWeekStartSetting reads it. Normally Calendar.svelte's getToday()
    // does this, but the user can open settings before the view mounts.
    configureGlobalMomentLocale(
      this.plugin.options.localeOverride,
      this.plugin.options.weekStart
    );

    new Setting(this.containerEl).setName("Calendar behavior").setHeading();
    this.addConfirmCreateSetting();
    this.addCtrlClickSetting();
    this.displayDotStyleSection();
    this.addShowTodayButtonOnMobileSetting();
    this.addShowYearOverviewSetting();
    this.displayWeekendSection();
    this.displayFeatureImageSection();
    this.displayMoodEmojiSection();

    new Setting(this.containerEl).setName("Periodic notes").setHeading();
    this.containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Calendar manages periodic notes directly. To use existing notes, enter the same folder and date format you already use.",
    });
    this.displayPeriodicNoteSettings("daily", "Daily notes", DEFAULT_DAILY_NOTE_FORMAT);
    this.displaySecondDailyNoteSettings();
    this.displayPeriodicNoteSettings("weekly", "Weekly notes", DEFAULT_WEEKLY_NOTE_FORMAT);
    this.displayPeriodicNoteSettings("monthly", "Monthly notes", DEFAULT_MONTHLY_NOTE_FORMAT);
    this.displayPeriodicNoteSettings("quarterly", "Quarterly notes", DEFAULT_QUARTERLY_NOTE_FORMAT);
    this.displayPeriodicNoteSettings("yearly", "Yearly notes", DEFAULT_YEARLY_NOTE_FORMAT);

    new Setting(this.containerEl).setName("Locale").setHeading();
    this.addLocaleOverrideSetting();
  }

  addCtrlClickSetting(): void {
    new Setting(this.containerEl)
      .setName("Ctrl/Cmd + Click Behavior")
      .setDesc("Set the behavior of Ctrl/Cmd-clicking calendar items.")
      .addDropdown((dropdown) => {
        dropdown.addOption("new-tab", "Open in new tab");
        dropdown.addOption("new-split", "Open in new split");
        dropdown.setValue(
          this.plugin.options.ctrlClickOpensInNewTab ? "new-tab" : "new-split"
        );
        dropdown.onChange(async (value) => {
          void this.plugin.writeOptions(() => ({
            ctrlClickOpensInNewTab: value === "new-tab",
          }));
        });
      });
  }
  addConfirmCreateSetting(): void {
    new Setting(this.containerEl)
      .setName("Confirm before creating new note")
      .setDesc("Show a confirmation modal before creating a new note")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.shouldConfirmBeforeCreate);
        toggle.onChange(async (value) => {
          void this.plugin.writeOptions(() => ({
            shouldConfirmBeforeCreate: value,
          }));
        });
      });
  }

  addShowTodayButtonOnMobileSetting(): void {
    new Setting(this.containerEl)
      .setName("Show Today button on mobile")
      .setDesc("Show the Today button in the mobile calendar header.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.showTodayButtonOnMobile);
        toggle.onChange(async (value) => {
          void this.plugin.writeOptions(() => ({
            showTodayButtonOnMobile: value,
          }));
        });
      });
  }

  addShowYearOverviewSetting(): void {
    new Setting(this.containerEl)
      .setName("Show history navigator button")
      .setDesc(
        "Add a button to the calendar header that opens a 12-month grid for quickly jumping between months and years."
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.showYearOverview);
        toggle.onChange(async (value) => {
          void this.plugin.writeOptions(() => ({
            showYearOverview: value,
          }));
        });
      });
  }

  private displayWeekendSection(): void {
    const sectionEl = this.containerEl.createDiv();
    this.renderWeekendSection(sectionEl);
  }

  private renderWeekendSection(sectionEl: HTMLElement): void {
    sectionEl.empty();

    new Setting(sectionEl).setName("Weekend").setHeading();

    // Week start
    const localizedWeekdays = moment.weekdays();
    const localeWeekStartNum = window._bundledLocaleWeekSpec.dow;
    const localeWeekStart = moment.weekdays()[localeWeekStartNum];

    new Setting(sectionEl)
      .setName("Start week on")
      .setDesc(
        "Choose what day of the week to start. Select 'Locale default' to use the default specified by moment.js"
      )
      .addDropdown((dropdown) => {
        dropdown.addOption("locale", `Locale default (${localeWeekStart})`);
        localizedWeekdays.forEach((day, i) => {
          dropdown.addOption(weekdays[i], day);
        });
        dropdown.setValue(this.plugin.options.weekStart);
        dropdown.onChange(async (value) => {
          void this.plugin.writeOptions(() => ({
            weekStart: value as IWeekStartOption,
          }));
        });
      });

    // Shade weekend columns
    new Setting(sectionEl)
      .setName("Shade weekend columns")
      .setDesc(
        "Tint weekend day columns so they stand out from weekdays. Off by default. When enabled you can customize which days count as the weekend."
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.shadeWeekendColumns);
        toggle.onChange(async (value) => {
          await this.plugin.writeOptions(() => ({ shadeWeekendColumns: value }));
          this.renderWeekendSection(sectionEl);
        });
      });

    if (!this.plugin.options.shadeWeekendColumns) return;

    // Locale-aware day names indexed by JS weekday: 0 = Sunday … 6 = Saturday.
    // Matches the index space used by `weekendDays` in settings and the
    // `date.day()` lookup in `isWeekend` (src/ui/calendar-ui/utils.ts).
    new Setting(sectionEl)
      .setName("Weekend days")
      .setDesc(
        'Choose which days are shaded when "Shade weekend columns" is enabled. Independent of the "Start week on" setting.'
      );

    for (let i = 0; i < 7; i++) {
      const dayNum = i;
      new Setting(sectionEl)
        .setName(localizedWeekdays[dayNum])
        .addToggle((toggle) => {
          toggle.setValue(this.plugin.options.weekendDays.includes(dayNum));
          toggle.onChange(async (selected) => {
            const current = this.plugin.options.weekendDays;
            const next = selected
              ? [...current, dayNum].sort((a, b) => a - b)
              : current.filter((d) => d !== dayNum);
            void this.plugin.writeOptions(() => ({ weekendDays: next }));
          });
        });
    }
  }

  private displayDotStyleSection(): void {
    const sectionEl = this.containerEl.createDiv();
    this.renderDotStyleSection(sectionEl);
  }

  private renderDotStyleSection(sectionEl: HTMLElement): void {
    sectionEl.empty();

    new Setting(sectionEl)
      .setName("Dot style")
      .setDesc("Choose what the dots on day and week cells represent.")
      .addDropdown((dropdown) => {
        dropdown.addOption("exists", "Note exists");
        dropdown.addOption("word-count-tasks", "Word count and open tasks");
        dropdown.setValue(this.plugin.options.dotMode);
        dropdown.onChange(async (value) => {
          await this.plugin.writeOptions(() => ({
            dotMode: value as "exists" | "word-count-tasks",
          }));
          // Re-render only this section's wrapper so the "Words per dot"
          // sub-setting appears/disappears in place. Saved `wordsPerDot` is
          // untouched, so toggling back into "word-count-tasks" restores the
          // user's previous threshold.
          this.renderDotStyleSection(sectionEl);
        });
      });

    if (this.plugin.options.dotMode !== "word-count-tasks") return;

    new Setting(sectionEl)
      .setName("Words per dot")
      .setDesc("Number of words per filled dot. Up to 5 dots per cell.")
      .addText((text) => {
        text.inputEl.type = "number";
        text.setPlaceholder("250");
        text.setValue(String(this.plugin.options.wordsPerDot));
        text.onChange(async (value) => {
          const parsed = value === "" ? 250 : Number(value);
          if (!Number.isFinite(parsed)) return;
          void this.plugin.writeOptions(() => ({ wordsPerDot: parsed }));
        });
      });
  }

  private displayFeatureImageSection(): void {
    const sectionEl = this.containerEl.createDiv();
    this.renderFeatureImageSection(sectionEl);
  }

  private renderFeatureImageSection(sectionEl: HTMLElement): void {
    sectionEl.empty();

    new Setting(sectionEl).setName("Featured images").setHeading();

    new Setting(sectionEl)
      .setName("Enable")
      .setDesc(
        "Show the featured image from a daily or weekly note as the cell background."
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.featureImage.enabled);
        toggle.onChange(async (value) => {
          await this.plugin.writeOptions((prev) => ({
            featureImage: { ...prev.featureImage, enabled: value },
          }));
          this.renderFeatureImageSection(sectionEl);
        });
      });

    if (!this.plugin.options.featureImage.enabled) return;

    new Setting(sectionEl)
      .setName("Frontmatter properties")
      .setDesc(
        "Comma-separated frontmatter property names to check for an image path, in priority order. First matching vault image wins."
      )
      .addText((text) => {
        text.setPlaceholder("banner, image, cover");
        text.setValue(
          this.plugin.options.featureImage.frontmatterProperties.join(", ")
        );
        text.onChange(async (value) => {
          const props = value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          await this.plugin.writeOptions((prev) => ({
            featureImage: { ...prev.featureImage, frontmatterProperties: props },
          }));
        });
      });

    new Setting(sectionEl)
      .setName("Show for weekly notes")
      .setDesc(
        "Show featured images on weekly note cells in addition to daily note cells."
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.featureImage.showForWeekly);
        toggle.onChange(async (value) => {
          await this.plugin.writeOptions((prev) => ({
            featureImage: { ...prev.featureImage, showForWeekly: value },
          }));
        });
      });
  }

  private displayMoodEmojiSection(): void {
    const sectionEl = this.containerEl.createDiv();
    this.renderMoodEmojiSection(sectionEl);
  }

  private renderMoodEmojiSection(sectionEl: HTMLElement): void {
    sectionEl.empty();

    new Setting(sectionEl).setName("Mood emoji").setHeading();

    new Setting(sectionEl)
      .setName("Enable")
      .setDesc(
        "Show an emoji from a daily note frontmatter property under the date."
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.moodEmoji.enabled);
        toggle.onChange(async (value) => {
          await this.plugin.writeOptions((prev) => ({
            moodEmoji: { ...prev.moodEmoji, enabled: value },
          }));
          this.renderMoodEmojiSection(sectionEl);
        });
      });

    if (!this.plugin.options.moodEmoji.enabled) return;

    new Setting(sectionEl)
      .setName("Frontmatter property")
      .setDesc(
        "Property to read. The first emoji of its value is shown, e.g. mood: 🙂 good shows 🙂."
      )
      .addText((text) => {
        text.setPlaceholder("mood");
        text.setValue(this.plugin.options.moodEmoji.property);
        text.onChange(async (value) => {
          await this.plugin.writeOptions((prev) => ({
            moodEmoji: { ...prev.moodEmoji, property: value.trim() },
          }));
        });
      });
  }

  private displayPeriodicNoteSettings(
    periodicity: Periodicity,
    label: string,
    defaultFormat: string
  ): void {
    const sectionEl = this.containerEl.createDiv();
    this.renderPeriodicNoteSection(sectionEl, periodicity, label, defaultFormat);
  }

  private renderPeriodicNoteSection(
    sectionEl: HTMLElement,
    periodicity: Periodicity,
    label: string,
    defaultFormat: string
  ): void {
    sectionEl.empty();
    const pnSettings = this.plugin.options[periodicity];

    new Setting(sectionEl).setName(label).setHeading();

    new Setting(sectionEl)
      .setName("Enable")
      .setDesc(`Create and manage ${label.toLowerCase()} from Calendar`)
      .addToggle((toggle) => {
        toggle.setValue(pnSettings.enabled);
        toggle.onChange(async (value) => {
          await this.plugin.writeOptions((prev) => ({
            [periodicity]: { ...prev[periodicity], enabled: value },
          }));
          // Re-render only this section's wrapper. Calling this.display()
          // would empty the entire tab and reset the scroll container.
          this.renderPeriodicNoteSection(sectionEl, periodicity, label, defaultFormat);
        });
      });

    if (!pnSettings.enabled) return;

    // Weekly-only display setting: which side the week-number column lives on.
    // Placed right after Enable so the display preference is easy to find
    // when configuring Weekly notes. Only relevant when Weekly notes are
    // enabled (the column is hidden otherwise), so it lives here and
    // disappears with the rest of the weekly section when the user toggles
    // Weekly off. The persisted `showWeeklyNoteRight` key/default is
    // unchanged from when it lived under "Calendar behavior".
    if (periodicity === "weekly") {
      new Setting(sectionEl)
        .setName("Change week number side")
        .setDesc(
          "Show week numbers to the right of the calendar instead of the left."
        )
        .addToggle((toggle) => {
          toggle.setValue(this.plugin.options.showWeeklyNoteRight);
          toggle.onChange(async (value) => {
            void this.plugin.writeOptions(() => ({ showWeeklyNoteRight: value }));
          });
        });
    }

    new Setting(sectionEl)
      .setName("Date format")
      .setDesc("Moment.js format string for note filenames")
      .addText((text) => {
        text.setPlaceholder(defaultFormat);
        text.setValue(pnSettings.format);
        text.onChange(async (value) => {
          await this.plugin.writeOptions((prev) => ({
            [periodicity]: { ...prev[periodicity], format: value },
          }));
        });
      });

    new Setting(sectionEl)
      .setName("Folder")
      .setDesc("Notes are created here. Leave blank for vault root.")
      .addText((text) => {
        text.setPlaceholder("Example: folder/subfolder");
        text.setValue(pnSettings.folder);
        text.onChange(async (value) => {
          await this.plugin.writeOptions((prev) => ({
            [periodicity]: { ...prev[periodicity], folder: value },
          }));
        });
        new FolderSuggest(this.app, text.inputEl);
      });

    new Setting(sectionEl)
      .setName("Template file")
      .setDesc("Path to template file. Leave blank for no template.")
      .addText((text) => {
        text.setPlaceholder("Example: templates/daily");
        text.setValue(pnSettings.template);
        text.onChange(async (value) => {
          await this.plugin.writeOptions((prev) => ({
            [periodicity]: { ...prev[periodicity], template: value },
          }));
        });
        new FileSuggest(this.app, text.inputEl);
      });
  }

  private displaySecondDailyNoteSettings(): void {
    const sectionEl = this.containerEl.createDiv();
    this.renderSecondDailySection(sectionEl);
  }

  private renderSecondDailySection(sectionEl: HTMLElement): void {
    sectionEl.empty();
    const pnSettings = this.plugin.options.secondDaily;

    new Setting(sectionEl).setName("Second daily notes").setHeading();

    new Setting(sectionEl)
      .setName("Enable")
      .setDesc(
        "Allow the creation of a second daily note each day. Useful for meeting logs, keeping personal and work separate, etc. Access via right-click on any day cell."
      )
      .addToggle((toggle) => {
        toggle.setValue(pnSettings.enabled);
        toggle.onChange(async (value) => {
          await this.plugin.writeOptions((prev) => ({
            secondDaily: { ...prev.secondDaily, enabled: value },
          }));
          this.renderSecondDailySection(sectionEl);
        });
      });

    if (!pnSettings.enabled) return;

    new Setting(sectionEl)
      .setName("Date format")
      .setDesc("Moment.js format string for note filenames")
      .addText((text) => {
        text.setPlaceholder(DEFAULT_DAILY_NOTE_FORMAT);
        text.setValue(pnSettings.format);
        text.onChange(async (value) => {
          await this.plugin.writeOptions((prev) => ({
            secondDaily: { ...prev.secondDaily, format: value },
          }));
        });
      });

    new Setting(sectionEl)
      .setName("Folder")
      .setDesc("Notes are created here. Leave blank for vault root.")
      .addText((text) => {
        text.setPlaceholder("Example: folder/subfolder");
        text.setValue(pnSettings.folder);
        text.onChange(async (value) => {
          await this.plugin.writeOptions((prev) => ({
            secondDaily: { ...prev.secondDaily, folder: value },
          }));
        });
        new FolderSuggest(this.app, text.inputEl);
      });

    new Setting(sectionEl)
      .setName("Template file")
      .setDesc("Path to template file. Leave blank for no template.")
      .addText((text) => {
        text.setPlaceholder("Example: templates/call-notes");
        text.setValue(pnSettings.template);
        text.onChange(async (value) => {
          await this.plugin.writeOptions((prev) => ({
            secondDaily: { ...prev.secondDaily, template: value },
          }));
        });
        new FileSuggest(this.app, text.inputEl);
      });
  }

  addLocaleOverrideSetting(): void {
    const sysLocale = navigator.language?.toLowerCase();

    new Setting(this.containerEl)
      .setName("Override locale:")
      .setDesc(
        "Set this if you want to use a locale different from the default"
      )
      .addDropdown((dropdown) => {
        dropdown.addOption("system-default", `Same as system (${sysLocale})`);
        moment.locales().forEach((locale) => {
          dropdown.addOption(locale, locale);
        });
        dropdown.setValue(this.plugin.options.localeOverride);
        dropdown.onChange(async (value) => {
          void this.plugin.writeOptions(() => ({
            localeOverride: value,
          }));
        });
      });
  }
}
