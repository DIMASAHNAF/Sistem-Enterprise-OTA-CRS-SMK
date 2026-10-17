import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit/logger';

export const dynamic = 'force-dynamic';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

const CostItemSchema = z.object({
  item: z.string().trim().min(1, 'Nama item biaya wajib diisi'),
  cost: z.number().min(0, 'Biaya tidak boleh negatif'),
  category: z.string().optional().default('General'),
});

const CreateTourPackageSchema = z.object({
  title: z.string().trim().min(3, 'Judul paket wisata minimal 3 karakter'),
  slug: z.string().trim().optional(),
  destination: z.string().trim().min(2, 'Destinasi wajib diisi'),
  duration_days: z.number().int().min(1).default(1),
  min_pax: z.number().int().min(1, 'Target peserta berbayar minimal 1 orang').default(30),
  free_pax: z.number().int().min(0).default(0),
  margin_percentage: z.number().min(0).max(100).default(15),
  fixed_costs: z.array(CostItemSchema).default([]),
  variable_costs: z.array(CostItemSchema).default([]),
  status: z.enum(['DRAFT', 'ACTIVE', 'PUBLISHED', 'ARCHIVED']).default('ACTIVE'),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const searchParam = searchParams.get('search');

    const db = getDatabase();

    let query = `
      SELECT 
        tp.*,
        (SELECT COUNT(*) FROM tour_itineraries ti WHERE ti.tour_package_id = tp.id) as itineraries_count,
        (SELECT COUNT(*) FROM tour_manifests tm WHERE tm.tour_package_id = tp.id) as manifests_count
      FROM tour_packages tp
      WHERE 1=1
    `;
    const params: any[] = [];

    if (statusParam && statusParam !== 'ALL') {
      if (statusParam === 'PUBLISHED') {
        query += ` AND tp.status IN ('ACTIVE', 'PUBLISHED')`;
      } else {
        query += ` AND tp.status = ?`;
        params.push(statusParam);
      }
    }

    if (searchParam) {
      query += ` AND (tp.title LIKE ? OR tp.destination LIKE ?)`;
      params.push(`%${searchParam}%`, `%${searchParam}%`);
    }

    query += ` ORDER BY tp.id DESC`;

    const rawPackages = db.prepare(query).all(...params) as Array<Record<string, any>>;

    const packages = rawPackages.map((pkg) => {
      let costing: any = null;
      try {
        costing = JSON.parse(pkg.costing_json);
      } catch {
        costing = null;
      }
      return {
        ...pkg,
        costing,
      };
    });

    return NextResponse.json({ packages });
  } catch (error) {
    console.error('Error fetching tour packages:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil data paket wisata.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. RBAC Guard: TOUR_PLANNER or SUPER_ADMIN
    const user = await getCurrentUser();
    if (!user || (user.role !== 'TOUR_PLANNER' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { error: 'Akses ditolak: Hanya Tour Planner atau Super Admin yang dapat membuat paket wisata.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parse = CreateTourPackageSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.errors[0].message },
        { status: 400 }
      );
    }

    const {
      title,
      destination,
      duration_days,
      min_pax,
      free_pax,
      margin_percentage,
      fixed_costs,
      variable_costs,
      status,
    } = parse.data;

    // 2. Strict HPP Tour Costing Calculation
    const total_fixed_cost = fixed_costs.reduce((sum, c) => sum + (Number(c.cost) || 0), 0);
    const total_variable_cost_per_pax = variable_costs.reduce((sum, c) => sum + (Number(c.cost) || 0), 0);
    const total_participants = min_pax + free_pax;
    const total_group_cost = total_fixed_cost + (total_variable_cost_per_pax * total_participants);
    const hpp_per_pax = Math.round(total_group_cost / min_pax);
    // Rounded up to nearest thousand IDR
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
        ...fixed_costs.map((c) => ({ category: c.category || 'Fixed Cost', item: c.item, cost: c.cost })),
        ...variable_costs.map((c) => ({ category: c.category || 'Variable Cost', item: `${c.item} (x${total_participants} pax)`, cost: c.cost * total_participants })),
      ],
    });

    const db = getDatabase();

    // Generate unique slug
    let targetSlug = parse.data.slug ? slugify(parse.data.slug) : slugify(title);
    if (!targetSlug) targetSlug = `tour-${Date.now()}`;

    const existingSlug = db.prepare('SELECT id FROM tour_packages WHERE slug = ?').get(targetSlug);
    if (existingSlug) {
      targetSlug = `${targetSlug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    // Insert tour package
    const insertStmt = db.prepare(`
      INSERT INTO tour_packages (
        slug,
        title,
        destination,
        duration_days,
        min_pax,
        price_per_pax,
        costing_json,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      targetSlug,
      title,
      destination,
      duration_days,
      min_pax,
      selling_price_per_pax,
      costing_json,
      status === 'PUBLISHED' ? 'ACTIVE' : status
    );

    const newId = Number(result.lastInsertRowid);

    // 3. Audit Log
    logAudit({
      userId: user.id,
      action: 'TOUR_PACKAGE_CREATE',
      targetId: newId,
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      details: {
        packageId: newId,
        title,
        slug: targetSlug,
        destination,
        min_pax,
        free_pax,
        hpp_per_pax,
        selling_price_per_pax,
        total_group_cost,
        planner: user.name,
      },
    });

    const createdPackage = db.prepare('SELECT * FROM tour_packages WHERE id = ?').get(newId) as Record<string, any>;

    return NextResponse.json(
      {
        message: 'Paket wisata dan perhitungan HPP berhasil disimpan.',
        package: {
          ...createdPackage,
          costing: JSON.parse(createdPackage.costing_json),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating tour package:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan sistem saat membuat paket wisata.' },
      { status: 500 }
    );
  }
}
