import type { Moment } from "src/types/moment";

import type { ICalendarSource, IDayMetadata } from "./types";

async function metadataReducer(
  promisedMetadata: Promise<IDayMetadata>[]
): Promise<IDayMetadata> {
  const initial: IDayMetadata = {
    dots: [],
    classes: [],
    dataAttributes: {},
  };
  // A single source that rejects (e.g. a failed cachedRead) must not reject the
  // whole cell's metadata — that would leave the cell's rendered state stale
  // (MetadataResolver has no rejection path) and log an unhandled rejection.
  // Treat a failed source as contributing nothing.
  const metas = await Promise.all(
    promisedMetadata.map((p) =>
      p.catch(
        (): IDayMetadata => ({ dots: [], classes: [], dataAttributes: {} })
      )
    )
  );
  return metas.reduce<IDayMetadata>(
    (acc, meta) => ({
      classes: [...(acc.classes ?? []), ...(meta.classes ?? [])],
      dataAttributes: {
        ...(acc.dataAttributes ?? {}),
        ...(meta.dataAttributes ?? {}),
      },
      dots: [...(acc.dots ?? []), ...(meta.dots ?? [])],
      // First source that provides a backgroundImage wins; later sources don't override.
      backgroundImage: acc.backgroundImage ?? meta.backgroundImage,
      emoji: acc.emoji ?? meta.emoji,
    }),
    initial
  );
}

export function getDailyMetadata(
  sources: ICalendarSource[],
  date: Moment,
  ..._args: unknown[]
): Promise<IDayMetadata> {
  return metadataReducer(
    sources.map(
      (source) => source.getDailyMetadata?.(date) ?? Promise.resolve<IDayMetadata>({})
    )
  );
}

export function getWeeklyMetadata(
  sources: ICalendarSource[],
  date: Moment,
  ..._args: unknown[]
): Promise<IDayMetadata> {
  return metadataReducer(
    sources.map(
      (source) => source.getWeeklyMetadata?.(date) ?? Promise.resolve<IDayMetadata>({})
    )
  );
}
