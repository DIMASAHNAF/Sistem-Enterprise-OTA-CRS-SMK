import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { getDatabase } from '@/lib/db';
import { logAudit } from '@/lib/audit/logger';
import { Fleet, Wagon } from '@/lib/db/types';

const FleetSchema = z.object({
  code: z.string().trim().min(3, 'Kode armada minimal 3 karakter').max(15, 'Kode armada maksimal 15 karakter'),
  name: z.string().trim().min(3, 'Nama armada minimal 3 karakter'),
  type: z.enum(['TRAIN', 'BUS'], { errorMap: () => ({ message: 'Tipe armada harus TRAIN atau BUS' }) }),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']).default('ACTIVE'),
});

// GET /api/master/fleets
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'REVENUE_CONTROLLER')) {
      return NextResponse.json({ error: 'Akses ditolak: Memerlukan hak akses Admin/Revenue' }, { status: 403 });
    }

    const db = getDatabase();
    const fleets = db.prepare('SELECT * FROM fleets ORDER BY id ASC').all() as unknown as Fleet[];
    const wagons = db.prepare('SELECT * FROM wagons ORDER BY fleet_id ASC, id ASC').all() as unknown as Wagon[];

    const wagonsByFleet: Record<number, Wagon[]> = {};
    for (const w of wagons) {
      if (!wagonsByFleet[w.fleet_id]) wagonsByFleet[w.fleet_id] = [];
      wagonsByFleet[w.fleet_id].push(w);
    }

    const result = fleets.map((f) => ({
      ...f,
      wagons: wagonsByFleet[f.id] || [],
    }));

    return NextResponse.json({ success: true, fleets: result });
  } catch (error) {
    console.error('Get fleets error:', error);
    return NextResponse.json({ error: 'Gagal memuat data armada' }, { status: 500 });
  }
}

// POST /api/master/fleets (Create)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Akses ditolak: Hanya SUPER_ADMIN yang dapat menambah armada' }, { status: 403 });
    }

    const body = await request.json();
    const parse = FleetSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.errors[0].message }, { status: 400 });
    }

    const { code, name, type, status } = parse.data;
    const upperCode = code.toUpperCase();

    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM fleets WHERE UPPER(code) = ?').get(upperCode);
    if (existing) {
      return NextResponse.json({ error: `Kode armada '${upperCode}' sudah terdaftar.` }, { status: 400 });
    }

    const res = db.prepare(`
      INSERT INTO fleets (code, name, type, status)
      VALUES (?, ?, ?, ?)
    `).run(upperCode, name, type, status);

    const newId = Number(res.lastInsertRowid);

    logAudit({
      userId: user.id,
      action: 'FLEET_CREATE',
      targetId: String(newId),
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: { id: newId, code: upperCode, name, type, status },
    });

    return NextResponse.json({
      success: true,
      message: 'Armada berhasil ditambahkan',
      fleet: { id: newId, code: upperCode, name, type, status, wagons: [] },
    }, { status: 201 });
  } catch (error) {
    console.error('Create fleet error:', error);
    return NextResponse.json({ error: 'Gagal menambahkan armada' }, { status: 500 });
  }
}

// PUT /api/master/fleets (Update)
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Akses ditolak: Hanya SUPER_ADMIN yang dapat mengubah armada' }, { status: 403 });
    }

    const body = await request.json();
    const id = Number(body.id);
    if (!id) return NextResponse.json({ error: 'ID armada wajib disertakan' }, { status: 400 });

    const parse = FleetSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.errors[0].message }, { status: 400 });
    }

    const { code, name, type, status } = parse.data;
    const upperCode = code.toUpperCase();

    const db = getDatabase();
    const conflict = db.prepare('SELECT id FROM fleets WHERE UPPER(code) = ? AND id != ?').get(upperCode, id);
    if (conflict) {
      return NextResponse.json({ error: `Kode armada '${upperCode}' sudah digunakan oleh armada lain.` }, { status: 400 });
    }

    db.prepare(`
      UPDATE fleets
      SET code = ?, name = ?, type = ?, status = ?
      WHERE id = ?
    `).run(upperCode, name, type, status, id);

    logAudit({
      userId: user.id,
      action: 'FLEET_UPDATE',
      targetId: String(id),
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: { id, code: upperCode, name, type, status },
    });

    return NextResponse.json({ success: true, message: 'Armada berhasil diperbarui' });
  } catch (error) {
    console.error('Update fleet error:', error);
    return NextResponse.json({ error: 'Gagal memperbarui armada' }, { status: 500 });
  }
}

// DELETE /api/master/fleets (Delete)
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Akses ditolak: Hanya SUPER_ADMIN yang dapat menghapus armada' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'ID armada wajib disertakan' }, { status: 400 });

    const db = getDatabase();
    const routesCount = db.prepare('SELECT COUNT(*) as count FROM routes WHERE fleet_id = ?').get(id) as { count: number };
    if (routesCount.count > 0) {
      return NextResponse.json({
        error: `Armada tidak dapat dihapus karena masih digunakan pada ${routesCount.count} rute aktif.`,
      }, { status: 400 });
    }

    const existing = db.prepare('SELECT * FROM fleets WHERE id = ?').get(id) as Fleet | undefined;
    if (!existing) return NextResponse.json({ error: 'Armada tidak ditemukan' }, { status: 404 });

    db.prepare('DELETE FROM fleets WHERE id = ?').run(id);

    logAudit({
      userId: user.id,
      action: 'FLEET_DELETE',
      targetId: String(id),
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: { id, code: existing.code, name: existing.name },
    });

    return NextResponse.json({ success: true, message: `Armada ${existing.name} berhasil dihapus.` });
  } catch (error) {
    console.error('Delete fleet error:', error);
    return NextResponse.json({ error: 'Gagal menghapus armada' }, { status: 500 });
  }
}
