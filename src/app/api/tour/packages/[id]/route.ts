import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit/logger';

export const dynamic = 'force-dynamic';

const CostItemSchema = z.object({
  item: z.string().trim().min(1),
  cost: z.number().min(0),
  category: z.string().optional().default('General'),
});

const UpdateTourPackageSchema = z.object({
  title: z.string().trim().min(3).optional(),
  destination: z.string().trim().min(2).optional(),
  duration_days: z.number().int().min(1).optional(),
  min_pax: z.number().int().min(1).optional(),
  free_pax: z.number().int().min(0).optional(),
  margin_percentage: z.number().min(0).max(100).optional(),
  fixed_costs: z.array(CostItemSchema).optional(),
  variable_costs: z.array(CostItemSchema).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PUBLISHED', 'ARCHIVED']).optional(),
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
    const pkg = db.prepare('SELECT * FROM tour_packages WHERE id = ?').get(pkgId) as Record<string, any> | undefined;

    if (!pkg) {
      return NextResponse.json({ error: 'Paket wisata tidak ditemukan.' }, { status: 404 });
    }

    let costing: any = null;
    try {
      costing = JSON.parse(pkg.costing_json);
    } catch {
      costing = null;
    }

    const itineraries = db.prepare(`
      SELECT * FROM tour_itineraries
      WHERE tour_package_id = ?
      ORDER BY day_number ASC, start_time ASC
    `).all(pkgId);

    const manifestsCount = db.prepare(`
      SELECT COUNT(*) as c FROM tour_manifests WHERE tour_package_id = ?
    `).get(pkgId) as { c: number };

    return NextResponse.json({
      package: {
        ...pkg,
        costing,
        itineraries,
        manifests_count: manifestsCount?.c || 0,
      },
    });
  } catch (error) {
    console.error('Error getting tour package detail:', error);
    return NextResponse.json({ error: 'Gagal memuat detail paket wisata.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Props) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'TOUR_PLANNER' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { error: 'Akses ditolak: Hanya Tour Planner atau Super Admin yang dapat memperbarui paket wisata.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const pkgId = parseInt(id, 10);
    if (isNaN(pkgId)) {
      return NextResponse.json({ error: 'ID paket tidak valid.' }, { status: 400 });
    }

    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM tour_packages WHERE id = ?').get(pkgId) as Record<string, any> | undefined;

    if (!existing) {
      return NextResponse.json({ error: 'Paket wisata tidak ditemukan.' }, { status: 404 });
    }

    const body = await request.json();
    const parse = UpdateTourPackageSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.errors[0].message }, { status: 400 });
    }

    let existingCosting: any = {};
    try {
      existingCosting = JSON.parse(existing.costing_json);
    } catch {
      existingCosting = {};
    }

    const title = parse.data.title ?? existing.title;
    const destination = parse.data.destination ?? existing.destination;
    const duration_days = parse.data.duration_days ?? existing.duration_days;
    const min_pax = parse.data.min_pax ?? existing.min_pax;
    const free_pax = parse.data.free_pax ?? existingCosting.free_pax ?? 0;
    const margin_percentage = parse.data.margin_percentage ?? existingCosting.margin_percentage ?? 15;
    const fixed_costs = parse.data.fixed_costs ?? existingCosting.fixed_costs ?? [];
    const variable_costs = parse.data.variable_costs ?? existingCosting.variable_costs ?? [];
    const status = parse.data.status ?? existing.status;

    // Recalculate HPP
    const total_fixed_cost = fixed_costs.reduce((sum: number, c: any) => sum + (Number(c.cost) || 0), 0);
    const total_variable_cost_per_pax = variable_costs.reduce((sum: number, c: any) => sum + (Number(c.cost) || 0), 0);
    const total_participants = min_pax + free_pax;
    const total_group_cost = total_fixed_cost + (total_variable_cost_per_pax * total_participants);
    const hpp_per_pax = Math.round(total_group_cost / min_pax);
    const selling_price_per_pax = Math.ceil((hpp_per_pax * (1 + margin_percentage / 100)) / 1000) * 1000;

    const costing_json = JSON.stringify({
      destination,
      paxCount: min_pax,
      paying_pax: min_pax,
      free_pax,
      total_participants,
      margin_percentage,
      fixed_costs,
      variable_costs,
      total_fixed_cost,
      total_variable_cost_per_pax,
      total_group_cost,
      totalHPP: total_group_cost,
      hpp_per_pax,
      hppPerPax: hpp_per_pax,
      selling_price_per_pax,
      sellingPricePerPax: selling_price_per_pax,
      components: [
        ...fixed_costs.map((c: any) => ({ category: c.category || 'Fixed Cost', item: c.item, cost: c.cost })),
        ...variable_costs.map((c: any) => ({ category: c.category || 'Variable Cost', item: `${c.item} (x${total_participants} pax)`, cost: c.cost * total_participants })),
      ],
    });

    db.prepare(`
      UPDATE tour_packages
      SET title = ?,
          destination = ?,
          duration_days = ?,
          min_pax = ?,
          price_per_pax = ?,
          costing_json = ?,
          status = ?
      WHERE id = ?
    `).run(
      title,
      destination,
      duration_days,
      min_pax,
      selling_price_per_pax,
      costing_json,
      status === 'PUBLISHED' ? 'ACTIVE' : status,
      pkgId
    );

    logAudit({
      userId: user.id,
      action: 'TOUR_PACKAGE_UPDATE',
      targetId: pkgId,
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: {
        packageId: pkgId,
        title,
        selling_price_per_pax,
        hpp_per_pax,
        planner: user.name,
      },
    });

    const updated = db.prepare('SELECT * FROM tour_packages WHERE id = ?').get(pkgId) as Record<string, any>;

    return NextResponse.json({
      message: 'Paket wisata berhasil diperbarui.',
      package: {
        ...updated,
        costing: JSON.parse(updated.costing_json),
      },
    });
  } catch (error) {
    console.error('Error updating tour package:', error);
    return NextResponse.json({ error: 'Gagal memperbarui paket wisata.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'TOUR_PLANNER' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { error: 'Akses ditolak: Hanya Tour Planner atau Super Admin yang dapat menghapus paket wisata.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const pkgId = parseInt(id, 10);
    if (isNaN(pkgId)) {
      return NextResponse.json({ error: 'ID paket tidak valid.' }, { status: 400 });
    }

    const db = getDatabase();
    // Check if manifests exist
    const manifestsCount = db.prepare('SELECT COUNT(*) as c FROM tour_manifests WHERE tour_package_id = ?').get(pkgId) as { c: number };
    if (manifestsCount && manifestsCount.c > 0) {
      // Archive instead of hard delete
      db.prepare("UPDATE tour_packages SET status = 'ARCHIVED' WHERE id = ?").run(pkgId);
      return NextResponse.json({ message: 'Paket wisata diarsipkan karena memiliki peserta terdaftar.' });
    }

    db.prepare('DELETE FROM tour_itineraries WHERE tour_package_id = ?').run(pkgId);
    db.prepare('DELETE FROM tour_packages WHERE id = ?').run(pkgId);

    return NextResponse.json({ message: 'Paket wisata berhasil dihapus.' });
  } catch (error) {
    console.error('Error deleting tour package:', error);
    return NextResponse.json({ error: 'Gagal menghapus paket wisata.' }, { status: 500 });
  }
}
