import { Slot, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { tokenStore } from '../../src/auth/tokenStore';

export default function AppLayout() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void (async () => {
      const token = await tokenStore.getAccessToken();
      setSignedIn(Boolean(token));
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F766E" />
      </View>
    );
  }

  if (!signedIn) {
    return <Redirect href="/login" />;
  }

  return <Slot />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
});
