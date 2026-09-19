import SectionTabs from '@/components/SectionTabs'
import { REPORT_TABS } from './reportTabDefs'

export default function ReportTabs() {
  return <SectionTabs tabs={REPORT_TABS} ariaLabel="Jenis laporan" />
}
