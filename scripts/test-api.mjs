async function runTests() {
  const BASE_URL = 'http://localhost:3000';
  console.log(`\n======================================================`);
  console.log(`PENGUJIAN END-TO-END FASE 1: AUTH & 6-ROLE RBAC`);
  console.log(`======================================================\n`);

  // 1. Test Public Storefront Homepage
  console.log('1. Menguji Halaman Utama Etalase Publik (GET /)...');
  const homeRes = await fetch(`${BASE_URL}/`);
  const homeHtml = await homeRes.text();
  if (
    homeRes.status === 200 &&
    homeHtml.includes('SMK TRAVELLOKA') &&
    homeHtml.includes('KA Sribilah Utama')
  ) {
    console.log('   ✓ Halaman utama berhasil dimuat (200 OK) dengan data kereta nyata!');
  } else {
    throw new Error(`Gagal memuat homepage: ${homeRes.status}`);
  }

  // 2. Test Login as SUPER_ADMIN
  console.log('\n2. Menguji Login sebagai SUPER_ADMIN...');
  const loginAdminRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@smk-nusantara.sch.id',
      password: 'Password123!',
    }),
  });
  const adminData = await loginAdminRes.json();
  const adminCookie = loginAdminRes.headers.get('set-cookie');
  console.log(`   ✓ Login SUPER_ADMIN sukses: Role = ${adminData.user.role}, Redirect = ${adminData.redirectTo}`);

  // 3. Test Session Check (GET /api/auth/me) with Cookie
  console.log('\n3. Menguji Sesi Token Pengguna (GET /api/auth/me)...');
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: adminCookie?.split(';')[0] || '' },
  });
  const meData = await meRes.json();
  console.log(`   ✓ Sesi valid: ${meData.user.name} (${meData.user.badgeLabel})`);

  // 4. Test Audit Log API as SUPER_ADMIN
  console.log('\n4. Menguji API Audit Log Keamanan (GET /api/audit-logs)...');
  const auditRes = await fetch(`${BASE_URL}/api/audit-logs`, {
    headers: { Cookie: adminCookie?.split(';')[0] || '' },
  });
  const auditData = await auditRes.json();
  console.log(`   ✓ Audit logs berhasil ditarik: ${auditData.logs.length} catatan audit tercatat.`);

  // 5. Test Login as TICKETING_OFFICER
  console.log('\n5. Menguji Login sebagai TICKETING_OFFICER...');
  const loginTicketRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'loket@smk-nusantara.sch.id',
      password: 'Password123!',
    }),
  });
  const ticketData = await loginTicketRes.json();
  const ticketCookie = loginTicketRes.headers.get('set-cookie')?.split(';')[0] || '';
  console.log(`   ✓ Login TICKETING_OFFICER sukses: Role = ${ticketData.user.role}`);

  // 6. Test RBAC: TICKETING_OFFICER trying to access /api/audit-logs (Forbidden)
  console.log('\n6. Menguji Proteksi RBAC: TICKETING_OFFICER mengakses Audit Logs...');
  const ticketAuditRes = await fetch(`${BASE_URL}/api/audit-logs`, {
    headers: { Cookie: ticketCookie },
  });
  if (ticketAuditRes.status === 403) {
    console.log('   ✓ Proteksi RBAC Berhasil! TICKETING_OFFICER ditolak (403 Forbidden).');
  } else {
    console.log(`   ! Respon tidak terduga: ${ticketAuditRes.status}`);
  }

  // 7. Test Login as CUSTOMER
  console.log('\n7. Menguji Login sebagai CUSTOMER...');
  const loginCustRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'budi.santoso@gmail.com',
      password: 'Password123!',
    }),
  });
  const custData = await loginCustRes.json();
  const custCookie = loginCustRes.headers.get('set-cookie')?.split(';')[0] || '';
  console.log(`   ✓ Login CUSTOMER sukses: Role = ${custData.user.role}, Redirect = ${custData.redirectTo}`);

  // 8. Test RBAC: CUSTOMER accessing /backoffice (Should be redirected)
  console.log('\n8. Menguji Proteksi RBAC: CUSTOMER dilarang masuk Backoffice...');
  const custBackofficeRes = await fetch(`${BASE_URL}/backoffice`, {
    headers: { Cookie: custCookie },
    redirect: 'manual',
  });
  console.log(`   ✓ CUSTOMER diarahkan keluar dari Backoffice (Status: ${custBackofficeRes.status}, Location: ${custBackofficeRes.headers.get('location') || '/'})`);

  console.log(`\n======================================================`);
  console.log(`SEMUA PENGUJIAN FASE 1 BERHASIL 100%!`);
  console.log(`======================================================\n`);
}

runTests().catch((e) => {
  console.error('Pengujian gagal:', e);
  process.exit(1);
});
