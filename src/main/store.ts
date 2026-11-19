import { DatabaseSync } from 'node:sqlite';

/** Versioned document repository. Domain validation belongs in the service/core. */
export class DocumentStore {
  private readonly db: DatabaseSync;
  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    const version = this.db.prepare('PRAGMA user_version').get() as { user_version: number };
    if (version.user_version > 1) {
      this.db.close();
      throw new Error('数据来自更新版本，请先更新应用；本次未修改数据库。');
    }
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;');
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS documents (collection TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(collection,id)); PRAGMA user_version = 1;',
    );
  }
  get<T>(collection: string, id: string): T | undefined {
    const row = this.db
      .prepare('SELECT body FROM documents WHERE collection = ? AND id = ?')
      .get(collection, id) as { body: string } | undefined;
    return row ? (JSON.parse(row.body) as T) : undefined;
  }
  list<T>(collection: string): T[] {
    return (
      this.db
        .prepare('SELECT body FROM documents WHERE collection = ? ORDER BY id')
        .all(collection) as { body: string }[]
    ).map((row) => JSON.parse(row.body) as T);
  }
  put(collection: string, id: string, value: unknown): void {
    const body = JSON.stringify(value);
    if (body.length > 2_000_000) throw new Error('本地记录过大，请先导出评估记录或清理会话。');
    this.db
      .prepare(
        'INSERT INTO documents(collection,id,body) VALUES(?,?,?) ON CONFLICT(collection,id) DO UPDATE SET body=excluded.body',
      )
      .run(collection, id, body);
  }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const value = fn();
      this.db.exec('COMMIT');
      return value;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  deleteWhere<T>(collection: string, predicate: (value: T) => boolean): void {
    const rows = this.db
      .prepare('SELECT id, body FROM documents WHERE collection = ?')
      .all(collection) as { id: string; body: string }[];
    for (const row of rows)
      if (predicate(JSON.parse(row.body) as T))
        this.db
          .prepare('DELETE FROM documents WHERE collection = ? AND id = ?')
          .run(collection, row.id);
  }
  close(): void {
    this.db.close();
  }
}
