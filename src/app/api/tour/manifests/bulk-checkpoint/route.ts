import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit/logger';

export const dynamic = 'force-dynamic';

const BulkCheckpointSchema = z.object({
  tour_package_id: z.number().int().min(1),
  bus_name: z.string().trim().min(1),
  checkpoint_num: z.number().int().min(1).max(3),
  status: z.union([z.number().int().min(0).max(1), z.enum(['PENDING', 'PRESENT'])]),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (
      !user ||
      (user.role !== 'TOUR_PLANNER' &&
        user.role !== 'SUPER_ADMIN' &&
        user.role !== 'BOARDING_OFFICER')
    ) {
      return NextResponse.json(
        { error: 'Akses ditolak: Hanya Tour Leader, Boarding Officer, atau Tour Planner yang dapat mengabsen rombongan.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parse = BulkCheckpointSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.errors[0].message }, { status: 400 });
    }

    const { tour_package_id, bus_name, checkpoint_num, status } = parse.data;
    const numericStatus = status === 'PRESENT' || status === 1 ? 1 : 0;
    const colName = `checkpoint_${checkpoint_num}_status`;

    const db = getDatabase();

    const updateStmt = db.prepare(`
      UPDATE tour_manifests
      SET ${colName} = ?
      WHERE tour_package_id = ? AND bus_name = ?
    `);

    const result = updateStmt.run(numericStatus, tour_package_id, bus_name);

    // Audit log
    logAudit({
      userId: user.id,
      action: 'TOUR_CHECKPOINT_UPDATE',
      targetId: tour_package_id,
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: {
        type: 'BULK_UPDATE',
        tour_package_id,
        bus_name,
        checkpoint_num,
        status: numericStatus === 1 ? 'PRESENT' : 'PENDING',
        affected_count: result.changes,
        officer: user.name,
      },
    });

    return NextResponse.json({
      message: `Berhasil memperbarui ${result.changes} siswa di ${bus_name} pada Checkpoint ${checkpoint_num} menjadi ${numericStatus === 1 ? 'HADIR' : 'PENDING'}.`,
      affected_count: result.changes,
    });
  } catch (error) {
    console.error('Error bulk updating checkpoint:', error);
    return NextResponse.json({ error: 'Gagal memperbarui absen rombongan bus.' }, { status: 500 });
  }
}
