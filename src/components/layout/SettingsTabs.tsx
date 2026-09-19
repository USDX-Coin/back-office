import SectionTabs from '@/components/SectionTabs'
import { useAuth } from '@/lib/auth'
import { settingsTabsFor } from './settingsTabDefs'

export default function SettingsTabs() {
  const { user } = useAuth()
  return <SectionTabs tabs={settingsTabsFor(user)} ariaLabel="Halaman pengaturan" />
}
