import { describe, test, expect } from 'vitest'
import {
  buildDurianpayApiCallQueryString,
  describeResponseCode,
  durianpayApiCallErrorMessage,
  durianpayBodyView,
  durianpayCallLabel,
  durianpayOutcomeView,
  EMPTY_DURIANPAY_FILTER_VALUES,
  formatBodyBytes,
  formatCallDuration,
  hasDurianpayFilter,
  hasRedactedValue,
  isDurianpayFlavor,
  isDurianpayOutcome,
  toDurianpayApiCallQuery,
  wibDayEndIso,
  wibDayStartIso,
  type DurianpayApiCallFilterValues,
} from '@/lib/durianpayApiCalls'
import { ApiError } from '@/lib/apiFetch'

// Aturan murni layar "Log Panggilan DurianPay". Sumbernya kode backend di branch
// `wisnubarata111/be-catat-log-panggilan-durianpay` — belum ada kontrak SOT.

function values(overrides: Partial<DurianpayApiCallFilterValues> = {}) {
  return { ...EMPTY_DURIANPAY_FILTER_VALUES, ...overrides }
}

describe('durianpayCallLabel', () => {
  describe('positive', () => {
    test('should name every outbound endpoint the backend actually calls', () => {
      expect(durianpayCallLabel('/v1.0/access-token/b2b')).toBe('Ambil token akses')
      expect(durianpayCallLabel('/v1.0/transfer-va/create-va')).toBe(
        'Buat nomor VA untuk nasabah',
      )
      expect(durianpayCallLabel('/v1.0/transfer-va/inquiry-va')).toBe('Cek status tagihan VA')
      expect(durianpayCallLabel('/v1.0/account-inquiry-external')).toBe(
        'Cek nama pemilik rekening tujuan',
      )
      expect(durianpayCallLabel('/v1.0/transfer-interbank')).toBe(
        'Kirim rupiah ke rekening nasabah',
      )
      expect(durianpayCallLabel('/v1.0/transfer/status')).toBe('Cek status kiriman rupiah')
      expect(durianpayCallLabel('/v1.0/balance-inquiry')).toBe('Cek saldo kita di DurianPay')
    })

    test('should name the Legacy disbursement paths, whose ids differ per batch', () => {
      expect(durianpayCallLabel('/v1/disbursements/validate')).toBe(
        'Cek rekening tujuan (jalur lama)',
      )
      expect(durianpayCallLabel('/v1/disbursements/dis_9f2a/items')).toBe(
        'Cek status pencairan (jalur lama)',
      )
    })
  })

  describe('negative', () => {
    test('should return null for a path it does not know, instead of guessing', () => {
      expect(durianpayCallLabel('/v1.0/something-new')).toBeNull()
      expect(durianpayCallLabel('')).toBeNull()
    })

    test('should not mistake a nested Legacy path for the items read', () => {
      expect(durianpayCallLabel('/v1/disbursements/dis_9f2a/items/extra')).toBeNull()
    })
  })

  describe('edge cases', () => {
    test('should ignore the query string the Legacy submit path carries', () => {
      // `durianpay-disbursement-client.service.ts` logs the path WITH `?force_disburse=true`.
      expect(durianpayCallLabel('/v1/disbursements/submit?force_disburse=true')).toBe(
        'Kirim rupiah (jalur lama)',
      )
    })
  })
})

describe('durianpayOutcomeView', () => {
  describe('positive', () => {
    test('should call a clean 2xx berhasil', () => {
      const view = durianpayOutcomeView('SUCCESS', null)
      expect(view.pill.label).toBe('Berhasil')
      expect(view.pill.dotClass).toBe('bg-success')
    })
  })

  describe('negative', () => {
    test('should NOT call a 2xx with an errorSummary berhasil — the envelope refused inside', () => {
      // Satu-satunya cabang `summarize()` yang mengisi errorSummary pada SUCCESS:
      // HTTP 2xx dengan responseCode SNAP yang tidak berawalan `2`.
      const view = durianpayOutcomeView(
        'SUCCESS',
        'HTTP 200 tapi responseCode=4043001 Transaction Not Found',
      )
      expect(view.pill.label).toBe('Ditolak di jawaban')
      expect(view.pill.dotClass).toBe('bg-destructive')
      expect(view.meaning).toMatch(/Perlakukan sebagai gagal/)
    })

    test('should say a 4xx means the operation did not happen', () => {
      const view = durianpayOutcomeView('REJECTED', 'HTTP 400 responseCode=4001801')
      expect(view.pill.label).toBe('Ditolak')
      expect(view.meaning).toMatch(/TIDAK terjadi/)
    })

    test('should say UNAVAILABLE leaves the result unknown, not failed', () => {
      const view = durianpayOutcomeView('UNAVAILABLE', 'tidak ada respons (timeout/jaringan)')
      expect(view.pill.label).toBe('Tidak jelas')
      expect(view.meaning).toMatch(/mungkin terjadi, mungkin tidak/)
    })
  })

  describe('edge cases', () => {
    test('should render an unknown outcome as itself without inventing a colour or a meaning', () => {
      const view = durianpayOutcomeView('PARTIAL', null)
      expect(view.pill.label).toBe('PARTIAL')
      expect(view.pill.dotClass).toBe('bg-muted-foreground')
    })
  })
})

describe('describeResponseCode', () => {
  describe('positive', () => {
    test('should read the leading digits the way classifyOutcome does', () => {
      expect(describeResponseCode('2002700')).toBe('DurianPay menerima permintaan ini')
      expect(describeResponseCode('4001801')).toBe(
        'DurianPay menolak permintaan ini — operasinya tidak terjadi',
      )
      expect(describeResponseCode('5002701')).toBe(
        'DurianPay gagal memprosesnya — hasilnya tidak bisa dipastikan',
      )
    })
  })

  describe('negative', () => {
    test('should stay silent for a Legacy error_code, which is already words', () => {
      expect(describeResponseCode('invalid_bank_account')).toBeNull()
    })

    test('should stay silent for a shape it cannot read', () => {
      expect(describeResponseCode(null)).toBeNull()
      expect(describeResponseCode('200')).toBeNull()
      expect(describeResponseCode('20027000')).toBeNull()
    })
  })

  describe('edge cases', () => {
    test('should not invent a meaning for a leading digit outside 2/4/5', () => {
      expect(describeResponseCode('3002700')).toBeNull()
    })
  })
})

describe('wibDayStartIso / wibDayEndIso', () => {
  describe('positive', () => {
    test('should stamp the picked calendar day as a WIB instant, not a UTC one', () => {
      // Tanpa +07:00 server membaca `2026-09-19` sebagai 07:00 WIB dan tujuh jam
      // panggilan pagi hilang dari hasil tanpa ada yang memberi tahu.
      expect(wibDayStartIso('2026-09-19')).toBe('2026-09-19T00:00:00+07:00')
      expect(Date.parse('2026-09-19T00:00:00+07:00')).toBe(
        Date.parse('2026-09-18T17:00:00.000Z'),
      )
    })

    test('should close the range on the last millisecond, since the server compares inclusively', () => {
      expect(wibDayEndIso('2026-09-19')).toBe('2026-09-19T23:59:59.999+07:00')
    })
  })

  describe('negative', () => {
    test('should return null for anything that is not a calendar day', () => {
      expect(wibDayStartIso('')).toBeNull()
      expect(wibDayStartIso('19/09/2026')).toBeNull()
      expect(wibDayEndIso('2026-09')).toBeNull()
    })
  })
})

describe('toDurianpayApiCallQuery', () => {
  describe('positive', () => {
    test('should carry every filter the contract accepts', () => {
      const query = toDurianpayApiCallQuery(
        values({
          from: '2026-09-18',
          to: '2026-09-19',
          outcome: 'UNAVAILABLE',
          apiFlavor: 'SNAP',
          path: '/v1.0/transfer-va',
          referenceNo: 'MNT7K2X9QP',
          httpStatus: '500',
          responseCode: '5002701',
        }),
        2,
        20,
      )
      expect(query).toEqual({
        page: 2,
        take: 20,
        from: '2026-09-18T00:00:00+07:00',
        to: '2026-09-19T23:59:59.999+07:00',
        outcome: 'UNAVAILABLE',
        apiFlavor: 'SNAP',
        path: '/v1.0/transfer-va',
        referenceNo: 'MNT7K2X9QP',
        httpStatus: 500,
        responseCode: '5002701',
      })
    })

    test('should trim text filters so a stray space is not part of the match', () => {
      const query = toDurianpayApiCallQuery(values({ referenceNo: '  MNT7K2X9QP  ' }), 1, 20)
      expect(query.referenceNo).toBe('MNT7K2X9QP')
    })
  })

  describe('negative', () => {
    test('should drop an outcome the contract does not know instead of sending a 400', () => {
      const query = toDurianpayApiCallQuery(values({ outcome: 'NOPE' }), 1, 20)
      expect(query.outcome).toBeUndefined()
    })

    test('should drop a flavor the contract does not know', () => {
      expect(toDurianpayApiCallQuery(values({ apiFlavor: 'REST' }), 1, 20).apiFlavor).toBeUndefined()
    })

    test('should drop an httpStatus outside 100..599 and any non-integer shape', () => {
      expect(toDurianpayApiCallQuery(values({ httpStatus: '99' }), 1, 20).httpStatus).toBeUndefined()
      expect(toDurianpayApiCallQuery(values({ httpStatus: '600' }), 1, 20).httpStatus).toBeUndefined()
      expect(toDurianpayApiCallQuery(values({ httpStatus: '50x' }), 1, 20).httpStatus).toBeUndefined()
      expect(toDurianpayApiCallQuery(values({ httpStatus: '5.0' }), 1, 20).httpStatus).toBeUndefined()
    })

    test('should drop a text filter longer than its contract ceiling rather than truncate it', () => {
      // Memotongnya akan menjawab pertanyaan yang tidak pernah ditanyakan operator.
      expect(
        toDurianpayApiCallQuery(values({ path: 'x'.repeat(201) }), 1, 20).path,
      ).toBeUndefined()
      expect(
        toDurianpayApiCallQuery(values({ referenceNo: 'r'.repeat(201) }), 1, 20).referenceNo,
      ).toBeUndefined()
      expect(
        toDurianpayApiCallQuery(values({ responseCode: '5'.repeat(51) }), 1, 20).responseCode,
      ).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    test('should keep a text filter exactly at its ceiling', () => {
      expect(toDurianpayApiCallQuery(values({ path: 'x'.repeat(200) }), 1, 20).path).toHaveLength(
        200,
      )
      expect(
        toDurianpayApiCallQuery(values({ responseCode: '5'.repeat(50) }), 1, 20).responseCode,
      ).toHaveLength(50)
    })

    test('should treat a whitespace-only filter as no filter', () => {
      const query = toDurianpayApiCallQuery(values({ referenceNo: '   ' }), 1, 20)
      expect(query.referenceNo).toBeUndefined()
      expect(hasDurianpayFilter(query)).toBe(false)
    })
  })
})

describe('buildDurianpayApiCallQueryString', () => {
  describe('positive', () => {
    test('should always send page and take, and only the filters that survived', () => {
      const qs = buildDurianpayApiCallQueryString({
        page: 3,
        take: 20,
        outcome: 'REJECTED',
        httpStatus: 400,
      })
      const sp = new URLSearchParams(qs)
      expect(sp.get('page')).toBe('3')
      expect(sp.get('take')).toBe('20')
      expect(sp.get('outcome')).toBe('REJECTED')
      expect(sp.get('httpStatus')).toBe('400')
      expect(sp.has('path')).toBe(false)
      expect(sp.has('from')).toBe(false)
    })

    test('should never send a parameter the endpoint does not accept', () => {
      const sp = new URLSearchParams(buildDurianpayApiCallQueryString({ page: 1, take: 20 }))
      // Endpoint ini TIDAK punya pencarian teks bebas maupun urutan yang bisa dipilih.
      expect(sp.has('search')).toBe(false)
      expect(sp.has('sortBy')).toBe(false)
      expect(sp.has('startDate')).toBe(false)
      expect([...sp.keys()]).toEqual(['page', 'take'])
    })
  })

  describe('edge cases', () => {
    test('should send httpStatus 0 nowhere but a real status through', () => {
      const sp = new URLSearchParams(
        buildDurianpayApiCallQueryString({ page: 1, take: 20, httpStatus: 500 }),
      )
      expect(sp.get('httpStatus')).toBe('500')
    })
  })
})

describe('durianpayBodyView', () => {
  describe('positive', () => {
    test('should pretty-print a stored JSON body', () => {
      const view = durianpayBodyView({ responseCode: '2002700' })
      expect(view.kind).toBe('json')
      expect(view.kind === 'json' && view.text).toContain('"responseCode": "2002700"')
    })
  })

  describe('negative', () => {
    test('should report a truncated body AS truncated, with its original size', () => {
      // Merendernya sebagai JSON biasa akan menampilkan potongan seolah seluruh isinya.
      const view = durianpayBodyView({ _truncated: true, _bytes: 41233, _head: '{"error":"x"' })
      expect(view).toEqual({ kind: 'truncated', text: '{"error":"x"', bytes: 41233 })
    })

    test('should report a non-JSON reply as raw text', () => {
      const view = durianpayBodyView({ _raw: '<html>503</html>' })
      expect(view).toEqual({ kind: 'raw', text: '<html>503</html>' })
    })

    test('should report a missing body as none, not as an empty object', () => {
      expect(durianpayBodyView(null)).toEqual({ kind: 'none' })
    })
  })

  describe('edge cases', () => {
    test('should still report truncation when the marker fields are malformed', () => {
      const view = durianpayBodyView({ _truncated: true })
      expect(view).toEqual({ kind: 'truncated', text: '', bytes: null })
    })

    test('should not treat a falsy _truncated as truncation', () => {
      const view = durianpayBodyView({ _truncated: false, ok: 1 })
      expect(view.kind).toBe('json')
    })
  })
})

describe('hasRedactedValue', () => {
  describe('positive', () => {
    test('should spot both redaction marks', () => {
      expect(hasRedactedValue('{"accessToken":"[REDACTED:SECRET]"}')).toBe(true)
      expect(hasRedactedValue('{"virtualAccountName":"[REDACTED:PII]"}')).toBe(true)
    })
  })

  describe('negative', () => {
    test('should stay false for a body that kept every value', () => {
      expect(hasRedactedValue('{"virtualAccountNo":"89993203000000012345"}')).toBe(false)
    })
  })
})

describe('formatCallDuration / formatBodyBytes', () => {
  describe('positive', () => {
    test('should keep sub-second calls in milliseconds', () => {
      expect(formatCallDuration(412)).toBe('412 ms')
      expect(formatCallDuration(999)).toBe('999 ms')
    })

    test('should switch to Indonesian-spelled seconds from one second up', () => {
      expect(formatCallDuration(1000)).toBe('1,0 dtk')
      expect(formatCallDuration(9840)).toBe('9,8 dtk')
    })

    test('should spell body sizes the same way', () => {
      expect(formatBodyBytes(900)).toBe('900 byte')
      expect(formatBodyBytes(41233)).toBe('40,3 KiB')
    })
  })

  describe('edge cases', () => {
    test('should not print a number for a value that is not one', () => {
      expect(formatCallDuration(Number.NaN)).toBe('—')
      expect(formatCallDuration(-1)).toBe('—')
      expect(formatBodyBytes(Number.NaN)).toBe('—')
    })
  })
})

describe('isDurianpayOutcome / isDurianpayFlavor', () => {
  describe('positive', () => {
    test('should accept exactly the DB enum values', () => {
      expect(isDurianpayOutcome('SUCCESS')).toBe(true)
      expect(isDurianpayOutcome('REJECTED')).toBe(true)
      expect(isDurianpayOutcome('UNAVAILABLE')).toBe(true)
      expect(isDurianpayFlavor('SNAP')).toBe(true)
      expect(isDurianpayFlavor('LEGACY')).toBe(true)
    })
  })

  describe('negative', () => {
    test('should reject anything else, case included', () => {
      expect(isDurianpayOutcome('success')).toBe(false)
      expect(isDurianpayFlavor('snap')).toBe(false)
      expect(isDurianpayOutcome('')).toBe(false)
    })
  })
})

describe('durianpayApiCallErrorMessage', () => {
  describe('negative', () => {
    test('should name the roles the backend actually allows on 403', () => {
      const message = durianpayApiCallErrorMessage(new ApiError(403, 'FORBIDDEN', 'FORBIDDEN'))
      expect(message).toMatch(/Manager, Admin, dan Developer/)
    })

    test('should explain a 404 as a row that is gone, not as a broken screen', () => {
      const message = durianpayApiCallErrorMessage(
        new ApiError(404, 'NOT_FOUND', 'DURIANPAY_API_CALL_NOT_FOUND'),
      )
      expect(message).toMatch(/penyapu retensi/)
    })

    test('should say nothing changed on a 5xx — this screen writes nothing anyway', () => {
      expect(durianpayApiCallErrorMessage(new ApiError(502, 'BAD_GATEWAY', 'x'))).toMatch(
        /Tidak ada yang berubah/,
      )
    })
  })

  describe('edge cases', () => {
    test('should pass a 400 through, because it names what to fix', () => {
      expect(
        durianpayApiCallErrorMessage(
          new ApiError(400, 'BAD_REQUEST', 'Validation failed (uuid is expected)'),
        ),
      ).toBe('Validation failed (uuid is expected)')
    })

    test('should survive a non-ApiError', () => {
      expect(durianpayApiCallErrorMessage(new Error('boom'))).toBe('boom')
      expect(durianpayApiCallErrorMessage('boom')).toBe('Permintaan gagal.')
    })
  })
})
