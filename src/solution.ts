// ============================================================================
// solution.ts — denne filen er den eneste du redigerer.
//
// Hver funksjon under er ødelagt. Den fulle spec'en for hver oppgave ligger
// i dashboardet — klikk «Oppgave» på et oppgave-kort for å lese hva
// funksjonen skal gjøre, og «Hint» hvis du står fast.
//
// Regler:
//   - Ikke endre funksjonsnavn, signaturer, eller eksporterte typer.
//   - Hold funksjonene rene — ikke muter input, ingen side effects.
//   - Graderen kjører funksjonene dine mot et datasett unikt for deg, så
//     du kan ikke hardkode svar. Du må fikse logikken.
// ============================================================================

export interface Ticket {
  id: string;
  title: string;
  done: boolean;
  points: number;
  priority: number; // 1 = low, 2 = med, 3 = high
  assignee: string;
}

export interface AssigneeStat {
  open: number;
  done: number;
  points: number;
}

export function weightedCompletionRate(tickets: Ticket[]): number {
  const total = tickets.reduce((s, t) => s + t.points, 0);
  if (total === 0) return 0;
  const done = tickets
    .filter((t) => t.done)
    .reduce((s, t) => s + t.points, 0);
  return Math.round((done / total) * 100);
}

export function prioritySort(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort(
    (a, b) =>
      b.priority - a.priority ||
      b.points - a.points ||
      a.id.localeCompare(b.id),
  );
}

export function estimateSprintDays(
  tickets: Ticket[],
  velocity: number,
): number {
  const total = tickets.reduce((s, t) => s + t.points, 0);
  return Math.round(total / velocity);
}

export function assigneeStats(
  tickets: Ticket[],
): Record<string, AssigneeStat> {
  return tickets.reduce<Record<string, AssigneeStat>>((acc, t) => {
    const a = acc[t.assignee] ?? { open: 0, done: 0, points: 0 };
    if (t.done) a.done++;
    else a.open++;
    a.points += t.points;
    acc[t.assignee] = a;
    return acc;
  }, {});
}

export function unblockedReady(
  tickets: Ticket[],
  blockers: Record<string, string[]>,
): string[] {
  const doneIds = new Set(
    tickets.filter((t) => t.done).map((t) => t.id),
  );
  return tickets
    .filter(
      (t) =>
        !t.done &&
        (blockers[t.id] ?? []).some((b) => doneIds.has(b)),
    )
    .map((t) => t.id);
}

export function topNByAssignee(
  tickets: Ticket[],
  n: number,
): Record<string, Ticket[]> {
  return tickets.reduce<Record<string, Ticket[]>>((acc, t) => {
    if (!acc[t.assignee]) acc[t.assignee] = [];
    if (acc[t.assignee].length < n) acc[t.assignee].push(t);
    return acc;
  }, {});
}
