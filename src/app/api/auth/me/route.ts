import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { ROLE_CONFIGS } from '@/lib/auth/rbac';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const roleConfig = ROLE_CONFIGS[user.role];

    return NextResponse.json({
      authenticated: true,
      user: {
        ...user,
        roleTitle: roleConfig?.title ?? user.role,
        badgeLabel: roleConfig?.badgeLabel ?? user.role,
      },
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ authenticated: false, user: null }, { status: 500 });
  }
}
