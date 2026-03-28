import { Outlet } from 'react-router'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function MainLayout() {
  return (
    <div className="h-screen overflow-hidden bg-background">
      <Navbar />
      <div className="flex h-[calc(100vh-4rem)] mt-16">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
