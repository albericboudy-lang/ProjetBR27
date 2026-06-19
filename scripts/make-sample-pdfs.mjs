// Dev helper: emits small but fully valid PDFs (correct xref offsets) used as
// sample livrets/tracts for the fixture build. Run: node scripts/make-sample-pdfs.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'fixtures', 'files');
mkdirSync(outDir, { recursive: true });

function esc(s) { return s.replace(/([\\()])/g, '\\$1'); }

// Build a minimal one-page PDF with a title + a few lines, valid xref table.
function makePdf(title, lines) {
  const objs = [];
  objs.push('<</Type/Catalog/Pages 2 0 R>>');
  objs.push('<</Type/Pages/Kids[3 0 R]/Count 1>>');
  objs.push('<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 5 0 R/F2 6 0 R>>>>/Contents 4 0 R>>');
  let stream = 'BT /F2 22 Tf 64 760 Td (' + esc(title) + ') Tj ET\n';
  let y = 720;
  for (const line of lines) { stream += `BT /F1 12 Tf 64 ${y} Td (` + esc(line) + ') Tj ET\n'; y -= 22; }
  objs.push(`<</Length ${Buffer.byteLength(stream, 'latin1')}>>\nstream\n${stream}endstream`);
  objs.push('<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>');
  objs.push('<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold>>');

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefPos = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += String(off).padStart(10, '0') + ' 00000 n \n';
  pdf += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

const docs = [
  ['livret-fiscalite-travail.pdf', 'Livret — Fiscalité du travail',
    ['Pilier : Prospérité', 'Document de démonstration (données fictives).',
     'Restaurer la valeur travail par une fiscalité simplifiée.', 'BR2027 — diffusion restreinte.']],
  ['tract-securite-quotidien.pdf', 'Tract — Sécurité du quotidien',
    ['Pilier : Ordre', 'Document de démonstration (données fictives).',
     'Réarmer l\'autorité républicaine sur tout le territoire.', 'BR2027 — diffusion restreinte.']],
  ['livret-souverainete.pdf', 'Livret — Souveraineté industrielle',
    ['Pilier : Prospérité', 'Document de démonstration (données fictives).',
     'Reconquête productive et indépendance énergétique.', 'BR2027 — diffusion restreinte.']],
  ['note-annexe-fierte.pdf', 'Note — Transmission & mémoire',
    ['Pilier : Fierté', 'Document de démonstration (données fictives).',
     'École, culture, roman national assumé.', 'BR2027 — diffusion restreinte.']],
];

for (const [name, title, lines] of docs) {
  writeFileSync(join(outDir, name), makePdf(title, lines));
  console.log('wrote', name);
}
console.log('Sample PDFs ready in fixtures/files/');
