import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REFERENCE_FLOOR_PLANS } from '../src/data/marketFloorPlans.js';

const startMarker = '-- BEGIN GENERATED REFERENCE FLOOR CONSTRAINT';
const endMarker = '-- END GENERATED REFERENCE FLOOR CONSTRAINT';

function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/** One exact catalog generates both fresh-install and existing-database SQL. */
export function referenceFloorConstraint(): string {
  if (!REFERENCE_FLOOR_PLANS.length) throw new Error('Reference floor catalog is empty');
  const ids = REFERENCE_FLOOR_PLANS.map((plan) => literal(plan.floor_plan_id)).join(', ');
  const rows = REFERENCE_FLOOR_PLANS.map((plan) => {
    if (!plan.source_url || !Number.isInteger(plan.width) || !Number.isInteger(plan.height) || plan.is_demo) {
      throw new Error('Reference floor catalog metadata is incomplete');
    }
    return `        (${[plan.floor_plan_id, plan.location_id, plan.name, plan.image_url].map(literal).join(', ')}, ${plan.width}, ${plan.height}, ${literal(plan.source_label)}, ${literal(plan.source_url)}, FALSE)`;
  }).join(',\n');
  return `${startMarker}
-- Generated from src/data/marketFloorPlans.ts. Do not edit this block by hand.
-- Regenerate: node --import tsx scripts/generate-map-reference-schema.ts
-- Reserved IDs accept only their complete canonical metadata, never uploads.
ALTER TABLE map_floor_plans DROP CONSTRAINT IF EXISTS map_floor_plans_image_url_check;
ALTER TABLE map_floor_plans ADD CONSTRAINT map_floor_plans_image_url_check CHECK (
  octet_length(image_url) <= 2796250 AND (
    (floor_plan_id NOT IN (${ids}) AND
      (image_url = '/maps/demo-market-floor.svg' OR image_url ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$'))
    OR (source_url IS NOT NULL AND
      (floor_plan_id, location_id, name, image_url, width, height, source_label, source_url, is_demo) IN (
${rows}
      ))
  )
);
${endMarker}`;
}

export function referenceFloorMigration(): string {
  return `-- Upgrade an existing map database after docs/neon-map-schema.sql has been applied.
-- Run explicitly in the Neon SQL Editor before enabling API reference-plan writes.
-- Safe to rerun; preserves rows, pins, uploads and the image-immutability trigger.
-- This only updates validation. Reads never migrate or seed rows automatically.
BEGIN;

${referenceFloorConstraint()}

COMMIT;
`;
}

function generatedSchema(schema: string): string {
  const block = referenceFloorConstraint();
  const start = schema.indexOf(startMarker);
  const end = schema.indexOf(endMarker);
  if (start >= 0 && end > start) return schema.slice(0, start) + block + schema.slice(end + endMarker.length);
  const anchor = 'CREATE INDEX IF NOT EXISTS map_floor_plans_location_lookup';
  if (!schema.includes(anchor)) throw new Error('Map schema insertion point missing');
  return schema.replace(anchor, () => `${block}\n\n${anchor}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const schemaPath = new URL('../docs/neon-map-schema.sql', import.meta.url);
  const migrationPath = new URL('../docs/neon-map-reference-plans.sql', import.meta.url);
  const schema = readFileSync(schemaPath, 'utf8');
  const outputs = [[schemaPath, generatedSchema(schema)], [migrationPath, referenceFloorMigration()]] as const;
  for (const [path, expected] of outputs) {
    if (process.argv.includes('--check')) {
      if (readFileSync(path, 'utf8') !== expected) throw new Error(`Generated map SQL is outdated: ${fileURLToPath(path)}`);
    } else writeFileSync(path, expected);
  }
}
