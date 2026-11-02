/** Solution screen: steps, stages, controls, speed, mode switch (FR-016–FR-020, FR-015a/b, FR-019). */
import { describe, displayPrime, format } from '../cube/notation';
import type { PlaybackSpeed } from '../cube/types';
import { stageDef } from '../solver/beginner/stages';
import type { Session, Solution } from '../state/session';
import { backToInput, pause, play, resetCube, setSolveMode, setSpeed } from '../state/session';
import { h, setPressed } from './dom';
import type { Player } from './player';

function stageIndexFor(sol: Solution, moveIndex: number): number {
  if (!sol.stages) return -1;
  return sol.stages.findIndex((st) => moveIndex >= st.startIndex && moveIndex < st.startIndex + st.length);
}

export function createSolutionPanel(player: Player) {
  const shortBtn = h('button', { type: 'button', class: 'seg', onclick: () => void setSolveMode('short') }, 'Short');
  const beginnerBtn = h('button', { type: 'button', class: 'seg', onclick: () => void setSolveMode('beginner') }, 'Beginner');

  const header = h('h2', { class: 'step-header', 'data-testid': 'step-header' });
  const total = h('p', { class: 'total', 'data-testid': 'total-moves' });
  const stageCard = h('div', { class: 'stage-card', 'data-testid': 'stage-card' });
  const notation = h('p', { class: 'notation', 'data-testid': 'step-notation' });
  const desc = h('p', { class: 'description', 'data-testid': 'step-description' });
  const stepCard = h('div', { class: 'step-card' }, notation, desc);
  const solvedBox = h(
    'div',
    { class: 'solved-box', role: 'status' },
    h('p', { class: 'solved-text', 'data-testid': 'solved' }, 'Solved! 🎉'),
    h('button', { type: 'button', class: 'btn', onclick: () => void resetCube() }, 'Enter another cube'),
  );
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite', 'data-testid': 'live' });
  // Feature 002 FR-003: how to hold the physical cube while following the steps.
  const reminder = h(
    'p',
    { class: 'holding-reminder', 'data-testid': 'holding-reminder' },
    'Hold: ',
    h('strong', {}, 'white'),
    ' on top, ',
    h('strong', {}, 'green'),
    ' facing you',
  );
  let announcedFor: Solution | undefined;
  const spinner = h('p', { class: 'spinner', role: 'status' });

  const prevBtn = h('button', { type: 'button', class: 'btn', 'aria-keyshortcuts': 'ArrowLeft', onclick: () => void player.prev() }, '← Previous');
  const replayBtn = h('button', { type: 'button', class: 'btn', 'aria-keyshortcuts': 'R', onclick: () => void player.replay() }, '↺ Replay');
  const playBtn = h('button', {
    type: 'button',
    class: 'btn',
    'aria-keyshortcuts': 'Space',
    onclick: () => (sessionStoreGet().playback.playing ? pause() : play()),
  });
  const nextBtn = h('button', { type: 'button', class: 'btn btn-primary', 'aria-keyshortcuts': 'ArrowRight', onclick: () => void player.next() }, 'Next →');

  const speedBtns = (['slow', 'normal', 'fast'] as PlaybackSpeed[]).map((sp) =>
    h('button', { type: 'button', class: 'seg', 'data-speed': sp, onclick: () => setSpeed(sp) }, sp[0]!.toUpperCase() + sp.slice(1)),
  );

  const list = h('ol', { class: 'step-list', 'aria-label': 'All steps' });
  let listFor: Solution | undefined;
  let itemEls: HTMLButtonElement[] = [];

  const buildList = (sol: Solution) => {
    list.replaceChildren();
    itemEls = [];
    const addItem = (i: number) => {
      const m = sol.moves[i]!;
      const btn = h(
        'button',
        { type: 'button', class: 'step-item', 'data-step': i + 1, onclick: () => void player.jumpTo(i + 1) },
        h('span', { class: 'step-num' }, String(i + 1)),
        h('span', { class: 'step-move' }, displayPrime(format(m))),
      );
      itemEls[i] = btn;
      return h('li', {}, btn);
    };
    if (sol.stages) {
      for (const st of sol.stages) {
        const def = stageDef(st.id);
        const li = h('li', { class: 'stage-group' });
        li.append(
          h('p', { class: 'stage-title' }, st.length === 0 ? `${def.title} — already done, skipped` : def.title),
        );
        if (st.length > 0) {
          const ol = h('ol', { class: 'step-list-inner' });
          for (let i = st.startIndex; i < st.startIndex + st.length; i++) ol.append(addItem(i));
          li.append(ol);
        }
        list.append(li);
      }
    } else {
      sol.moves.forEach((_, i) => list.append(addItem(i)));
    }
    listFor = sol;
  };

  const editBtn = h('button', { type: 'button', class: 'btn btn-link', onclick: () => void backToInput() }, '✎ Edit cube');

  const el = h(
    'div',
    { class: 'panel-solution' },
    h('div', { class: 'row space' }, h('div', { class: 'seg-group', role: 'group', 'aria-label': 'Solution mode' }, shortBtn, beginnerBtn), editBtn),
    spinner,
    reminder,
    header,
    total,
    stageCard,
    stepCard,
    solvedBox,
    h('div', { class: 'controls' }, prevBtn, replayBtn, playBtn, nextBtn),
    h('div', { class: 'seg-group speed', role: 'group', 'aria-label': 'Playback speed' }, ...speedBtns),
    live,
    list,
  );

  let sessionStoreGet: () => Session = () => {
    throw new Error('not bound');
  };
  let lastAnnounced = '';

  return {
    el,
    bind(getter: () => Session) {
      sessionStoreGet = getter;
    },
    update(s: Session) {
      setPressed(shortBtn, s.solveMode === 'short');
      setPressed(beginnerBtn, s.solveMode === 'beginner');
      speedBtns.forEach((b) => setPressed(b, b.dataset.speed === s.playback.speed));
      spinner.textContent = s.solving === 'waiting' ? 'Preparing solver…' : s.solving === 'solving' ? 'Solving…' : s.solveError ?? '';
      const sol = s.solution;
      if (!sol) return;
      if (listFor !== sol) buildList(sol);
      const n = sol.moves.length;
      const k = s.cursor;
      const already = n === 0;
      const done = !already && k >= n;

      total.textContent = already ? '' : `${n} moves in total${sol.mode === 'beginner' ? ' (beginner method)' : ''}`;
      solvedBox.hidden = !(done || already);
      (solvedBox.firstElementChild as HTMLElement).textContent = already ? 'Already solved — nothing to do!' : 'Solved! 🎉';
      if (already) header.textContent = 'Already solved';
      else if (k === 0) header.textContent = `Starting position — ${n} steps`;
      else header.textContent = `Step ${k} of ${n}`;

      const move = k > 0 ? sol.moves[k - 1] : undefined;
      stepCard.hidden = !move;
      if (move) {
        notation.textContent = displayPrime(format(move));
        desc.textContent = describe(move);
      }

      // Stage card (beginner mode).
      stageCard.hidden = !sol.stages || already;
      if (sol.stages && !already) {
        const idx = k > 0 ? stageIndexFor(sol, k - 1) : sol.stages.findIndex((st) => st.length > 0);
        const st = sol.stages[idx];
        if (st) {
          const def = stageDef(st.id);
          const inStage = k > 0 ? k - st.startIndex : 0;
          stageCard.replaceChildren(
            h('p', { class: 'stage-label' }, `Stage ${idx + 1} of ${sol.stages.length}: ${def.title}`),
            h('p', { class: 'stage-goal' }, def.goal),
            h('p', { class: 'stage-progress' }, `Step ${inStage} of ${st.length} in this stage`),
          );
        }
      }

      prevBtn.disabled = k === 0;
      nextBtn.disabled = k >= n;
      replayBtn.disabled = k === 0;
      playBtn.disabled = k >= n;
      playBtn.textContent = s.playback.playing ? '❚❚ Pause' : '▶ Play';
      setPressed(playBtn, s.playback.playing);

      itemEls.forEach((b, i) => {
        const cur = i === k - 1;
        b.classList.toggle('current', cur);
        b.classList.toggle('done', i < k - 1);
        if (cur) b.setAttribute('aria-current', 'step');
        else b.removeAttribute('aria-current');
      });
      const curEl = itemEls[k - 1];
      if (curEl && typeof curEl.scrollIntoView === 'function') curEl.scrollIntoView({ block: 'nearest' });

      const announcement = move
        ? `Step ${k} of ${n}: ${displayPrime(format(move))}, ${describe(move).toLowerCase()}`
        : done || already
          ? 'Solved!'
          : '';
      reminder.classList.toggle('prominent', k <= 1);
      // Announce the holding orientation once when a solution opens.
      const prefix = announcedFor !== sol ? 'Hold your cube with white on top and green facing you. ' : '';
      announcedFor = sol;
      if (announcement !== lastAnnounced || prefix) {
        live.textContent = prefix + announcement;
        lastAnnounced = announcement;
      }
    },
  };
}
