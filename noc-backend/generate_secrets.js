// Agrega JWT_SECRET y WORKER_API_KEY aleatorios al .env si aún no existen.
// No imprime los valores.
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const envPath = path.join(__dirname, '.env');
let content = fs.readFileSync(envPath, 'utf8');
const add = [];

if (!/^JWT_SECRET=/m.test(content)) add.push(`JWT_SECRET=${crypto.randomBytes(48).toString('hex')}`);
if (!/^WORKER_API_KEY=/m.test(content)) add.push(`WORKER_API_KEY=${crypto.randomBytes(32).toString('hex')}`);

if (add.length) {
  if (!content.endsWith('\n')) content += '\n';
  content += '\n# ══════════════════════════════════════════\n# Seguridad (generado automáticamente)\n# ══════════════════════════════════════════\n' + add.join('\n') + '\n';
  fs.writeFileSync(envPath, content);
  console.log('Agregado a .env:', add.map(l => l.split('=')[0]).join(', '));
} else {
  console.log('JWT_SECRET y WORKER_API_KEY ya existen en .env');
}
