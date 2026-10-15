import { mkdirSync, existsSync, readFileSync, openSync, writeSync, fsyncSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { Opening, IncubationView } from '../shared/game.ts';
import { DATA_DIR } from './config.ts';
export interface Incubation extends IncubationView { owner: string; opening: Opening; }
interface Entry { previous: string; timestamp: string; record: Incubation; hash: string; }
// Append-only full state history: each update preserves the complete previous record.
// fsync completes before a transaction is submitted. Never truncate on parse failure.
export class Journal {
  private records = new Map<string, Incubation>();
  private tail = '';
  private path: string;
  constructor(directory = DATA_DIR) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.path = join(directory, 'incubations.jsonl');
    if (existsSync(this.path)) {
      for (const line of readFileSync(this.path, 'utf8').split('\n').filter(Boolean)) {
        const entry = JSON.parse(line) as Entry;
        const { hash, ...body } = entry;
        if (entry.previous !== this.tail || digest(body) !== hash) throw new Error('Incubation journal integrity failure; original file preserved');
        this.records.set(entry.record.id, entry.record); this.tail = hash;
      }
    }
  }
  get(id: string) { return this.records.get(id); }
  list(owner: string) { return [...this.records.values()].filter(r => r.owner === owner).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  save(record: Incubation) {
    const body = { previous: this.tail, timestamp: new Date().toISOString(), record };
    const entry = { ...body, hash: digest(body) };
    const fd = openSync(this.path, 'a', 0o600);
    try { writeSync(fd, `${JSON.stringify(entry)}\n`); fsyncSync(fd); } finally { closeSync(fd); }
    this.tail = entry.hash; this.records.set(record.id, structuredClone(record));
  }
}
function digest(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export function publicRecord(record: Incubation): IncubationView { const { owner: _owner, opening: _opening, ...view } = record; return view; }
