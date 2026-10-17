import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit/logger';

export const dynamic = 'force-dynamic';

const AssignManifestSchema = z.object({
  tour_package_id: z.number().int().min(1, 'ID Paket Wisata wajib disertakan'),
  user_id: z.number().int().min(1, 'Peserta / Siswa wajib dipilih'),
  bus_name: z.string().trim().min(2, 'Nama bus wajib diisi (mis: Bus 1 - Jetbus 5)'),
  seat_number: z.string().trim().min(1, 'Nomor kursi bus wajib diisi (mis: 1A)'),
  room_number: z.string().trim().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const packageIdParam = searchParams.get('tour_package_id');

    if (!packageIdParam) {
      return NextResponse.json({ error: 'Parameter tour_package_id wajib disertakan.' }, { status: 400 });
    }

    const packageId = parseInt(packageIdParam, 10);
    const db = getDatabase();

    const manifests = db.prepare(`
      SELECT 
        tm.id,
        tm.tour_package_id,
        tm.bus_name,
        tm.seat_number,
        tm.room_number,
        tm.user_id,
        tm.checkpoint_1_status,
        tm.checkpoint_2_status,
        tm.checkpoint_3_status,
        tm.created_at,
        u.name as user_name,
        u.identity_number as user_identity,
        u.email as user_email,
        u.phone as user_phone
      FROM tour_manifests tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.tour_package_id = ?
      ORDER BY tm.bus_name ASC, tm.seat_number ASC
    `).all(packageId) as Array<Record<string, any>>;

    // Aggregations per bus
    const busSummaryMap: Record<string, any> = {};
    const roomSummaryMap: Record<string, any> = {};

    for (const m of manifests) {
      // Per bus
      if (!busSummaryMap[m.bus_name]) {
        busSummaryMap[m.bus_name] = {
          bus_name: m.bus_name,
          total_pax: 0,
          cp1_present: 0,
          cp2_present: 0,
          cp3_present: 0,
          absent_cp1: [],
          absent_cp2: [],
          absent_cp3: [],
        };
      }
      const b = busSummaryMap[m.bus_name];
      b.total_pax += 1;
      if (m.checkpoint_1_status === 1) b.cp1_present += 1;
      else b.absent_cp1.push(m.user_name);

      if (m.checkpoint_2_status === 1) b.cp2_present += 1;
      else b.absent_cp2.push(m.user_name);

      if (m.checkpoint_3_status === 1) b.cp3_present += 1;
      else b.absent_cp3.push(m.user_name);

      // Per room
      const rNum = m.room_number ? m.room_number.trim() : 'Belum Ditentukan';
      if (!roomSummaryMap[rNum]) {
        roomSummaryMap[rNum] = {
          room_number: rNum,
          occupants: [],
        };
      }
      roomSummaryMap[rNum].occupants.push({
        id: m.id,
        user_name: m.user_name,
        user_identity: m.user_identity,
        bus_name: m.bus_name,
        seat_number: m.seat_number,
      });
    }

    const formattedManifests = manifests.map((m) => ({
      ...m,
      cp1_label: m.checkpoint_1_status === 1 ? 'PRESENT' : 'PENDING',
      cp2_label: m.checkpoint_2_status === 1 ? 'PRESENT' : 'PENDING',
      cp3_label: m.checkpoint_3_status === 1 ? 'PRESENT' : 'PENDING',
    }));

    return NextResponse.json({
      manifests: formattedManifests,
      bus_summary: Object.values(busSummaryMap),
      room_summary: Object.values(roomSummaryMap),
    });
  } catch (error) {
    console.error('Error fetching manifests:', error);
    return NextResponse.json({ error: 'Gagal memuat manifest tour.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'TOUR_PLANNER' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { error: 'Akses ditolak: Hanya Tour Planner atau Super Admin yang dapat mengalokasikan kursi & kamar bus.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parse = AssignManifestSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.errors[0].message }, { status: 400 });
    }

    const { tour_package_id, user_id, bus_name, seat_number, room_number } = parse.data;
    const db = getDatabase();

    // Verify package exists
    const pkg = db.prepare('SELECT id, title FROM tour_packages WHERE id = ?').get(tour_package_id) as Record<string, any> | undefined;
    if (!pkg) {
      return NextResponse.json({ error: 'Paket wisata tidak ditemukan.' }, { status: 404 });
    }

    // Verify user exists
    const targetUser = db.prepare('SELECT id, name FROM users WHERE id = ?').get(user_id) as Record<string, any> | undefined;
    if (!targetUser) {
      return NextResponse.json({ error: 'Peserta / User tidak ditemukan.' }, { status: 404 });
    }

    // Check if user is already assigned in this package
    const existingUserManifest = db.prepare(`
      SELECT id, bus_name, seat_number FROM tour_manifests
      WHERE tour_package_id = ? AND user_id = ?
    `).get(tour_package_id, user_id) as Record<string, any> | undefined;

    if (existingUserManifest) {
      return NextResponse.json(
        { error: `Peserta ${targetUser.name} sudah terdaftar di ${existingUserManifest.bus_name} Kursi ${existingUserManifest.seat_number}. Hapus atau ubah alokasi sebelumnya terlebih dahulu.` },
        { status: 409 }
      );
    }

    // Anti-Double-Seat on the same bus in this package
    const existingSeat = db.prepare(`
      SELECT tm.id, u.name as occupant_name
      FROM tour_manifests tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.tour_package_id = ? AND tm.bus_name = ? AND tm.seat_number = ?
    `).get(tour_package_id, bus_name, seat_number) as Record<string, any> | undefined;

    if (existingSeat) {
      return NextResponse.json(
        { error: `Kursi ${seat_number} pada ${bus_name} sudah ditempati oleh ${existingSeat.occupant_name}!` },
        { status: 409 }
      );
    }

    // Insert manifest
    const insertStmt = db.prepare(`
      INSERT INTO tour_manifests (
        tour_package_id,
        bus_name,
        seat_number,
        room_number,
        user_id,
        checkpoint_1_status,
        checkpoint_2_status,
        checkpoint_3_status
      ) VALUES (?, ?, ?, ?, ?, 0, 0, 0)
    `);

    const result = insertStmt.run(
      tour_package_id,
      bus_name,
      seat_number,
      room_number ? room_number.trim() : null,
      user_id
    );

    const newId = Number(result.lastInsertRowid);

    // Audit log
    logAudit({
      userId: user.id,
      action: 'TOUR_MANIFEST_ASSIGN',
      targetId: newId,
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: {
        manifestId: newId,
        packageId: tour_package_id,
        packageTitle: pkg.title,
        participantName: targetUser.name,
        bus_name,
        seat_number,
        room_number: room_number || null,
        assignedBy: user.name,
      },
    });

    const created = db.prepare(`
      SELECT tm.*, u.name as user_name, u.identity_number as user_identity
      FROM tour_manifests tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.id = ?
    `).get(newId);

    return NextResponse.json(
      { message: 'Peserta berhasil dialokasikan ke bus dan kamar.', manifest: created },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.message?.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { error: 'Kursi pada bus tersebut sudah terisi oleh peserta lain (Unique Constraint).' },
        { status: 409 }
      );
    }
    console.error('Error assigning manifest:', error);
    return NextResponse.json({ error: 'Gagal mengalokasikan peserta ke manifest.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'TOUR_PLANNER' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { error: 'Akses ditolak: Hanya Tour Planner atau Super Admin yang dapat menghapus alokasi peserta.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const manifestId = searchParams.get('manifest_id');
    if (!manifestId) {
      return NextResponse.json({ error: 'ID manifest wajib disertakan.' }, { status: 400 });
    }

    const db = getDatabase();
    db.prepare('DELETE FROM tour_manifests WHERE id = ?').run(parseInt(manifestId, 10));

    return NextResponse.json({ message: 'Alokasi peserta berhasil dihapus dari manifest.' });
  } catch (error) {
    console.error('Error deleting manifest:', error);
    return NextResponse.json({ error: 'Gagal menghapus manifest.' }, { status: 500 });
  }
}
