import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const ItinerarySchema = z.object({
  day_number: z.number().int().min(1, 'Nomor hari minimal 1'),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Format jam harus HH:MM'),
  activity_title: z.string().trim().min(3, 'Judul aktivitas minimal 3 karakter'),
  location: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params;
    const pkgId = parseInt(id, 10);
    if (isNaN(pkgId)) {
      return NextResponse.json({ error: 'ID paket tidak valid.' }, { status: 400 });
    }

    const db = getDatabase();
    const itineraries = db.prepare(`
      SELECT * FROM tour_itineraries
      WHERE tour_package_id = ?
      ORDER BY day_number ASC, start_time ASC
    `).all(pkgId);

    return NextResponse.json({ itineraries });
  } catch (error) {
    console.error('Error fetching itineraries:', error);
    return NextResponse.json({ error: 'Gagal mengambil jadwal itinerary.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'TOUR_PLANNER' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { error: 'Akses ditolak: Hanya Tour Planner atau Super Admin yang dapat menambahkan jadwal itinerary.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const pkgId = parseInt(id, 10);
    if (isNaN(pkgId)) {
      return NextResponse.json({ error: 'ID paket tidak valid.' }, { status: 400 });
    }

    const db = getDatabase();
    const pkg = db.prepare('SELECT id FROM tour_packages WHERE id = ?').get(pkgId);
    if (!pkg) {
      return NextResponse.json({ error: 'Paket wisata tidak ditemukan.' }, { status: 404 });
    }

    const body = await request.json();
    const parse = ItinerarySchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.errors[0].message }, { status: 400 });
    }

    const { day_number, start_time, activity_title, location, description } = parse.data;

    const stmt = db.prepare(`
      INSERT INTO tour_itineraries (
        tour_package_id,
        day_number,
        start_time,
        activity_title,
        location,
        description
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      pkgId,
      day_number,
      start_time,
      activity_title,
      location || null,
      description || null
    );

    const inserted = db.prepare('SELECT * FROM tour_itineraries WHERE id = ?').get(result.lastInsertRowid);

    return NextResponse.json(
      { message: 'Jadwal itinerary berhasil ditambahkan.', itinerary: inserted },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding itinerary:', error);
    return NextResponse.json({ error: 'Gagal menambahkan jadwal itinerary.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'TOUR_PLANNER' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { error: 'Akses ditolak: Hanya Tour Planner atau Super Admin yang dapat menghapus jadwal itinerary.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const itineraryId = searchParams.get('itinerary_id');
    if (!itineraryId) {
      return NextResponse.json({ error: 'ID itinerary wajib disertakan.' }, { status: 400 });
    }

    const db = getDatabase();
    db.prepare('DELETE FROM tour_itineraries WHERE id = ?').run(parseInt(itineraryId, 10));

    return NextResponse.json({ message: 'Jadwal itinerary berhasil dihapus.' });
  } catch (error) {
    console.error('Error deleting itinerary:', error);
    return NextResponse.json({ error: 'Gagal menghapus jadwal itinerary.' }, { status: 500 });
  }
}
