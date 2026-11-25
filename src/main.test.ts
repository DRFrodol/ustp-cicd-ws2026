import { beforeEach, describe, expect, it } from 'vitest';
import {
  createBoard,
  createPiece,
  collision,
  drawFromBag,
  getGameState,
  hardDrop,
  holdPiece,
  move,
  restart,
  rotate,
  rotateActive,
  setActiveForTesting,
  setBoardForTesting,
  togglePause,
  SHAPES,
} from './main';
import type { Matrix, PieceType } from './main';

const ROWS = 20;
const COLUMNS = 10;

function emptyBoard(): (PieceType | null)[][] {
  return Array.from({ length: ROWS }, () => Array<PieceType | null>(COLUMNS).fill(null));
}

beforeEach(() => {
  restart();
});

describe('board', () => {
  it('creates a 10x20 board filled with empty cells', () => {
    const board = createBoard();
    expect(board).toHaveLength(ROWS);
    for (const row of board) {
      expect(row).toHaveLength(COLUMNS);
      expect(row.every((cell) => cell === null)).toBe(true);
    }
  });
});

describe('pieces', () => {
  it('defines the seven tetromino shapes', () => {
    expect(Object.keys(SHAPES).sort()).toEqual(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
  });

  it('spawns pieces centered at the top of the board', () => {
    expect(createPiece('I')).toMatchObject({ type: 'I', x: 3, y: 0 });
    expect(createPiece('O')).toMatchObject({ type: 'O', x: 4, y: 0 });
    expect(createPiece('T')).toMatchObject({ type: 'T', x: 3, y: 0 });
  });

  it('copies the shape matrix so the source shapes are never mutated', () => {
    const piece = createPiece('T');
    piece.matrix[0][0] = 9;
    expect(SHAPES.T[0][0]).toBe(0);
  });
});

describe('rotation', () => {
  it('rotates a horizontal I piece into a vertical one', () => {
    expect(rotate([[1, 1, 1, 1]])).toEqual([[1], [1], [1], [1]]);
  });

  it('leaves the O piece unchanged', () => {
    const o: Matrix = [[1, 1], [1, 1]];
    expect(rotate(o)).toEqual(o);
  });

  it('returns to the original matrix after four rotations', () => {
    let matrix = SHAPES.T.map((row) => [...row]);
    for (let i = 0; i < 4; i++) matrix = rotate(matrix);
    expect(matrix).toEqual(SHAPES.T);
  });

  it('rotates the active piece', () => {
    setActiveForTesting(createPiece('I'));
    rotateActive();
    expect(getGameState().active.matrix).toEqual([[1], [1], [1], [1]]);
  });
});

describe('collision detection', () => {
  it('reports no collision for a freshly spawned piece on an empty board', () => {
    setBoardForTesting(emptyBoard());
    setActiveForTesting(createPiece('T'));
    expect(collision(getGameState().active)).toBe(false);
  });

  it('detects a collision with the left wall', () => {
    setBoardForTesting(emptyBoard());
    setActiveForTesting({ ...createPiece('I'), x: 0 });
    expect(collision(getGameState().active, -1, 0)).toBe(true);
    expect(collision(getGameState().active, 1, 0)).toBe(false);
  });

  it('detects a collision with the floor', () => {
    setBoardForTesting(emptyBoard());
    setActiveForTesting({ ...createPiece('O'), x: 4, y: 18 });
    expect(collision(getGameState().active, 0, 1)).toBe(true);
  });

  it('detects a collision with already locked blocks', () => {
    const board = emptyBoard();
    board[19][4] = 'J';
    board[19][5] = 'J';
    setBoardForTesting(board);
    setActiveForTesting({ ...createPiece('O'), x: 4, y: 16 });
    expect(collision(getGameState().active, 0, 1)).toBe(false);
    expect(collision(getGameState().active, 0, 2)).toBe(true);
  });
});

describe('7-bag randomizer', () => {
  it('draws each of the seven piece types before repeating', () => {
    const first = Array.from({ length: 7 }, () => drawFromBag());
    const second = Array.from({ length: 7 }, () => drawFromBag());
    expect(new Set(first).size).toBe(7);
    expect(new Set(second).size).toBe(7);
  });
});

describe('movement and scoring', () => {
  it('moves the active piece horizontally', () => {
    setActiveForTesting(createPiece('T'));
    const startX = getGameState().active.x;
    expect(move(-1, 0)).toBe(true);
    expect(getGameState().active.x).toBe(startX - 1);
    expect(move(1, 0)).toBe(true);
    expect(getGameState().active.x).toBe(startX);
  });

  it('refuses to move a piece through the wall', () => {
    setActiveForTesting({ ...createPiece('I'), x: 0 });
    expect(move(-1, 0)).toBe(false);
    expect(getGameState().active.x).toBe(0);
  });

  it('awards one point per soft drop', () => {
    setActiveForTesting(createPiece('T'));
    expect(move(0, 1)).toBe(true);
    expect(getGameState().score).toBe(1);
  });

  it('drops the piece to the floor, awards two points per cell and locks it', () => {
    setBoardForTesting(emptyBoard());
    setActiveForTesting(createPiece('O'));
    hardDrop();
    const state = getGameState();
    // The O piece fell 18 rows: 18 * 2 = 36 points for the hard drop.
    expect(state.score).toBe(36);
    expect(state.board[19][4]).toBe('O');
    expect(state.board[19][5]).toBe('O');
    expect(state.board[18][4]).toBe('O');
    expect(state.board[18][5]).toBe('O');
    // A new piece was spawned at the top of the board after locking.
    expect(state.active.y).toBe(0);
  });
});

describe('line clearing', () => {
  it('clears a completed row and awards the line bonus', () => {
    const board = emptyBoard();
    for (let x = 0; x < COLUMNS; x++) {
      if (x !== 4 && x !== 5) board[ROWS - 1][x] = 'L';
    }
    setBoardForTesting(board);
    setActiveForTesting(createPiece('O'));
    hardDrop();

    const state = getGameState();
    expect(state.lines).toBe(1);
    // 18 cells of hard drop (36 points) + 100 points for a single line.
    expect(state.score).toBe(136);
    expect(state.level).toBe(1);
    // The completed row is gone; everything above shifted down, so the
    // remaining half of the O piece now rests on the bottom row.
    expect(state.board[ROWS - 1][4]).toBe('O');
    expect(state.board[ROWS - 1][5]).toBe('O');
    expect(state.board[ROWS - 1][0]).toBe(null);
    expect(state.board[ROWS - 2].every((cell) => cell === null)).toBe(true);
  });
});

describe('hold', () => {
  it('stores the current piece and blocks holding twice in a row', () => {
    const spawned = getGameState().active.type;
    holdPiece();
    let state = getGameState();
    expect(state.held).toBe(spawned);
    expect(state.canHold).toBe(false);

    const activeAfterSwap = state.active.type;
    holdPiece(); // blocked, must not change anything
    state = getGameState();
    expect(state.held).toBe(spawned);
    expect(state.active.type).toBe(activeAfterSwap);
  });

  it('swaps the held piece with the active piece once holding is re-enabled', () => {
    holdPiece();
    hardDrop(); // locking a piece re-enables holding via spawnNext
    const state = getGameState();
    expect(state.canHold).toBe(true);

    const held = state.held;
    const active = state.active.type;
    holdPiece();
    const after = getGameState();
    expect(after.held).toBe(active);
    expect(after.active.type).toBe(held);
  });
});

describe('pause and restart', () => {
  it('toggles the pause overlay', () => {
    const overlay = document.getElementById('overlay');
    expect(overlay?.hidden).toBe(true);

    togglePause();
    expect(getGameState().paused).toBe(true);
    expect(overlay?.hidden).toBe(false);

    togglePause();
    expect(getGameState().paused).toBe(false);
    expect(overlay?.hidden).toBe(true);
  });

  it('resets score, lines, level and board', () => {
    setActiveForTesting(createPiece('O'));
    hardDrop();
    expect(getGameState().score).toBeGreaterThan(0);

    restart();
    const state = getGameState();
    expect(state.score).toBe(0);
    expect(state.lines).toBe(0);
    expect(state.level).toBe(1);
    expect(state.held).toBeNull();
    expect(state.board.every((row) => row.every((cell) => cell === null))).toBe(true);
  });
});

describe('keyboard handling', () => {
  function press(key: string): void {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  }

  it('moves the piece with the arrow keys', () => {
    setActiveForTesting(createPiece('T'));
    const startX = getGameState().active.x;
    press('ArrowLeft');
    expect(getGameState().active.x).toBe(startX - 1);
    press('ArrowRight');
    expect(getGameState().active.x).toBe(startX);
  });

  it('hard drops with space', () => {
    setBoardForTesting(emptyBoard());
    setActiveForTesting(createPiece('I'));
    press(' ');
    const state = getGameState();
    expect(state.board[ROWS - 1].filter((cell) => cell !== null).length).toBe(4);
  });

  it('pauses with P and resumes with Escape', () => {
    press('p');
    expect(getGameState().paused).toBe(true);
    press('Escape');
    expect(getGameState().paused).toBe(false);
  });
});
