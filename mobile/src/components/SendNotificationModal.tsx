/**
 * SendNotificationModal — manually deliver the run's alert to a real
 * email address and/or WhatsApp number. Defaults are prefilled and editable.
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sendNotification } from '../api/client';
import { FontFamily, Page } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  defaultEmail: string;
  defaultPhone: string;
  defaultSubject: string;
  defaultMessage: string;
}

export default function SendNotificationModal({
  visible,
  onClose,
  defaultEmail,
  defaultPhone,
  defaultSubject,
  defaultMessage,
}: Props) {
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState(defaultPhone);
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsapp, setSendWhatsapp] = useState(true);
  const [sending, setSending] = useState(false);

  // Refresh prefilled values whenever the dialog opens for a new run.
  useEffect(() => {
    if (visible) {
      setEmail(defaultEmail);
      setPhone(defaultPhone);
      setSubject(defaultSubject);
      setMessage(defaultMessage);
      setSendEmail(true);
      setSendWhatsapp(true);
    }
  }, [visible, defaultEmail, defaultPhone, defaultSubject, defaultMessage]);

  const handleSend = async () => {
    if (!sendEmail && !sendWhatsapp) {
      Alert.alert('Pick a channel', 'Enable Email and/or WhatsApp before sending.');
      return;
    }
    if (sendEmail && !email.trim()) {
      Alert.alert('Email required', 'Enter an email address or turn off Email.');
      return;
    }
    if (sendWhatsapp && !phone.trim()) {
      Alert.alert('Number required', 'Enter a WhatsApp number or turn off WhatsApp.');
      return;
    }

    setSending(true);
    const res = await sendNotification({
      recipient_email: email.trim(),
      recipient_phone: phone.trim(),
      subject: subject.trim() || 'BioRoute Alert',
      message: message.trim() || 'BioRoute cold-chain alert.',
      send_email: sendEmail,
      send_whatsapp: sendWhatsapp,
    });
    setSending(false);

    if (res.success) {
      Alert.alert('Sent', res.message || `Queued ${res.queued_count ?? ''} notification(s).`);
      onClose();
    } else {
      Alert.alert('Failed', res.message || 'Could not send. Is the backend running?');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Send to WhatsApp & Email</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>Defaults are prefilled — edit before sending.</Text>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Email channel */}
            <View style={styles.channelRow}>
              <View style={styles.channelLabel}>
                <Ionicons name="mail-outline" size={16} color="#059669" />
                <Text style={styles.channelTxt}>Email</Text>
              </View>
              <Switch value={sendEmail} onValueChange={setSendEmail} />
            </View>
            <TextInput
              style={[styles.input, !sendEmail && styles.inputDisabled]}
              value={email}
              onChangeText={setEmail}
              editable={sendEmail}
              placeholder="recipient@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#9CA3AF"
            />

            {/* WhatsApp channel */}
            <View style={styles.channelRow}>
              <View style={styles.channelLabel}>
                <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                <Text style={styles.channelTxt}>WhatsApp</Text>
              </View>
              <Switch value={sendWhatsapp} onValueChange={setSendWhatsapp} />
            </View>
            <TextInput
              style={[styles.input, !sendWhatsapp && styles.inputDisabled]}
              value={phone}
              onChangeText={setPhone}
              editable={sendWhatsapp}
              placeholder="923001234567 (no +)"
              keyboardType="phone-pad"
              placeholderTextColor="#9CA3AF"
            />

            {/* Subject + message */}
            <Text style={styles.fieldLabel}>Subject</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="Subject"
              placeholderTextColor="#9CA3AF"
            />
            <Text style={styles.fieldLabel}>Message</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={message}
              onChangeText={setMessage}
              placeholder="Message"
              multiline
              placeholderTextColor="#9CA3AF"
            />
          </ScrollView>

          <TouchableOpacity
            style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={sending}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="send" size={16} color="#FFF" />
            )}
            <Text style={styles.sendBtnTxt}>{sending ? 'Sending…' : 'Send now'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    maxHeight: '88%',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: FontFamily.semiBold, fontSize: 17, color: '#111827' },
  subtitle: { fontFamily: FontFamily.regular, fontSize: 12, color: '#9CA3AF', marginTop: 4, marginBottom: 12 },
  channelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 8,
  },
  channelLabel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  channelTxt: { fontFamily: FontFamily.semiBold, fontSize: 14, color: '#374151' },
  fieldLabel: { fontFamily: FontFamily.medium, fontSize: 12, color: '#6B7280', marginTop: 14, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 6,
    fontFamily: FontFamily.regular, fontSize: 14, color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  inputDisabled: { opacity: 0.5 },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Page.primary, borderRadius: 99, paddingVertical: 14, marginTop: 16,
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnTxt: { fontFamily: FontFamily.semiBold, fontSize: 14, color: '#FFF' },
});
