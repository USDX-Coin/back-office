import { Outlet } from 'react-router'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:p-8 lg:pb-8">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
