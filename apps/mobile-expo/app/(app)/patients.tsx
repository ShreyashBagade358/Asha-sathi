import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { listBeneficiaries } from '../../src/db/database';
import type { Beneficiary } from '../../src/types';

export default function PatientsScreen() {
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<Beneficiary[]>([]);

  useEffect(() => {
    void (async () => {
      setPatients(await listBeneficiaries(search));
    })();
  }, [search]);

  return (
    <View style={styles.screen}>
      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name, ID or phone"
        placeholderTextColor="#94A3B8"
        testID="patient-search"
      />

      <FlatList
        data={patients}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No beneficiaries yet. Sync to download your area, or register a new patient.
          </Text>
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/patient/[id]', params: { id: item.id } }} asChild>
            <Pressable style={styles.card} testID={`patient-${item.id}`}>
              <Text style={styles.name}>{item.full_name}</Text>
              <Text style={styles.meta}>
                {item.beneficiary_id ?? ''}
                {item.gender ? ` · ${item.gender}` : ''}
                {item.age_years != null ? ` · ${item.age_years}y` : ''}
              </Text>
              {item.phone ? <Text style={styles.meta}>{item.phone}</Text> : null}
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  search: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  name: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  meta: { fontSize: 13, color: '#64748B' },
  empty: { textAlign: 'center', color: '#94A3B8', marginTop: 32, paddingHorizontal: 24 },
});
