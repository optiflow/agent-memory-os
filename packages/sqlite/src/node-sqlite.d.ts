declare module "node:sqlite" {
  type SQLInputValue = bigint | Buffer | number | string | null;

  export class DatabaseSync {
    constructor(location?: string, options?: Record<string, unknown>);
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }

  export class StatementSync {
    all(...values: SQLInputValue[]): Record<string, unknown>[];
    get(...values: SQLInputValue[]): Record<string, unknown> | undefined;
    run(...values: SQLInputValue[]): { changes: number; lastInsertRowid: bigint | number };
  }
}
