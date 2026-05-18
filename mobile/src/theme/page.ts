import { StyleSheet } from 'react-native';
import { FontFamily } from './fonts';

/** Shared layout tokens — match NewsInputScreen */
export const Page = {
  bg: '#F9FAFB',
  padH: 20,
  padTop: 6,
  primary: '#2563EB',
  border: '#E5E7EB',
  cardBg: '#FFFFFF',
};

export const pageStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Page.bg },
  content: { paddingHorizontal: Page.padH, paddingTop: Page.padTop, paddingBottom: 8 },
  card: {
    backgroundColor: Page.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Page.border,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
    color: '#111827',
    marginBottom: 10,
  },
  kicker: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: Page.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  hero: {
    fontFamily: FontFamily.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.5,
    color: '#111827',
    marginBottom: 6,
  },
  lead: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    marginBottom: 20,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: Page.border,
  },
  secondaryBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: '#6B7280',
  },
});
