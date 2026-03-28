import { useState } from 'react'
import { Outlet } from 'react-router'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <Navbar onToggleSidebar={() => setSidebarOpen((o) => !o)} />
      <div className="flex pt-16 min-h-[calc(100vh-4rem)]">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 p-4 lg:p-6 min-h-full">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
