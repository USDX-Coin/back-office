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
        <main className="flex-1 overflow-y-auto p-6 pb-20 lg:p-8 lg:pb-8">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
