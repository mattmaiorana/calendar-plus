import type { Moment } from "src/types/moment";

export interface IDot {
  className?: string;
  isFilled: boolean;
}

export interface IDayMetadata {
  classes?: string[];
  dataAttributes?: Record<string, string>;
  dots?: IDot[];
  /** `app://` resource URL from vault.getResourcePath, or undefined for no image. */
  backgroundImage?: string;
  /** Single emoji shown under the date (from a daily note frontmatter property). */
  emoji?: string;
}

export interface ICalendarSource {
  getDailyMetadata?: (date: Moment) => Promise<IDayMetadata>;
  getWeeklyMetadata?: (date: Moment) => Promise<IDayMetadata>;
}

export interface IWeek {
  days: Moment[];
  weekNum: number;
}

export type IMonth = IWeek[];
