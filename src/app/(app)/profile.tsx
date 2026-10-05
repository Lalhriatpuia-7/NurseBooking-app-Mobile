import { useCallback, useState } from 'react';
import { Image, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { ActionButton, Field, Notice, Panel, Screen, sharedStyles } from '../../components/ui';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../providers/AuthProvider';
import type { Nurse, User } from '../../types/domain';

type ProfileDraft = Pick<User, 'name' | 'phone' | 'city' | 'address' | 'bio' | 'profileImageUrl'>;

export default function ProfileRoute() {
  const { token, user, updateUser, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileDraft>(() => ({ name: user?.name || '', phone: user?.phone || '', city: user?.city || '', address: user?.address || '', bio: user?.bio || '', profileImageUrl: user?.profileImageUrl || '' }));
  const [nurse, setNurse] = useState<Nurse | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useFocusEffect(useCallback(() => {
    let isMounted = true;
    if (user?.role === 'nurse') {
      apiRequest<{ nurse: Nurse }>('/dashboard/nurse', { token })
        .then((payload) => { if (isMounted) setNurse(payload.nurse); })
        .catch(() => {});
    }
    return () => { isMounted = false; };
  }, [token, user?.role]));

  const save = async () => {
    if (profile.name.trim().length < 2) return setError('Enter a name with at least 2 characters.');
    setSaving(true);
    setError('');
    try {
      const payload = await apiRequest<{ user: User }>('/auth/profile', { method: 'PATCH', token, body: JSON.stringify(profile) });
      updateUser(payload.user);
      setEditing(false);
      setNotice('Profile saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the profile.');
    } finally {
      setSaving(false);
    }
  };

  const chooseProfilePhoto = async () => {
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.65,
        base64: true
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) throw new Error('Choose a profile image smaller than 5 MB.');
      if (!asset.base64) throw new Error('Could not read this profile image. Choose another photo.');
      setProfile((current) => ({ ...current, profileImageUrl: `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}` }));
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : 'Could not select a profile image.');
    }
  };

  if (!user) return <Screen title="Profile"><Notice>Please sign in to continue.</Notice></Screen>;

  return (
    <Screen title="Your profile" subtitle={`${user.role} · ${user.email}`}>
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {error ? <Notice>{error}</Notice> : null}
      <Panel>
        {editing ? <>
          {profile.profileImageUrl ? <Image source={{ uri: profile.profileImageUrl }} style={styles.avatar} /> : null}
          <ActionButton title="Choose profile photo" secondary onPress={chooseProfilePhoto} />
          {profile.profileImageUrl ? <ActionButton title="Remove profile photo" secondary onPress={() => setProfile((current) => ({ ...current, profileImageUrl: '' }))} /> : null}
          <Field label="Full name" value={profile.name} onChangeText={(name) => setProfile((current) => ({ ...current, name }))} />
          <Field label="Phone" value={profile.phone || ''} onChangeText={(phone) => setProfile((current) => ({ ...current, phone }))} keyboardType="phone-pad" />
          <Field label="City" value={profile.city || ''} onChangeText={(city) => setProfile((current) => ({ ...current, city }))} />
          <Field label="Appointment address" value={profile.address || ''} onChangeText={(address) => setProfile((current) => ({ ...current, address }))} />
          <Field label="Bio" value={profile.bio || ''} onChangeText={(bio) => setProfile((current) => ({ ...current, bio }))} multiline numberOfLines={4} />
          <ActionButton title="Save profile" onPress={save} loading={saving} />
          <ActionButton title="Cancel" onPress={() => setEditing(false)} secondary />
        </> : <>
          <Text style={sharedStyles.sectionTitle}>{user.name}</Text>
          <Text style={sharedStyles.body}>{user.phone || 'No phone number added'}</Text>
          <Text style={sharedStyles.body}>{user.city || 'No city added'}</Text>
          <Text style={sharedStyles.body}>{user.address || 'No address added'}</Text>
          <Text style={sharedStyles.muted}>{user.bio || 'No bio added'}</Text>
          {nurse ? <>
            <Text style={sharedStyles.body}>License · {nurse.licenseNumber}</Text>
            <Text style={sharedStyles.body}>UPI · {nurse.upiId}</Text>
            <Text style={sharedStyles.muted}>Ask an administrator to change your registered UPI recipient.</Text>
          </> : null}
          {user.profileImageUrl ? <Image source={{ uri: user.profileImageUrl }} style={styles.avatar} /> : null}
          <ActionButton title="Edit profile" secondary onPress={() => { setProfile({ name: user.name || '', phone: user.phone || '', city: user.city || '', address: user.address || '', bio: user.bio || '', profileImageUrl: user.profileImageUrl || '' }); setEditing(true); }} />
        </>}
      </Panel>
      <ActionButton title="Sign out" secondary onPress={() => signOut().catch((signOutError) => setError(signOutError.message))} />
    </Screen>
  );
}

const styles = {
  avatar: { width: 92, height: 92, borderRadius: 46, alignSelf: 'center' as const, backgroundColor: '#E9EEEC' }
};