import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { getDatabase } from '@/lib/db';
import { logAudit } from '@/lib/audit/logger';

const WagonSchema = z.object({
  wagon_code: z.string().trim().min(2, 'Kode gerbong minimal 2 karakter'),
  class: z.enum(['EXECUTIVE', 'BUSINESS', 'ECONOMY'], {
    errorMap: () => ({ message: 'Kelas gerbong harus EXECUTIVE, BUSINESS, atau ECONOMY' }),
  }),
  rows: z.number().int().min(1, 'Jumlah baris minimal 1').max(40, 'Jumlah baris maksimal 40'),
  cols_layout: z.enum(['2-2', '3-2', '2-1'], {
    errorMap: () => ({ message: 'Layout kolom harus 2-2, 3-2, atau 2-1' }),
  }),
  direction_indicator: z.enum(['FORWARD', 'BACKWARD', 'FACING']).default('FORWARD'),
});

// GET /api/master/fleets/[id]/wagons
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fleetId = Number(id);
    const db = getDatabase();
    const wagons = db.prepare('SELECT * FROM wagons WHERE fleet_id = ? ORDER BY id ASC').all(fleetId);
    return NextResponse.json({ success: true, wagons });
  } catch (error) {
    console.error('Get wagons error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data gerbong' }, { status: 500 });
  }
}

// POST /api/master/fleets/[id]/wagons
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Akses ditolak: Hanya SUPER_ADMIN yang dapat menambah gerbong' }, { status: 403 });
    }

    const { id } = await params;
    const fleetId = Number(id);
    if (!fleetId) return NextResponse.json({ error: 'Fleet ID tidak valid' }, { status: 400 });

    const body = await request.json();
    const parse = WagonSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.errors[0].message }, { status: 400 });
    }

    const { wagon_code, class: wClass, rows, cols_layout, direction_indicator } = parse.data;
    const upperWagonCode = wagon_code.toUpperCase();

    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM wagons WHERE fleet_id = ? AND UPPER(wagon_code) = ?').get(fleetId, upperWagonCode);
    if (existing) {
      return NextResponse.json({ error: `Kode gerbong '${upperWagonCode}' sudah ada pada armada ini.` }, { status: 400 });
    }

    const res = db.prepare(`
      INSERT INTO wagons (fleet_id, wagon_code, class, rows, cols_layout, direction_indicator)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(fleetId, upperWagonCode, wClass, rows, cols_layout, direction_indicator);

    const newId = Number(res.lastInsertRowid);

    logAudit({
      userId: user.id,
      action: 'WAGON_CREATE',
      targetId: String(newId),
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: { id: newId, fleetId, wagon_code: upperWagonCode, class: wClass, rows, cols_layout },
    });

    return NextResponse.json({
      success: true,
      message: 'Gerbong berhasil ditambahkan',
      wagon: { id: newId, fleet_id: fleetId, wagon_code: upperWagonCode, class: wClass, rows, cols_layout, direction_indicator },
    }, { status: 201 });
  } catch (error) {
    console.error('Create wagon error:', error);
    return NextResponse.json({ error: 'Gagal menambahkan gerbong' }, { status: 500 });
  }
}

// PUT /api/master/fleets/[id]/wagons
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Akses ditolak: Hanya SUPER_ADMIN yang dapat mengubah gerbong' }, { status: 403 });
    }

    const { id } = await params;
    const fleetId = Number(id);
    const body = await request.json();
    const wagonId = Number(body.id);
    if (!wagonId) return NextResponse.json({ error: 'Wagon ID wajib disertakan' }, { status: 400 });

    const parse = WagonSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.errors[0].message }, { status: 400 });
    }

    const { wagon_code, class: wClass, rows, cols_layout, direction_indicator } = parse.data;
    const upperWagonCode = wagon_code.toUpperCase();

    const db = getDatabase();
    const conflict = db.prepare('SELECT id FROM wagons WHERE fleet_id = ? AND UPPER(wagon_code) = ? AND id != ?').get(fleetId, upperWagonCode, wagonId);
    if (conflict) {
      return NextResponse.json({ error: `Kode gerbong '${upperWagonCode}' sudah digunakan di armada ini.` }, { status: 400 });
    }

    db.prepare(`
      UPDATE wagons
      SET wagon_code = ?, class = ?, rows = ?, cols_layout = ?, direction_indicator = ?
      WHERE id = ? AND fleet_id = ?
    `).run(upperWagonCode, wClass, rows, cols_layout, direction_indicator, wagonId, fleetId);

    logAudit({
      userId: user.id,
      action: 'WAGON_UPDATE',
      targetId: String(wagonId),
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: { wagonId, fleetId, wagon_code: upperWagonCode, class: wClass, rows, cols_layout },
    });

    return NextResponse.json({ success: true, message: 'Gerbong berhasil diperbarui' });
  } catch (error) {
    console.error('Update wagon error:', error);
    return NextResponse.json({ error: 'Gagal memperbarui gerbong' }, { status: 500 });
  }
}

// DELETE /api/master/fleets/[id]/wagons
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Akses ditolak: Hanya SUPER_ADMIN yang dapat menghapus gerbong' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const wagonId = Number(searchParams.get('wagon_id'));
    if (!wagonId) return NextResponse.json({ error: 'Wagon ID wajib disertakan' }, { status: 400 });

    const db = getDatabase();
    const booked = db.prepare('SELECT COUNT(*) as count FROM booking_passengers WHERE wagon_id = ?').get(wagonId) as { count: number };
    if (booked.count > 0) {
      return NextResponse.json({
        error: `Gerbong tidak dapat dihapus karena sudah memiliki ${booked.count} reservasi kursi penumpang.`,
      }, { status: 400 });
    }

    db.prepare('DELETE FROM wagons WHERE id = ?').run(wagonId);

    logAudit({
      userId: user.id,
      action: 'WAGON_DELETE',
      targetId: String(wagonId),
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: { wagonId },
    });

    return NextResponse.json({ success: true, message: 'Gerbong berhasil dihapus' });
  } catch (error) {
    console.error('Delete wagon error:', error);
    return NextResponse.json({ error: 'Gagal menghapus gerbong' }, { status: 500 });
  }
}
