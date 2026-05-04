import type { User } from '@/stores/auth-store'

type AuthRecord = User & { password: string }

export const db = {
  users: [
    {
      id: 'usr_admin_1',
      email: 'admin@usdx.id',
      password: 'admin123',
      name: 'Admin USDX',
      role: 'admin',
    },
  ] as AuthRecord[],
}
