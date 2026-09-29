import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { restoreSession } from '../src/auth/session';
import { tokenStore } from '../src/auth/tokenStore';

export default function Index() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void (async () => {
      const token = await tokenStore.getAccessToken();
      if (token) {
        const user = await restoreSession();
        setSignedIn(Boolean(user));
      }
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F766E" />
        <Text style={styles.muted}>Starting ASHA Sathi…</Text>
      </View>
    );
  }

  return <Redirect href={signedIn ? '/(app)' : '/login'} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    gap: 12,
  },
  muted: { color: '#64748B', fontSize: 14 },
});
