import type { ExcalidrawTextElement } from "./types";

export type TextStyle = {
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  color?: string;
};

export type TextStyleRange = TextStyle & {
  start: number;
  end: number;
};

const TEXT_STYLE_PROPERTIES = ["bold", "italic", "fontSize", "color"] as const;

export const getTextStyleRanges = (
  element: Pick<ExcalidrawTextElement, "customData">,
): TextStyleRange[] => {
  const ranges = element.customData?.textStyleRanges;
  if (!Array.isArray(ranges)) {
    return [];
  }
  return ranges.filter(
    (range): range is TextStyleRange =>
      range &&
      Number.isInteger(range.start) &&
      Number.isInteger(range.end) &&
      range.start >= 0 &&
      range.end > range.start,
  );
};

export const getTextStyleForDisplay = (
  element: Pick<ExcalidrawTextElement, "customData" | "originalText">,
  displayText: string,
): Array<TextStyle | null> => {
  const ranges = getTextStyleRanges(element);
  const styles: Array<TextStyle | null> = [];
  let originalOffset = 0;

  for (const character of displayText) {
    const isLineBreak = character === "\n";
    const isOriginalLineBreak =
      isLineBreak && element.originalText[originalOffset] === "\n";

    if (isOriginalLineBreak) {
      originalOffset++;
      styles.push(null);
      continue;
    }
    if (isLineBreak) {
      styles.push(null);
      continue;
    }

    let range: TextStyleRange | undefined;
    for (let index = 0; index < ranges.length; index++) {
      if (
        ranges[index].start <= originalOffset &&
        ranges[index].end > originalOffset
      ) {
        range = ranges[index];
        break;
      }
    }
    for (let index = 0; index < character.length; index++) {
      styles.push(range ?? null);
    }
    originalOffset += character.length;
  }

  return styles;
};

const sameStyle = (a: TextStyleRange, b: TextStyleRange) =>
  TEXT_STYLE_PROPERTIES.every((property) => a[property] === b[property]);

export const updateTextStyleRange = (
  ranges: readonly TextStyleRange[],
  start: number,
  end: number,
  property: keyof TextStyle,
  value: TextStyle[keyof TextStyle] | undefined,
): TextStyleRange[] => {
  if (end <= start) {
    return [...ranges];
  }

  const boundaries = new Set([start, end]);
  ranges.forEach((range) => {
    boundaries.add(range.start);
    boundaries.add(range.end);
  });
  const points = [...boundaries].sort((a, b) => a - b);
  const updated: TextStyleRange[] = [];

  for (let index = 0; index < points.length - 1; index++) {
    const segmentStart = points[index];
    const segmentEnd = points[index + 1];
    const existing = ranges.find(
      (range) => range.start <= segmentStart && range.end >= segmentEnd,
    );
    const style: TextStyleRange = {
      start: segmentStart,
      end: segmentEnd,
      ...(existing ?? {}),
    };

    if (segmentStart >= start && segmentEnd <= end) {
      if (value === undefined || value === false) {
        delete style[property];
      } else {
        (style as any)[property] = value;
      }
    }

    if (!TEXT_STYLE_PROPERTIES.some((key) => style[key] !== undefined)) {
      continue;
    }
    const previous = updated[updated.length - 1];
    if (
      previous &&
      previous.end === style.start &&
      sameStyle(previous, style)
    ) {
      previous.end = style.end;
    } else {
      updated.push(style);
    }
  }

  return updated;
};

export const remapTextStyleRanges = (
  ranges: readonly TextStyleRange[],
  previousText: string,
  nextText: string,
): TextStyleRange[] => {
  let prefix = 0;
  while (
    prefix < previousText.length &&
    prefix < nextText.length &&
    previousText[prefix] === nextText[prefix]
  ) {
    prefix++;
  }

  let suffix = 0;
  while (
    suffix < previousText.length - prefix &&
    suffix < nextText.length - prefix &&
    previousText[previousText.length - suffix - 1] ===
      nextText[nextText.length - suffix - 1]
  ) {
    suffix++;
  }

  const oldSuffixStart = previousText.length - suffix;
  const delta = nextText.length - previousText.length;
  const mapOffset = (offset: number) => {
    if (offset <= prefix) {
      return offset;
    }
    if (offset >= oldSuffixStart) {
      return Math.max(prefix, offset + delta);
    }
    return prefix;
  };

  return ranges
    .map((range) => ({
      ...range,
      start: mapOffset(range.start),
      end: mapOffset(range.end),
    }))
    .filter((range) => range.end > range.start && range.start < nextText.length)
    .map((range) => ({ ...range, end: Math.min(range.end, nextText.length) }));
};
