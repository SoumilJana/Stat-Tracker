import { useMemo, useRef } from 'react';

/**
 * Keeps each team on the side of the screen it was already on.
 *
 * The match engine always lists the Winner Stays winner first, so without this
 * the winning team would jump to the left column after every goal. Here a team
 * that stays on the pitch keeps its column and the incoming team takes the
 * column of the team that left.
 */
export function orderPitchSides<T extends { id: string }>(previous: [string, string] | null, pitch: T[]): T[] {
  const pair = pitch.slice(0, 2);
  if (pair.length < 2 || !previous) return pair;
  const [a, b] = pair;
  if (previous[0] === b.id || previous[1] === a.id) return [b, a];
  return [a, b];
}

export function useStablePitchSides<T extends { id: string }>(pitch: T[]): T[] {
  const previousRef = useRef<[string, string] | null>(null);
  const key = pitch.slice(0, 2).map((t) => t?.id).join('|');

  // Decide the left/right order only when the teams on the pitch change
  const orderedIds = useMemo(() => {
    const ordered = orderPitchSides(previousRef.current, pitch);
    if (ordered.length === 2) previousRef.current = [ordered[0].id, ordered[1].id];
    return ordered.map((t) => t.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Always hand back the latest team objects
  return orderedIds.map((id) => pitch.find((t) => t.id === id)).filter(Boolean) as T[];
}
