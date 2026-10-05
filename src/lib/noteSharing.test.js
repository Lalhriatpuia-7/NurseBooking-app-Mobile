import test from 'node:test';
import assert from 'node:assert/strict';

import { createTreatmentNoteShare, parseTreatmentNoteShare } from './noteSharing.js';

test('round-trips a customer-approved note export', () => {
  const note = { id: 'n-1', bookingId: 'b-1', nurseName: 'Nurse', text: 'Care note', createdAt: '2026-10-02T12:00:00.000Z' };
  assert.deepEqual(parseTreatmentNoteShare(JSON.stringify(createTreatmentNoteShare(note))), note);
});

test('rejects exports without explicit customer approval or valid note data', () => {
  const share = createTreatmentNoteShare({ id: 'n-1', bookingId: 'b-1', nurseName: 'Nurse', text: 'Care note', createdAt: '2026-10-02T12:00:00.000Z' });
  assert.equal(parseTreatmentNoteShare(JSON.stringify({ ...share, customerApprovedShare: false })), null);
  assert.equal(parseTreatmentNoteShare('{bad json'), null);
});