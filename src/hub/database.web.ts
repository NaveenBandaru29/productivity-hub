import { type Row, recordSchema } from "./backup";
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("minimal-productivity-hub", 1);
    open.onupgradeneeded = () =>
      open.result.createObjectStore("records", { keyPath: ["kind", "id"] });
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}
export async function loadRecords(): Promise<Row[]> {
  const db = await database();
  try {
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const req = db.transaction("records").objectStore("records").getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return rows.map((row) => recordSchema.parse(row));
  } finally {
    db.close();
  }
}
export async function saveRecords(rows: Row[], importing: boolean) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("records", "readwrite"),
        store = tx.objectStore("records");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      let index = 0;
      function next() {
        const row = rows[index++];
        if (!row) return;
        if (row.kind === "wellbeing.focusSession" && row.deleted) {
          store.delete([row.kind, row.id]).onsuccess = next;
          return;
        }
        const get = store.get([row.kind, row.id]);
        get.onsuccess = () => {
          const prev = get.result as Row | undefined;
          if (importing && prev && prev.updated >= row.updated) {
            next();
            return;
          }
          store.put({
            ...row,
            updated: importing
              ? row.updated
              : Math.max(Date.now(), (prev?.updated ?? 0) + 1),
          }).onsuccess = next;
        };
      }
      next();
    });
  } finally {
    db.close();
  }
}
