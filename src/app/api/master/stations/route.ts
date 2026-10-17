import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { getDatabase } from '@/lib/db';
import { logAudit } from '@/lib/audit/logger';
import { Station } from '@/lib/db/types';

const StationSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, 'Kode stasiun wajib 3 karakter')
    .max(3, 'Kode stasiun wajib 3 karakter')
    .regex(/^[A-Za-z]{3}$/, 'Kode stasiun harus berupa 3 huruf alfabet'),
  name: z.string().trim().min(3, 'Nama stasiun minimal 3 karakter'),
  city: z.string().trim().min(2, 'Kota/wilayah minimal 2 karakter'),
  type: z.enum(['TRAIN_STATION', 'BUS_TERMINAL', 'MEETING_POINT'], {
    errorMap: () => ({ message: 'Tipe simpul tidak valid' }),
  }),
});

// GET /api/master/stations
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'REVENUE_CONTROLLER')) {
      return NextResponse.json({ error: 'Akses ditolak: Memerlukan hak akses Admin/Revenue' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const search = searchParams.get('search')?.trim().toLowerCase();

    const db = getDatabase();
    let query = 'SELECT * FROM stations WHERE 1=1';
    const params: (string | number)[] = [];

    if (type && ['TRAIN_STATION', 'BUS_TERMINAL', 'MEETING_POINT'].includes(type)) {
      query += ' AND type = ?';
      params.push(type);
    }

    if (search) {
      query += ' AND (LOWER(code) LIKE ? OR LOWER(name) LIKE ? OR LOWER(city) LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY type ASC, name ASC';

    const stations = db.prepare(query).all(...params) as unknown as Station[];
    return NextResponse.json({ success: true, stations });
  } catch (error) {
    console.error('Fetch stations error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data stasiun' }, { status: 500 });
  }
}

// POST /api/master/stations (Create)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Akses ditolak: Hanya SUPER_ADMIN yang dapat menambah stasiun' }, { status: 403 });
    }

    const body = await request.json();
    const parseResult = StationSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0].message },
        { status: 400 }
      );
    }

    const { code, name, city, type } = parseResult.data;
    const upperCode = code.toUpperCase();

    const db = getDatabase();
    // Check duplicate code
    const existing = db.prepare('SELECT id FROM stations WHERE UPPER(code) = ?').get(upperCode);
    if (existing) {
      return NextResponse.json(
        { error: `Kode stasiun '${upperCode}' sudah terdaftar dalam sistem.` },
        { status: 400 }
      );
    }

    const insert = db.prepare(`
      INSERT INTO stations (code, name, city, type)
      VALUES (?, ?, ?, ?)
    `);
    const result = insert.run(upperCode, name, city, type);
    const newId = Number(result.lastInsertRowid);

    logAudit({
      userId: user.id,
      action: 'STATION_CREATE',
      targetId: String(newId),
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: { code: upperCode, name, city, type },
    });

    return NextResponse.json({
      success: true,
      message: 'Stasiun berhasil ditambahkan',
      station: { id: newId, code: upperCode, name, city, type },
    }, { status: 201 });
  } catch (error) {
    console.error('Create station error:', error);
    return NextResponse.json({ error: 'Gagal menambahkan stasiun baru' }, { status: 500 });
  }
}

// PUT /api/master/stations (Update)
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Akses ditolak: Hanya SUPER_ADMIN yang dapat mengedit stasiun' }, { status: 403 });
    }

    const body = await request.json();
    const id = Number(body.id);
    if (!id) {
      return NextResponse.json({ error: 'ID stasiun wajib disertakan' }, { status: 400 });
    }

    const parseResult = StationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0].message },
        { status: 400 }
      );
    }

    const { code, name, city, type } = parseResult.data;
    const upperCode = code.toUpperCase();

    const db = getDatabase();
    // Check if code taken by another station
    const conflict = db.prepare('SELECT id FROM stations WHERE UPPER(code) = ? AND id != ?').get(upperCode, id);
    if (conflict) {
      return NextResponse.json(
        { error: `Kode stasiun '${upperCode}' sudah digunakan oleh stasiun lain.` },
        { status: 400 }
      );
    }

    const update = db.prepare(`
      UPDATE stations
      SET code = ?, name = ?, city = ?, type = ?
      WHERE id = ?
    `);
    update.run(upperCode, name, city, type, id);

    logAudit({
      userId: user.id,
      action: 'STATION_UPDATE',
      targetId: String(id),
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: { id, code: upperCode, name, city, type },
    });

    return NextResponse.json({
      success: true,
      message: 'Data stasiun berhasil diperbarui',
    });
  } catch (error) {
    console.error('Update station error:', error);
    return NextResponse.json({ error: 'Gagal memperbarui data stasiun' }, { status: 500 });
  }
}

// DELETE /api/master/stations (Delete with reference guard)
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Akses ditolak: Hanya SUPER_ADMIN yang dapat menghapus stasiun' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    if (!id) {
      return NextResponse.json({ error: 'ID stasiun wajib disertakan' }, { status: 400 });
    }

    const db = getDatabase();

    // Check references in route_stops, schedule_fares, booking_segments
    const inRoute = db.prepare('SELECT COUNT(*) as count FROM route_stops WHERE station_id = ?').get(id) as { count: number };
    const inFares = db.prepare('SELECT COUNT(*) as count FROM schedule_fares WHERE origin_station_id = ? OR destination_station_id = ?').get(id, id) as { count: number };
    const inBooking = db.prepare('SELECT COUNT(*) as count FROM booking_segments WHERE origin_station_id = ? OR destination_station_id = ?').get(id, id) as { count: number };

    if (inRoute.count > 0 || inFares.count > 0 || inBooking.count > 0) {
      return NextResponse.json(
        {
          error: `Stasiun tidak dapat dihapus karena masih terhubung ke ${inRoute.count} pemberhentian rute dan ${inFares.count} jadwal tarif aktif.`,
        },
        { status: 400 }
      );
    }

    const existing = db.prepare('SELECT * FROM stations WHERE id = ?').get(id) as Station | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Stasiun tidak ditemukan' }, { status: 404 });
    }

    db.prepare('DELETE FROM stations WHERE id = ?').run(id);

    logAudit({
      userId: user.id,
      action: 'STATION_DELETE',
      targetId: String(id),
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: { id, code: existing.code, name: existing.name },
    });

    return NextResponse.json({
      success: true,
      message: `Stasiun ${existing.code} - ${existing.name} berhasil dihapus.`,
    });
  } catch (error) {
    console.error('Delete station error:', error);
    return NextResponse.json({ error: 'Gagal menghapus stasiun' }, { status: 500 });
  }
}
