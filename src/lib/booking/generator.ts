import { DatabaseSync } from 'node:sqlite';

const PNR_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes I, O, 0, 1 to avoid confusion

/**
 * Generate unique 6-character PNR code
 */
export function generatePNR(db: DatabaseSync): string {
  let pnr = '';
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 20) {
    pnr = '';
    for (let i = 0; i < 6; i++) {
      const idx = Math.floor(Math.random() * PNR_CHARS.length);
      pnr += PNR_CHARS[idx];
    }

    const existing = db.prepare('SELECT id FROM booking_segments WHERE pnr_code = ?').get(pnr);
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  return pnr;
}

/**
 * Generate unique Invoice Number: INV-YYYYMMDD-XXXX
 */
export function generateInvoiceNumber(db: DatabaseSync): string {
  const datePart = new Date().toISOString().split('T')[0].replace(/-/g, '');
  let invoice = '';
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 20) {
    let rand = '';
    for (let i = 0; i < 4; i++) {
      rand += PNR_CHARS[Math.floor(Math.random() * PNR_CHARS.length)];
    }
    invoice = `INV-${datePart}-${rand}`;

    const existing = db.prepare('SELECT id FROM bookings WHERE invoice_number = ?').get(invoice);
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  return invoice;
}

/**
 * Auto-Release expired locks
 */
export function releaseExpiredBookings(db: DatabaseSync): number {
  try {
    const res = db.prepare(`
      UPDATE bookings
      SET payment_status = 'EXPIRED'
      WHERE payment_status = 'PENDING'
        AND locked_until <= datetime('now')
    `).run();
    return Number(res.changes);
  } catch (err) {
    console.error('Error releasing expired bookings:', err);
    return 0;
  }
}
