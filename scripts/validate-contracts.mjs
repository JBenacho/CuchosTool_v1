// Valida la integridad del registro de contratos de eventos (BL-016 / BL-096).
// Uso: node scripts/validate-contracts.mjs  (desde la raiz del monorepo).
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'contracts', 'events');
const files = fs.readdirSync(dir).filter(function (f) {
  return f.endsWith('.json');
});

let failures = 0;
for (const f of files) {
  const parsed = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const required = parsed.required || [];
  for (const key of ['eventId', 'type', 'version', 'occurredAt', 'data']) {
    if (!required.includes(key)) {
      console.error('FALTA required: ' + key + ' en ' + f);
      failures++;
    }
  }
  const typeConst = parsed.properties && parsed.properties.type && parsed.properties.type.const;
  if (typeof typeConst !== 'string' || !typeConst.startsWith('com.cuchostool.')) {
    console.error('type.const invalido en ' + f);
    failures++;
  }
  const dataRequired =
    parsed.properties && parsed.properties.data && (parsed.properties.data.required || []);
  if (!dataRequired || dataRequired.length === 0) {
    console.error('data.required vacio en ' + f);
    failures++;
  }
}

if (failures > 0) {
  console.error(failures + ' errores de contrato');
  process.exit(1);
}
console.log('Contratos OK: ' + files.length + ' esquemas de eventos validos.');
