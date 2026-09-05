export interface SeasonDef {
  number: number;
  label: string;
  shortLabel: string;
  startDate: string;
  endDate: string;
}

export function buildSeasons(): SeasonDef[] {
  const list: SeasonDef[] = [
    {
      number: 1,
      label: 'Season 1 (August)',
      shortLabel: 'S1',
      startDate: '2026-08-08T00:00:00Z',
      endDate:   '2026-09-06T00:00:00Z',
    },
    {
      number: 2,
      label: 'Season 2 (September)',
      shortLabel: 'S2',
      startDate: '2026-09-06T00:00:00Z',
      endDate:   '2026-10-01T00:00:00Z',
    },
  ];

  let n = 3;
  let d = new Date('2026-10-01T00:00:00Z');
  const now = new Date();

  while (d <= now || (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear())) {
    const next = new Date(d);
    next.setMonth(next.getMonth() + 1);
    
    list.push({
      number: n,
      label: 'Season ' + n + ' (' + d.toLocaleDateString('en-US', { month: 'long' }) + ')',
      shortLabel: 'S' + n,
      startDate: d.toISOString(),
      endDate:   next.toISOString(),
    });
    d = next;
    n++;
  }

  return list.reverse();
}

export function getCurrentSeason(seasons: SeasonDef[]): SeasonDef {
  const now = new Date();
  return seasons.find(s => new Date(s.startDate) <= now && now < new Date(s.endDate)) || seasons[0];
}