import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  enqueue,
  insertLocalBeneficiary,
  listHouseholds,
} from '../../src/db/database';
import { scheduleSync } from '../../src/sync/network';
import { isCurrentlyOnline } from '../../src/sync/network';
import type { Household } from '../../src/types';

/**
 * Register a beneficiary.
 *
 * The write lands in SQLite and the outbox first, and the form is cleared
 * immediately. Uploading happens whenever the network allows, so this screen
 * behaves identically online and offline.
 */
function newId(): string {
  // A local uuid is enough: the server upserts on this id and the same id is
  // reused as the idempotency anchor on retry.
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function RegisterPatientScreen() {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [householdId, setHouseholdId] = useState('');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState('female');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const rows = await listHouseholds();
      setHouseholds(rows);
      if (rows[0]) setHouseholdId(rows[0].id);
    })();
  }, []);

  async function save() {
    if (!fullName.trim()) {
      setError('Name is required.');
      return;
    }
    if (!householdId) {
      setError('Select a household.');
      return;
    }
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      setError('Date of birth must be YYYY-MM-DD.');
      return;
    }

    setBusy(true);
    setError(null);

    const id = newId();
    const data = {
      id,
      beneficiary_id: `BEN-${id.slice(-8).toUpperCase()}`,
      household_id: householdId,
      full_name: fullName.trim(),
      gender,
      date_of_birth: dateOfBirth || null,
      phone: phone.trim() || null,
    };

    try {
      // Local commit first: the record is visible immediately and survives a
      // crash, independent of the network.
      await insertLocalBeneficiary({
        id,
        beneficiaryId: data.beneficiary_id,
        householdId,
        fullName: data.full_name,
        gender,
        dateOfBirth: dateOfBirth,
        phone: data.phone ?? '',
      });

      await enqueue({
        clientRequestId: `create-beneficiary-${id}`,
        entity: 'beneficiaries',
        operation: 'create',
        recordId: id,
        version: 1,
        data,
      });

      setFullName('');
      setDateOfBirth('');
      setPhone('');

      if (isCurrentlyOnline()) {
        scheduleSync(300);
        Alert.alert('Saved', 'Patient saved and queued for upload.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert(
          'Saved offline',
          'This patient is saved on the device and will upload automatically when you are back online.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the patient.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        Works offline. The record is saved on this device and uploaded automatically.
      </Text>

      <Text style={styles.label}>Full name *</Text>
      <TextInput
        style={styles.input}
        value={fullName}
        onChangeText={setFullName}
        placeholder="Patient name"
        placeholderTextColor="#94A3B8"
        testID="full-name"
      />

      <Text style={styles.label}>Household *</Text>
      <View style={styles.choices}>
        {households.length === 0 ? (
          <Text style={styles.hint}>No households yet. Sync first to download your area.</Text>
        ) : (
          households.map((hh) => (
            <Pressable
              key={hh.id}
              onPress={() => setHouseholdId(hh.id)}
              style={[styles.chip, householdId === hh.id && styles.chipActive]}
            >
              <Text style={householdId === hh.id ? styles.chipTextActive : styles.chipText}>
                {hh.hhid}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      <Text style={styles.label}>Gender</Text>
      <View style={styles.choices}>
        {['female', 'male', 'other'].map((value) => (
          <Pressable
            key={value}
            onPress={() => setGender(value)}
            style={[styles.chip, gender === value && styles.chipActive]}
          >
            <Text style={gender === value ? styles.chipTextActive : styles.chipText}>{value}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Date of birth</Text>
      <TextInput
        style={styles.input}
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#94A3B8"
        autoCapitalize="none"
        testID="date-of-birth"
      />

      <Text style={styles.label}>Phone</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="10-digit mobile number"
        placeholderTextColor="#94A3B8"
        keyboardType="phone-pad"
        maxLength={10}
        testID="phone"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={save}
        disabled={busy}
        testID="save-patient"
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Save patient</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 10 },
  hint: { fontSize: 13, color: '#64748B' },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginTop: 6 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#0F766E' },
  chipText: { fontSize: 13, color: '#334155' },
  chipTextActive: { fontSize: 13, color: '#FFFFFF' },
  error: { color: '#B91C1C', fontSize: 13, marginTop: 4 },
  button: {
    backgroundColor: '#0F766E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: { backgroundColor: '#99F6E4' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
