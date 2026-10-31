import pg from "pg";
import type { ContentGcRequest } from "../../../../shared/src/types/chimera-content-gc.js";

export class ContentGcRepository {
  async collect(
    connectionString: string,
    request: ContentGcRequest,
  ): Promise<unknown> {
    const client = new pg.Client({
      connectionString,
      application_name: "stonecaster-content-gc",
      connectionTimeoutMillis: 5000,
      statement_timeout: 30000,
      lock_timeout: 2000,
    });
    try {
      await client.connect();
      // The operator role has only EXECUTE on the bounded function, no table DML.
      await client.query("set role stonecaster_content_gc_operator");
      const result = await client.query<{ receipt: unknown }>(
        "select public.chimera_content_gc($1::integer,$2::boolean) as receipt",
        [request.batch_size, request.dry_run],
      );
      return result.rows[0]?.receipt;
    } finally {
      await client.end();
    }
  }
}
