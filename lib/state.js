/**
 * JSON File State -- Lightweight persistence for Asimov's Radio.
 *
 * Replaces the Asimov's Mind vault with a simple JSON file store.
 * Data is saved to .asimovs-radio/state.json in the project root.
 * Each key maps to a value, serialized as a flat JSON object.
 *
 * The state interface matches what SongStore expects:
 *   state.read(key)  -> { success: boolean, data: any }
 *   state.write(key, data) -> { success: boolean }
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export class JsonFileState {
  #filePath;
  #data = {};
  #dirty = false;
  #saveTimer = null;

  constructor(dataDir) {
    this.#filePath = path.join(dataDir, 'state.json');
  }

  async load() {
    try {
      const raw = await fs.readFile(this.#filePath, 'utf-8');
      this.#data = JSON.parse(raw);
    } catch {
      this.#data = {};
    }
  }

  async read(key) {
    const value = this.#data[key];
    return { success: true, data: value ?? null };
  }

  async write(key, data) {
    this.#data[key] = data;
    this.#queueSave();
    return { success: true };
  }

  async delete(key) {
    delete this.#data[key];
    this.#queueSave();
    return { success: true };
  }

  #queueSave() {
    if (this.#saveTimer) return;
    this.#dirty = true;
    this.#saveTimer = setTimeout(() => {
      this.#saveTimer = null;
      this.#flush();
    }, 1000);
  }

  async #flush() {
    if (!this.#dirty) return;
    this.#dirty = false;
    try {
      await fs.mkdir(path.dirname(this.#filePath), { recursive: true });
      await fs.writeFile(this.#filePath, JSON.stringify(this.#data, null, 2));
    } catch (err) {
      process.stderr.write(`[radio:state] Save failed: ${err.message}\n`);
    }
  }

  async stop() {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
      this.#saveTimer = null;
    }
    await this.#flush();
  }
}
