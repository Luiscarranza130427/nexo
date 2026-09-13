import {
  POSITION_GAP,
  completedAtFor,
  insertionIndex,
  normalizedPositions,
  positionAt,
  type Slot,
} from './task-rules.js';

const column: Slot[] = [
  { id: 'a', position: 1000 },
  { id: 'b', position: 2000 },
  { id: 'c', position: 3000 },
];

describe('insertionIndex', () => {
  it('appends to the end when no neighbour is given', () => {
    expect(insertionIndex(column)).toBe(3);
    expect(insertionIndex([])).toBe(0);
  });

  it('lands below afterTaskId and above beforeTaskId', () => {
    expect(insertionIndex(column, 'a')).toBe(1);
    expect(insertionIndex(column, 'c')).toBe(3);
    expect(insertionIndex(column, null, 'a')).toBe(0);
    expect(insertionIndex(column, null, 'c')).toBe(2);
  });

  it('accepts both neighbours in order, even with hidden tasks between them', () => {
    expect(insertionIndex(column, 'a', 'b')).toBe(1);
    expect(insertionIndex(column, 'a', 'c')).toBe(1);
  });

  it('rejects neighbours that are out of order or not in the column', () => {
    expect(insertionIndex(column, 'b', 'a')).toBeNull();
    expect(insertionIndex(column, 'b', 'b')).toBeNull();
    expect(insertionIndex(column, 'missing')).toBeNull();
    expect(insertionIndex(column, null, 'missing')).toBeNull();
  });
});

describe('positionAt', () => {
  it('starts an empty column at one gap', () => {
    expect(positionAt([], 0)).toBe(POSITION_GAP);
  });

  it('extends a column past either end', () => {
    expect(positionAt(column, 0)).toBe(0);
    expect(positionAt(column, 3)).toBe(4000);
  });

  it('takes the midpoint between two neighbours', () => {
    expect(positionAt(column, 1)).toBe(1500);
  });

  it('reports when adjacent neighbours leave no room', () => {
    const tight: Slot[] = [
      { id: 'a', position: 1000 },
      { id: 'b', position: 1001 },
    ];

    expect(positionAt(tight, 1)).toBeNull();
  });

  it('runs out of room after about ten insertions into the same spot', () => {
    let upper = 2000;
    let insertions = 0;

    for (;;) {
      const position = positionAt(
        [
          { id: 'a', position: 1000 },
          { id: 'x', position: upper },
        ],
        1,
      );

      if (position === null) {
        break;
      }

      upper = position;
      insertions += 1;
    }

    expect(insertions).toBeGreaterThanOrEqual(9);
    expect(insertions).toBeLessThanOrEqual(10);
  });
});

describe('normalizedPositions', () => {
  it('spaces a column evenly', () => {
    expect(normalizedPositions(3)).toEqual([1000, 2000, 3000]);
    expect(normalizedPositions(0)).toEqual([]);
  });
});

describe('completedAtFor', () => {
  const now = new Date('2026-10-01T12:00:00.000Z');
  const earlier = new Date('2026-09-20T09:00:00.000Z');

  it('sets the time when a task enters DONE', () => {
    expect(completedAtFor('IN_REVIEW', 'DONE', null, now)).toEqual(now);
    expect(completedAtFor(null, 'DONE', null, now)).toEqual(now);
  });

  it('keeps the original time while the task stays DONE', () => {
    expect(completedAtFor('DONE', 'DONE', earlier, now)).toEqual(earlier);
  });

  it('clears it when the task leaves DONE', () => {
    expect(completedAtFor('DONE', 'TODO', earlier, now)).toBeNull();
    expect(completedAtFor('TODO', 'CANCELLED', null, now)).toBeNull();
  });
});
