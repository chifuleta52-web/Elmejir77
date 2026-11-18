// Copia de seguridad consistente de la base, aunque el servidor esté funcionando.
// Uso: node server/src/backup.js /data/backups
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const src = process.env.DB_PATH || '/data/app.db';
const dir = process.argv[2] || '/data/backups';
const keep = Number(process.env.BACKUPS_KEEP) || 30;
mkdirSync(dir, { recursive: true });
const file = join(dir, `app-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
const db = new DatabaseSync(src);
db.prepare('VACUUM INTO ?').run(file);
db.close();
const old = readdirSync(dir).filter((f) => /^app-.*\.db$/.test(f)).sort().slice(0, -keep);
for (const f of old) rmSync(join(dir, f));
console.log('Backup:', file);
