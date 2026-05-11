// server/missionFSM.mjs
// Mission lifecycle finite-state machine.
//
//                ┌──────────┐
//                │  draft   │
//                └────┬─────┘
//                     │ enterprise funds escrow
//                     ▼
//                ┌──────────┐
//                │  funded  │
//                └────┬─────┘
//                     │ enterprise opens for applications
//                     ▼
//                ┌──────────┐
//                │   open   │ ◄─── operators apply
//                └────┬─────┘
//                     │ enterprise approves first applicant
//                     ▼
//                ┌─────────────────────┐
//        ┌──────►│ partially_filled    │ (multi-op only)
//        │       └────┬────────────────┘
//        │            │ all slots claimed
//        │            ▼
//        │       ┌──────────────┐
//        │       │ fully_staffed│
//        │       └────┬─────────┘
//        │            │ first operator marks active
//        │            ▼
//        │       ┌──────────┐
//        │       │  active  │ ◄─── operator does work
//        │       └────┬─────┘
//        │            │ operator submits work
//        │            ▼
//        │       ┌──────────┐
//        │       │submitted │
//        │       └────┬─────┘
//        │            │ enterprise rates + completes
//        │            ▼
//        │       ┌──────────┐
//        └───────│completed │  (terminal)
//                └──────────┘
//
//   Either party at any time can raise a dispute → 'disputed'.
//   Admin resolution sends mission to 'completed' or 'cancelled'.
//   Enterprise can 'cancel' from any pre-active state.
//
// Why a real FSM instead of free-form `status` updates:
//   - Prevents UI bugs from corrupting state ("active" → "draft" by accident).
//   - Makes the audit log meaningful — every transition is intentional.
//   - Lets us hang side-effects on transitions (e.g. stake release on completion).

export const MISSION_STATES = Object.freeze([
  'draft', 'funded', 'open', 'partially_filled', 'fully_staffed',
  'active', 'submitted', 'completed', 'disputed', 'cancelled',
]);

// transition[from] = list of allowed `to` states
export const MISSION_TRANSITIONS = Object.freeze({
  draft:            ['funded', 'cancelled'],
  funded:           ['open', 'cancelled'],
  open:             ['partially_filled', 'fully_staffed', 'cancelled'],
  partially_filled: ['partially_filled', 'fully_staffed', 'cancelled', 'disputed'],
  fully_staffed:    ['active', 'cancelled', 'disputed'],
  active:           ['submitted', 'disputed', 'cancelled'],
  submitted:        ['completed', 'disputed'],
  completed:        [],                       // terminal
  cancelled:        [],                       // terminal
  disputed:         ['completed', 'cancelled'],
});

// Who can drive each transition. 'system' fires automatically (e.g. on slot
// claim, mission auto-transitions to partially_filled). Multiple roles means
// either can fire it; an empty list means system-only.
export const MISSION_TRANSITION_ACTORS = Object.freeze({
  'draft→funded':              ['enterprise'],
  'draft→cancelled':           ['enterprise'],
  'funded→open':               ['enterprise', 'system'],
  'funded→cancelled':          ['enterprise'],
  'open→partially_filled':     ['system'],
  'open→fully_staffed':        ['system'],
  'open→cancelled':            ['enterprise'],
  'partially_filled→partially_filled': ['system'],   // additional slot claimed but not all
  'partially_filled→fully_staffed':    ['system'],
  'partially_filled→cancelled':         ['enterprise'],
  'partially_filled→disputed':          ['operator', 'enterprise'],
  'fully_staffed→active':      ['system', 'operator'],
  'fully_staffed→cancelled':   ['enterprise'],
  'fully_staffed→disputed':    ['operator', 'enterprise'],
  'active→submitted':          ['operator', 'system'],
  'active→disputed':           ['operator', 'enterprise'],
  'active→cancelled':          ['enterprise'],
  'submitted→completed':       ['enterprise'],
  'submitted→disputed':        ['operator', 'enterprise'],
  'disputed→completed':        ['admin', 'system'],
  'disputed→cancelled':        ['admin', 'system'],
});

export class FSMError extends Error {
  constructor(message, code = 'INVALID_TRANSITION') {
    super(message);
    this.name = 'FSMError';
    this.code = code;
  }
}

// Returns true if `from → to` is a legal transition for `actorRole`.
// `actorRole` should be 'operator' | 'enterprise' | 'admin' | 'system'.
export function canTransition(from, to, actorRole) {
  const allowed = MISSION_TRANSITIONS[from];
  if (!allowed) return false;
  if (!allowed.includes(to)) return false;
  const actors = MISSION_TRANSITION_ACTORS[`${from}→${to}`];
  if (!actors) return false;
  return actors.includes(actorRole);
}

// Throws FSMError if illegal. Call this from update endpoints before writing.
export function assertTransition(from, to, actorRole) {
  if (from === to) return; // no-op transitions are always fine (idempotent updates)
  if (!MISSION_STATES.includes(to)) {
    throw new FSMError(`Unknown target state: ${to}`, 'UNKNOWN_STATE');
  }
  const allowed = MISSION_TRANSITIONS[from];
  if (!allowed) throw new FSMError(`Mission state ${from} has no allowed transitions`, 'TERMINAL');
  if (!allowed.includes(to)) {
    throw new FSMError(
      `Cannot transition mission from ${from} to ${to}. Allowed next states: ${allowed.join(', ') || '(none — terminal)'}`,
      'INVALID_TRANSITION',
    );
  }
  const actors = MISSION_TRANSITION_ACTORS[`${from}→${to}`] || [];
  if (!actors.includes(actorRole)) {
    throw new FSMError(
      `Role '${actorRole}' is not allowed to drive transition ${from} → ${to}. Allowed: ${actors.join(', ')}`,
      'FORBIDDEN_ACTOR',
    );
  }
}

export function isTerminal(state) {
  return MISSION_TRANSITIONS[state]?.length === 0;
}
