// ============================================================================
// solution.ts — THE ONLY FILE YOU EDIT
//
// Six small, pure functions power the Debug Race dashboard. Each one has a
// bug. The dashboard renders every one of them, so every bug is visible
// somewhere in the UI. Use your AI tool of choice to find and fix them, then
// hit "Submit & grade".
//
// Rules:
//   - Don't change the function names, signatures, or the exported types.
//   - Keep every function pure (no mutation of inputs, no side effects).
//   - The grader runs YOUR functions against a dataset unique to you, so you
//     can't hardcode answers — you have to fix the logic.
//   - Read the JSDoc on each function CAREFULLY. The function names suggest
//     the rough shape; the JSDoc nails the corner cases. The bugs hide
//     between the two.
// ============================================================================

export interface Ticket {
  id: string;
  title: string;
  done: boolean;
  points: number;
  priority: number; // 1 = low, 2 = medium, 3 = high
  assignee: string;
}

export interface AssigneeStat {
  open: number;
  done: number;
  points: number;
}

// ----------------------------------------------------------------------------
// 1) weightedCompletionRate
// ----------------------------------------------------------------------------
/**
 * Percentage of *story points* that are already done, rounded to a whole
 * integer (0–100).
 *
 *   - Weighted by points, not by ticket count. A done 8-pointer counts for
 *     more than a done 1-pointer.
 *   - Empty list -> 0.
 *   - Total points = 0 (everything is a zero-point ticket) -> 0.
 *
 * Example: 8 + 5 done out of 8 + 5 + 3 + 2 total -> Math.round(13 / 18 * 100)
 *          -> 72.
 */
export function weightedCompletionRate(tickets: Ticket[]): number {
  const done = tickets.filter((t) => t.done).length;
  return Math.round((done / tickets.length) * 100);
}

// ----------------------------------------------------------------------------
// 2) prioritySort
// ----------------------------------------------------------------------------
/**
 * Return a NEW array of tickets sorted by, in order:
 *
 *   1. `priority` DESCENDING  (3 -> 2 -> 1)
 *   2. `points`   DESCENDING  (tie-break within the same priority)
 *   3. `id`       ASCENDING   (final tie-break — `localeCompare`)
 *
 * The input array must NOT be mutated.
 */
export function prioritySort(tickets: Ticket[]): Ticket[] {
  return tickets.sort((a, b) => b.priority - a.priority);
}

// ----------------------------------------------------------------------------
// 3) estimateSprintDays
// ----------------------------------------------------------------------------
/**
 * Whole days needed to finish the OPEN (not-done) work at the given velocity
 * (story points per day).
 *
 *   - Only sum the points of tickets that are NOT done.
 *   - Round UP (a half day still needs a full day to finish).
 *   - If there are no open tickets, the answer is 0.
 *
 * Example: 12 open points at velocity 5 -> Math.ceil(12 / 5) -> 3.
 */
export function estimateSprintDays(
  tickets: Ticket[],
  velocity: number,
): number {
  const total = tickets.reduce((s, t) => s + t.points, 0);
  return Math.round(total / velocity);
}

// ----------------------------------------------------------------------------
// 4) assigneeStats
// ----------------------------------------------------------------------------
/**
 * Per-assignee summary, keyed by assignee name:
 *
 *   { [assignee]: { open: number; done: number; points: number } }
 *
 *   - `open`   = count of NOT-done tickets assigned to this person.
 *   - `done`   = count of done tickets assigned to this person.
 *   - `points` = sum of `points` of this person's OPEN tickets only.
 *                (Closed tickets DON'T contribute — we're showing remaining
 *                workload, not historical effort.)
 *
 * Every assignee who appears in `tickets` appears in the result, even if all
 * their tickets are done (`open: 0, done: N, points: 0`).
 */
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

// ----------------------------------------------------------------------------
// 5) unblockedReady
// ----------------------------------------------------------------------------
/**
 * Tickets that are READY TO START — return their `id`s, sorted by:
 *
 *   1. `priority` DESCENDING
 *   2. `id`       ASCENDING (tie-break)
 *
 * A ticket is "ready" when ALL of the following hold:
 *
 *   - the ticket itself is NOT done
 *   - EVERY id in `blockers[ticketId]` refers to a ticket that IS done
 *   - tickets with no entry in `blockers` (or an empty list) are
 *     considered unblocked
 *   - an unknown id in a blocker list counts as NOT done (so it blocks)
 *
 * `blockers` shape:  `{ [ticketId]: string[] }`  — the array is the list of
 * ticket ids that must finish before this one can start.
 */
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

// ----------------------------------------------------------------------------
// 6) topNByAssignee
// ----------------------------------------------------------------------------
/**
 * For each assignee in `tickets`, return up to `n` of their OPEN (not-done)
 * tickets, sorted by:
 *
 *   1. `points` DESCENDING
 *   2. `id`     ASCENDING (tie-break)
 *
 *   - Done tickets are EXCLUDED.
 *   - Every assignee who appears in `tickets` appears in the result, even if
 *     all their tickets are done — they get an empty array.
 *   - If `n` exceeds the number of open tickets for that assignee, return all
 *     of them.
 *   - `n = 0` -> every assignee maps to `[]`.
 *
 * Shape:  { [assignee]: Ticket[] }
 */
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
