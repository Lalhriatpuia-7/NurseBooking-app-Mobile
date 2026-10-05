import { useCallback, useState } from 'react';
import { Alert, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

import { ActionButton, Notice, Panel, Screen, sharedStyles } from '../../components/ui';
import { clearLocalTreatmentNotes, listLocalTreatmentNotes } from '../../lib/localNotes';
import { createTreatmentNoteShare, parseTreatmentNoteShare } from '../../lib/noteSharing';
import { useAuth } from '../../providers/AuthProvider';
import type { TreatmentNote } from '../../types/domain';

export default function NotesRoute() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<TreatmentNote[]>([]);
  const [importedNote, setImportedNote] = useState<TreatmentNote | null>(null);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    let isMounted = true;
    if (user?.role === 'customer') {
      listLocalTreatmentNotes(user.id)
        .then((localNotes) => { if (isMounted) setNotes(localNotes); })
        .catch((loadError) => { if (isMounted) setError(loadError instanceof Error ? loadError.message : 'Could not unlock local notes.'); });
    }
    return () => { isMounted = false; };
  }, [user]));

  if (!user) return <Screen title="Treatment notes"><Notice>Please sign in to continue.</Notice></Screen>;

  const shareNote = async (note: TreatmentNote) => {
    setError('');
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('The device does not have a compatible share target.');
      const file = new File(Paths.cache, `treatment-note-${note.bookingId}.json`);
      file.create({ overwrite: true });
      file.write(JSON.stringify(createTreatmentNoteShare(note), null, 2));
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Share treatment note' });
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : 'Could not share this note.');
    }
  };

  const clearNotes = () => Alert.alert(
    'Delete notes from this device?',
    'This removes the encrypted local note database contents. A nurse cannot recover the notes from the server.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete notes', style: 'destructive', onPress: async () => {
        try {
          await clearLocalTreatmentNotes(user.id);
          setNotes([]);
        } catch (clearError) {
          setError(clearError instanceof Error ? clearError.message : 'Could not delete local notes.');
        }
      } }
    ]
  );

  const importCustomerNote = async () => {
    setError('');
    setImportedNote(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const file = new File(result.assets[0].uri);
      const parsed = parseTreatmentNoteShare(await file.text());
      if (!parsed) throw new Error('This is not a customer-approved CareConnect treatment note.');
      setImportedNote(parsed);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Could not open this shared note.');
    }
  };

  if (user.role === 'nurse') return (
    <Screen title="Customer-shared note" subtitle="A customer must choose and share a note file with you.">
      <Panel>
        <Text style={sharedStyles.body}>Shared notes are readable files. Only open files received directly from the customer, and do not keep copies you do not need.</Text>
        <ActionButton title="Open shared note file" onPress={importCustomerNote} />
      </Panel>
      {error ? <Notice>{error}</Notice> : null}
      {importedNote ? <Panel>
        <Text style={sharedStyles.sectionTitle}>{importedNote.nurseName}</Text>
        <Text style={sharedStyles.muted}>Booking {importedNote.bookingId} · {new Date(importedNote.createdAt).toLocaleString()}</Text>
        <Text style={sharedStyles.body}>{importedNote.text}</Text>
      </Panel> : null}
    </Screen>
  );

  return (
    <Screen title="Treatment notes" subtitle="Notes are encrypted and stored on this device only.">
      {error ? <Notice>{error}</Notice> : null}
      {notes.length ? notes.map((note) => <Panel key={note.id}>
        <Text style={sharedStyles.sectionTitle}>{note.nurseName}</Text>
        <Text style={sharedStyles.muted}>Booking {note.bookingId} · {new Date(note.createdAt).toLocaleString()}</Text>
        <Text style={sharedStyles.body}>{note.text}</Text>
        <ActionButton title="Share this note" secondary onPress={() => shareNote(note)} />
      </Panel>) : <Panel><Text style={sharedStyles.muted}>Notes sent while you are using the app will be saved here on this device.</Text></Panel>}
      {notes.length ? <ActionButton title="Delete all local notes" secondary onPress={clearNotes} /> : null}
    </Screen>
  );
}