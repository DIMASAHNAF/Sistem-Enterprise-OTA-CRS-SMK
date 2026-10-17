import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/travel.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();

console.log(`\n========================================`);
console.log(`DATABASE VERIFICATION: ${tables.length} TABLES VERIFIED`);
console.log(`========================================`);

for (const t of tables) {
  const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get();
  console.log(`✓ ${t.name.padEnd(22)} : ${count.c} rows`);
}
console.log(`========================================\n`);
