import { describe, test, expect } from 'vitest'
import { displaySenderName, heldReasonLabel } from '@/features/held-credits/labels'

// R5 (USDX-749): nama pengirim dibandingkan dengan nama KYC pemilik order. Jalur rekaman mutasi
// tidak membawa `senderName`; backend membacanya dari deskripsi ("TRANSFER DARI | <nama>") ke
// `extractedSenderName`, dan layar menampilkannya di tempat yang sama.
describe('held credits — nama pengirim (R5)', () => {
  describe('positive', () => {
    test('a name-mismatch hold reads as a sentence the desk understands', () => {
      expect(heldReasonLabel('SENDER_NAME_MISMATCH')).toBe(
        'Nama pengirim berbeda dengan nama KYC pemilik order',
      )
      expect(heldReasonLabel('SENDER_NAME_UNVERIFIABLE')).toBe(
        'Nama pengirim tidak bisa dicek ke nama KYC pemilik order',
      )
    })

    test('the Notif sender name wins when present', () => {
      expect(
        displaySenderName({ senderName: 'ADITYA WISNU', extractedSenderName: 'LAIN' }),
      ).toBe('ADITYA WISNU')
    })
  })

  describe('negative', () => {
    test('neither name → null (the screen says "tidak disebut penyedia")', () => {
      expect(displaySenderName({ senderName: null, extractedSenderName: null })).toBeNull()
      expect(displaySenderName({ senderName: '', extractedSenderName: undefined })).toBeNull()
    })
  })

  describe('edge cases', () => {
    test('statement path: the name read from the description is shown', () => {
      expect(
        displaySenderName({ senderName: null, extractedSenderName: 'ADITYA WISNU WARDANA' }),
      ).toBe('ADITYA WISNU WARDANA')
    })
  })
})
