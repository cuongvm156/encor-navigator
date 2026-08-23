/**
 * Safe match highlighting — React text nodes only, never dangerouslySetInnerHTML.
 * Original capitalization and Vietnamese accents are preserved.
 */

import { Fragment } from "react";

import { matchRanges } from "./searchCore";

export function Highlight({ text, query }: { text: string; query: string }) {
  const ranges = matchRanges(text, query);
  if (ranges.length === 0) return <>{text}</>;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], index) => {
    if (start > cursor) nodes.push(<Fragment key={`t${index}`}>{text.slice(cursor, start)}</Fragment>);
    nodes.push(
      <mark key={`m${index}`} className="rounded bg-accent px-0.5 text-foreground">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) nodes.push(<Fragment key="tail">{text.slice(cursor)}</Fragment>);
  return <>{nodes}</>;
}
