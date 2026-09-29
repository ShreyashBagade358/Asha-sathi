import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { getBeneficiary } from '../../../src/db/database';
import type { Beneficiary } from '../../../src/types';

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [patient, setPatient] = useState<Beneficiary | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setPatient(await getBeneficiary(id));
    })();
  }, [id]);

  if (!patient) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Patient not found in the local store.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.name}>{patient.full_name}</Text>
      <Text style={styles.id}>{patient.beneficiary_id}</Text>

      <View style={styles.card}>
        <Row label="Gender" value={patient.gender ?? '—'} />
        <Row label="Date of birth" value={patient.date_of_birth ?? '—'} />
        <Row
          label="Age"
          value={
            patient.age_years != null
              ? `${patient.age_years}y${patient.age_months ? ` ${patient.age_months}m` : ''}`
              : '—'
          }
        />
        <Row label="Phone" value={patient.phone ?? '—'} />
        <Row label="Status" value={patient.status ?? 'active'} />
        <Row label="Household" value={patient.household_id ?? '—'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Sync</Text>
        <Row label="Version" value={String(patient.version ?? 1)} />
        <Row
          label="Last updated"
          value={patient.updated_at ? new Date(patient.updated_at).toLocaleString() : '—'}
        />
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 16 },
  name: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  id: { fontSize: 14, color: '#64748B', marginTop: -8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#334155' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: 14, color: '#64748B' },
  rowValue: { fontSize: 14, color: '#0F172A', fontWeight: '500' },
  empty: { color: '#94A3B8' },
});
