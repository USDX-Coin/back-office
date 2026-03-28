import { useState } from 'react'
import { Outlet } from 'react-router'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="h-screen overflow-hidden bg-background">
      <Navbar onToggleSidebar={() => setSidebarOpen((o) => !o)} />
      <div className="flex h-[calc(100vh-4rem)] mt-16">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
