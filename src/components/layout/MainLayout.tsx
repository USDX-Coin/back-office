import { Outlet } from 'react-router'
import {
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar'
import AppSidebar from './AppSidebar'
import Navbar from './Navbar'

export default function MainLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      {/*
        min-w-0 is load-bearing: SidebarInset is a flex-1 child of
        SidebarProvider's flex row. Without min-w-0 its default
        min-width:auto won't shrink past intrinsic content size, and
        a wide table pushes the whole page horizontally.
      */}
      <SidebarInset className="min-w-0">
        <Navbar />
        <div className="min-w-0 flex-1 overflow-y-auto p-6 lg:p-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
