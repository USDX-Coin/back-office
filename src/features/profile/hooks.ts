import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { OtcMintTransaction, OtcRedeemTransaction, Staff } from '@/lib/types'

export interface ProfileResponse {
  staff: Staff
  recentActivity: Array<OtcMintTransaction | OtcRedeemTransaction>
}

export function useProfile(staffId: string | undefined) {
  return useQuery({
    queryKey: ['profile', staffId],
    enabled: Boolean(staffId),
    queryFn: async () => {
      const res = await fetch(`/api/profile/${staffId}`)
      if (!res.ok) throw new Error('Failed to fetch profile')
      return res.json() as Promise<ProfileResponse>
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Staff> }) => {
      const res = await fetch(`/api/profile/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input.patch),
      })
      if (!res.ok) throw new Error('Failed to update profile')
      return res.json() as Promise<Staff>
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      qc.invalidateQueries({ queryKey: ['staff'] })
    },
  })
}
