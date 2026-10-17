import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit/logger';

export const dynamic = 'force-dynamic';

const CheckpointUpdateSchema = z.object({
  checkpoint_num: z.number().int().min(1).max(3),
  status: z.union([z.number().int().min(0).max(1), z.enum(['PENDING', 'PRESENT'])]),
});

interface Props {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const user = await getCurrentUser();
    if (
      !user ||
      (user.role !== 'TOUR_PLANNER' &&
        user.role !== 'SUPER_ADMIN' &&
        user.role !== 'BOARDING_OFFICER')
    ) {
      return NextResponse.json(
        { error: 'Akses ditolak: Hanya Tour Leader, Boarding Officer, atau Tour Planner yang dapat mengabsen peserta.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const manifestId = parseInt(id, 10);
    if (isNaN(manifestId)) {
      return NextResponse.json({ error: 'ID manifest tidak valid.' }, { status: 400 });
    }

    const body = await request.json();
    const parse = CheckpointUpdateSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.errors[0].message }, { status: 400 });
    }

    const { checkpoint_num, status } = parse.data;
    const numericStatus = status === 'PRESENT' || status === 1 ? 1 : 0;
    const colName = `checkpoint_${checkpoint_num}_status`;

    const db = getDatabase();
    const existing = db.prepare(`
      SELECT tm.*, u.name as participant_name
      FROM tour_manifests tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.id = ?
    `).get(manifestId) as Record<string, any> | undefined;

    if (!existing) {
      return NextResponse.json({ error: 'Data manifest peserta tidak ditemukan.' }, { status: 404 });
    }

    db.prepare(`UPDATE tour_manifests SET ${colName} = ? WHERE id = ?`).run(numericStatus, manifestId);

    // Audit log
    logAudit({
      userId: user.id,
      action: 'TOUR_CHECKPOINT_UPDATE',
      targetId: manifestId,
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: {
        manifestId,
        participantName: existing.participant_name,
        bus_name: existing.bus_name,
        seat_number: existing.seat_number,
        checkpoint_num,
        status: numericStatus === 1 ? 'PRESENT' : 'PENDING',
        officer: user.name,
      },
    });

    const updated = db.prepare(`
      SELECT tm.*, u.name as participant_name
      FROM tour_manifests tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.id = ?
    `).get(manifestId);

    return NextResponse.json({
      message: `Status Checkpoint ${checkpoint_num} berhasil diperbarui menjadi ${numericStatus === 1 ? 'HADIR (PRESENT)' : 'BELUM HADIR (PENDING)'}.`,
      manifest: updated,
    });
  } catch (error) {
    console.error('Error updating checkpoint:', error);
    return NextResponse.json({ error: 'Gagal memperbarui status checkpoint.' }, { status: 500 });
  }
}
