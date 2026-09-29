import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { authApi } from '../src/auth/api';
import { login } from '../src/auth/session';

/** Matches the backend pattern ^[6-9]\d{9}$. */
const PHONE_PATTERN = /^[6-9]\d{9}$/;

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const phoneValid = PHONE_PATTERN.test(phone);

  async function requestOtp() {
    if (!phoneValid) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await authApi.sendOtp(phone);
      setNotice(response.message);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send OTP.');
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp() {
    if (otp.length < 4) {
      setError('Enter the OTP sent to your phone.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(phone, otp);
      router.replace('/(app)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.title}>ASHA Sathi</Text>
        <Text style={styles.subtitle}>Field worker app</Text>
      </View>

      <View style={styles.card}>
        {step === 'phone' ? (
          <>
            <Text style={styles.label}>Mobile number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="10-digit mobile number"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              maxLength={10}
              autoFocus
              testID="phone-input"
            />
            <Pressable
              style={[styles.button, (!phoneValid || busy) && styles.buttonDisabled]}
              onPress={requestOtp}
              disabled={!phoneValid || busy}
              testID="send-otp"
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Send OTP</Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>Enter OTP sent to {phone}</Text>
            <TextInput
              style={styles.input}
              value={otp}
              onChangeText={setOtp}
              placeholder="6-digit OTP"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              maxLength={8}
              autoFocus
              testID="otp-input"
            />
            <Pressable
              style={[styles.button, busy && styles.buttonDisabled]}
              onPress={submitOtp}
              disabled={busy}
              testID="verify-otp"
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Sign in</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.linkButton}
              onPress={() => {
                setStep('phone');
                setOtp('');
                setError(null);
              }}
            >
              <Text style={styles.linkText}>Change number</Text>
            </Pressable>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F766E', justifyContent: 'center' },
  header: { paddingHorizontal: 24, paddingBottom: 24 },
  title: { fontSize: 30, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 15, color: '#CCFBF1', marginTop: 4 },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#334155' },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0F172A',
  },
  button: {
    backgroundColor: '#0F766E',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#99F6E4' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  linkButton: { alignItems: 'center', paddingVertical: 4 },
  linkText: { color: '#0F766E', fontSize: 14, fontWeight: '600' },
  error: { color: '#B91C1C', fontSize: 13 },
  notice: { color: '#0F766E', fontSize: 12 },
});
