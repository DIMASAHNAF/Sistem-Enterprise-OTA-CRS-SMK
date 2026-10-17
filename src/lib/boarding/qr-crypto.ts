import crypto from 'node:crypto';
import QRCode from 'qrcode';

const QR_SECRET =
  process.env.BOARDING_QR_SECRET ||
  process.env.JWT_SECRET ||
  'smk-ulp-enterprise-secure-qr-boarding-hmac-key-2026';

export interface QRPayloadData {
  pnr_code: string;
  passenger_id: number;
  schedule_id: number;
  seat_number: string; // '2A' or 'INFANT'
}

export interface VerificationResult {
  valid: boolean;
  error?: string;
  data?: QRPayloadData;
}

/**
 * Generate HMAC-SHA256 signature for a boarding pass
 */
export function signBoardingData(
  pnrCode: string,
  passengerId: number,
  scheduleId: number,
  seatNumber: string | null
): { rawMessage: string; signature: string; payload: string } {
  const seat = seatNumber && seatNumber.trim() ? seatNumber.trim().toUpperCase() : 'INFANT';
  const cleanPnr = pnrCode.trim().toUpperCase();
  const rawMessage = `${cleanPnr}|${passengerId}|${scheduleId}|${seat}`;

  const hmac = crypto.createHmac('sha256', QR_SECRET);
  hmac.update(rawMessage);
  const signature = hmac.digest('hex');

  const payload = `ULP-BP|${rawMessage}|${signature}`;

  return {
    rawMessage,
    signature,
    payload,
  };
}

/**
 * Verify a boarding pass payload using timingSafeEqual to prevent side-channel timing attacks
 */
export function verifyQRPayload(payloadStr: string): VerificationResult {
  if (!payloadStr || typeof payloadStr !== 'string') {
    return { valid: false, error: 'Payload QR Code kosong atau tidak valid' };
  }

  const parts = payloadStr.trim().split('|');
  if (parts.length !== 6) {
    return {
      valid: false,
      error: 'Format QR Code tidak sesuai standar ULP (Wajib 6 segmen terpisah pipe)',
    };
  }

  const [prefix, pnrCode, passengerIdStr, scheduleIdStr, seat, signature] = parts;

  if (prefix !== 'ULP-BP') {
    return { valid: false, error: 'Awalan QR Code tidak dikenali (Bukan tiket resmi ULP)' };
  }

  const passengerId = Number(passengerIdStr);
  const scheduleId = Number(scheduleIdStr);

  if (!pnrCode || !passengerId || !scheduleId || !seat || !signature) {
    return { valid: false, error: 'Komponen data tiket pada QR Code tidak lengkap' };
  }

  // Reconstruct expected raw message and signature
  const expectedRaw = `${pnrCode.toUpperCase()}|${passengerId}|${scheduleId}|${seat.toUpperCase()}`;
  const hmac = crypto.createHmac('sha256', QR_SECRET);
  hmac.update(expectedRaw);
  const expectedSignature = hmac.digest('hex');

  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (sigBuffer.length !== expectedBuffer.length) {
    return { valid: false, error: 'Tanda tangan digital QR Code tidak valid (Panjang signature salah)' };
  }

  const isMatch = crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  if (!isMatch) {
    return { valid: false, error: 'Tanda tangan kriptografi QR Code tidak cocok (Terindikasi palsu/dimanipulasi)' };
  }

  return {
    valid: true,
    data: {
      pnr_code: pnrCode.toUpperCase(),
      passenger_id: passengerId,
      schedule_id: scheduleId,
      seat_number: seat.toUpperCase(),
    },
  };
}

/**
 * Generate 100% Offline Vector SVG QR Code
 */
export async function generateQRCodeSVG(payload: string): Promise<string> {
  return await QRCode.toString(payload, {
    type: 'svg',
    margin: 1,
    color: {
      dark: '#0f172a', // Tailwind slate-900
      light: '#ffffff',
    },
  });
}
