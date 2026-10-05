export const TREATMENT_NOTE_SHARE_FORMAT = 'careconnect-treatment-note-v1';

const isTreatmentNote = (note) => Boolean(
  note && typeof note.id === 'string' && typeof note.bookingId === 'string' &&
  typeof note.nurseName === 'string' && typeof note.text === 'string' &&
  typeof note.createdAt === 'string'
);

export const createTreatmentNoteShare = (note) => {
  if (!isTreatmentNote(note)) throw new TypeError('Invalid treatment note');
  return {
    format: TREATMENT_NOTE_SHARE_FORMAT,
    customerApprovedShare: true,
    exportedAt: new Date().toISOString(),
    note
  };
};

export const parseTreatmentNoteShare = (serialized) => {
  let payload;
  try {
    payload = JSON.parse(serialized);
  } catch {
    return null;
  }
  if (payload?.format !== TREATMENT_NOTE_SHARE_FORMAT || payload.customerApprovedShare !== true || !isTreatmentNote(payload.note)) return null;
  return payload.note;
};