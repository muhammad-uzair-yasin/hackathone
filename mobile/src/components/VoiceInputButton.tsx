/**
 * VoiceInputButton.tsx
 * ====================
 * Press-and-hold mic button → records audio → sends to /api/voice/transcribe
 * → returns transcript → caller feeds it to the agent pipeline.
 *
 * States: idle → recording (animated waveform) → transcribing → done
 */
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Platform,
  NativeModules,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  Platform.select({
    android: 'http://10.0.2.2:8000',
    ios: 'http://localhost:8000',
    default: 'http://localhost:8000',
  });

type VoiceState = 'idle' | 'recording' | 'transcribing' | 'done' | 'error';

interface Props {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

const BAR_COUNT = 7;

export default function VoiceInputButton({ onTranscript, disabled }: Props) {
  const [audioLib, setAudioLib] = useState<any>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const recordingRef = useRef<any>(null);
  const barAnims = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.2))
  ).current;
  const waveLoop = useRef<Animated.CompositeAnimation | null>(null);

  // ── Waveform animation ────────────────────────────────────────────────────
  const startWave = () => {
    waveLoop.current = Animated.loop(
      Animated.stagger(
        80,
        barAnims.map((anim) =>
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 0.9 + Math.random() * 0.1,
              duration: 300 + Math.random() * 200,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.15 + Math.random() * 0.2,
              duration: 300 + Math.random() * 200,
              useNativeDriver: true,
            }),
          ])
        )
      )
    );
    waveLoop.current.start();
  };

  const stopWave = () => {
    waveLoop.current?.stop();
    barAnims.forEach((a) => a.setValue(0.2));
  };

  // ── Lazy load expo-av ──────────────────────────────────────────────────────
  useEffect(() => {
    // Try loading expo-av directly — if it fails, native module isn't available
    try {
      const ExpoAV = require('expo-av');
      if (ExpoAV && ExpoAV.Audio) {
        setAudioLib(ExpoAV.Audio);
      } else {
        setIsSupported(false);
      }
    } catch (e) {
      setIsSupported(false);
    }
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopWave();
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  // ── Recording flow ────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (disabled || state !== 'idle') return;
    if (!audioLib || !isSupported) {
      setState('error');
      setErrorMsg('Voice recording unsupported in this environment');
      return;
    }
    setErrorMsg('');
    setTranscript('');

    try {
      await audioLib.requestPermissionsAsync();
      await audioLib.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await audioLib.Recording.createAsync(
        audioLib.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setState('recording');
      startWave();
    } catch (err) {
      setState('error');
      setErrorMsg('Mic permission denied');
    }
  };

  const stopRecording = async () => {
    if (state !== 'recording' || !recordingRef.current) return;
    stopWave();
    setState('transcribing');

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error('No audio file');

      // Send to backend proxy → Pollinations Whisper
      const form = new FormData();
      form.append('audio', {
        uri,
        name: 'recording.m4a',
        type: 'audio/m4a',
      } as any);

      const res = await fetch(`${API_BASE}/api/voice/transcribe`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();

      if (data.error || !data.transcript) {
        setState('error');
        setErrorMsg(data.error || 'Transcription failed');
        return;
      }

      setTranscript(data.transcript);
      setState('done');
      onTranscript(data.transcript);
    } catch (err: any) {
      setState('error');
      setErrorMsg(err.message || 'Upload failed');
    }
  };

  const reset = () => {
    setState('idle');
    setTranscript('');
    setErrorMsg('');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const isRecording = state === 'recording';
  const isTranscribing = state === 'transcribing';
  const isDone = state === 'done';
  const isError = state === 'error';

  const hasAudio = !!(audioLib && isSupported);

  return (
    <View style={styles.wrap}>
      {/* Main mic button */}
      <TouchableOpacity
        style={[
          styles.btn,
          isRecording && styles.btnRecording,
          isTranscribing && styles.btnTranscribing,
          isDone && styles.btnDone,
          isError && styles.btnError,
          (disabled || !hasAudio) && styles.btnDisabled,
        ]}
        onPressIn={hasAudio ? startRecording : undefined}
        onPressOut={hasAudio ? stopRecording : undefined}
        onPress={!hasAudio ? undefined : (isDone || isError ? reset : undefined)}
        activeOpacity={0.8}
        disabled={disabled || isTranscribing || !hasAudio}
      >
        {isTranscribing ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : isDone ? (
          <Ionicons name="checkmark" size={22} color="#FFF" />
        ) : isError ? (
          <Ionicons name="refresh" size={22} color="#FFF" />
        ) : (
          <Ionicons
            name={isRecording ? 'mic' : 'mic-outline'}
            size={22}
            color="#FFF"
          />
        )}
      </TouchableOpacity>

      {/* Waveform bars — visible during recording */}
      {isRecording && (
        <View style={styles.waveform}>
          {barAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.bar,
                { transform: [{ scaleY: anim }] },
              ]}
            />
          ))}
        </View>
      )}

      {/* Label */}
      <Text style={[
        styles.label,
        isRecording && styles.labelRecording,
        isError && styles.labelError,
      ]}>
        {!hasAudio
          ? 'Voice recording unavailable on this device'
          : isRecording
            ? '🔴 Recording… release to send'
            : isTranscribing
              ? '⏳ Transcribing…'
              : isDone
                ? '✅ Got it! Tap to record again'
                : isError
                  ? `❌ ${errorMsg} — tap to retry`
                  : 'Hold to speak your alert'}
      </Text>

      {/* Transcript preview */}
      {isDone && transcript ? (
        <View style={styles.transcriptBox}>
          <Text style={styles.transcriptTxt}>"{transcript}"</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10 },

  btn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#6B7280',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  btnRecording: {
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626', shadowOpacity: 0.5, shadowRadius: 12,
  },
  btnTranscribing: { backgroundColor: '#7C3AED' },
  btnDone:  { backgroundColor: '#059669' },
  btnError: { backgroundColor: '#EA580C' },
  btnDisabled: { opacity: 0.4 },

  waveform: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    height: 40, paddingHorizontal: 8,
  },
  bar: {
    width: 4, height: 32, borderRadius: 2,
    backgroundColor: '#DC2626', transformOrigin: 'center',
  },

  label: {
    fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6B7280',
    textAlign: 'center',
  },
  labelRecording: { color: '#DC2626', fontFamily: 'Inter_600SemiBold' },
  labelError: { color: '#EA580C' },

  transcriptBox: {
    backgroundColor: '#F0FDF4', borderColor: '#86EFAC',
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    maxWidth: 300,
  },
  transcriptTxt: {
    fontFamily: 'Inter_400Regular', fontSize: 13,
    color: '#166534', fontStyle: 'italic', lineHeight: 18,
  },
});
