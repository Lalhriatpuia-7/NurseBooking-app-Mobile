import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

import type { TreatmentNote } from '../types/domain';

const DATABASE_NAME = 'careconnect-treatment-notes.db';
const DATABASE_KEY_NAME = 'careconnect.treatment-notes.sqlcipher-key';
const MAX_SAVED_NOTES = 300;
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

const toHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

const createDatabase = async () => {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new Error('Encrypted treatment-note storage is available on iOS and Android only.');
  }

  let key = await SecureStore.getItemAsync(DATABASE_KEY_NAME);
  if (!key) {
    key = toHex(Crypto.getRandomBytes(32));
    await SecureStore.setItemAsync(DATABASE_KEY_NAME, key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    });
  }

  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  try {
    await database.execAsync(`PRAGMA key = "x'${key}'";`);
    const cipher = await database.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version;');
    if (!cipher?.cipher_version) throw new Error('Encrypted notes are unavailable. Install the CareConnect development build.');
    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS treatment_notes (
        id TEXT PRIMARY KEY NOT NULL,
        owner_id TEXT NOT NULL,
        booking_id TEXT NOT NULL,
        nurse_name TEXT NOT NULL,
        note_text TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS treatment_notes_owner_created
      ON treatment_notes(owner_id, created_at DESC);
    `);
    return database;
  } catch (error) {
    await database.closeAsync();
    throw error;
  }
};

const getDatabase = () => {
  if (!databasePromise) {
    databasePromise = createDatabase().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
};

export const listLocalTreatmentNotes = async (ownerId: string): Promise<TreatmentNote[]> => {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    booking_id: string;
    nurse_name: string;
    note_text: string;
    created_at: string;
  }>(
    'SELECT id, booking_id, nurse_name, note_text, created_at FROM treatment_notes WHERE owner_id = ? ORDER BY created_at DESC LIMIT ?',
    ownerId,
    MAX_SAVED_NOTES
  );
  return rows.map((row) => ({
    id: row.id,
    bookingId: row.booking_id,
    nurseName: row.nurse_name,
    text: row.note_text,
    createdAt: row.created_at
  }));
};

export const saveLocalTreatmentNote = async (ownerId: string, note: TreatmentNote): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT OR IGNORE INTO treatment_notes (id, owner_id, booking_id, nurse_name, note_text, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    note.id,
    ownerId,
    note.bookingId,
    note.nurseName,
    note.text,
    note.createdAt
  );
  await database.runAsync(
    `DELETE FROM treatment_notes
     WHERE owner_id = ? AND id NOT IN (
       SELECT id FROM treatment_notes WHERE owner_id = ? ORDER BY created_at DESC LIMIT ?
     )`,
    ownerId,
    ownerId,
    MAX_SAVED_NOTES
  );
};

export const clearLocalTreatmentNotes = async (ownerId: string): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM treatment_notes WHERE owner_id = ?', ownerId);
};