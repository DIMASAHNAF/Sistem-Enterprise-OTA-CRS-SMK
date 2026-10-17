import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { BackofficeSidebar } from '@/components/layout/BackofficeSidebar';
import { BackofficeHeader } from '@/components/layout/BackofficeHeader';

export default async function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?redirect=/backoffice');
  }

  if (user.role === 'CUSTOMER') {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* Dense, Role-Aware Operational Sidebar */}
      <BackofficeSidebar userRole={user.role} userName={user.name} />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <BackofficeHeader
          userRole={user.role}
          userName={user.name}
          userEmail={user.email}
        />
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
