import { Outlet } from 'react-router'
import MintTestModeBanner from '@/features/mint-mode/MintTestModeBanner'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

export default function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar />
        {/* USDX-639 — banner mode uji mint. Di sini, di atas <main>, supaya ia
            muncul di SEMUA halaman dan bertahan melewati pergantian rute:
            MainLayout tidak di-unmount saat <Outlet /> berganti. */}
        <MintTestModeBanner />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
