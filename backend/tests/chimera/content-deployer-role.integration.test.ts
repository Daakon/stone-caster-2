import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { randomBytes } from "node:crypto";

const localOnly = describe;

localOnly("content deployer role against isolated local Supabase", () => {
  it("can invoke only the content sync boundary and cannot read protected game or account tables", async () => {
    const env = dotenv.parse(
      fs.readFileSync(
        path.resolve(
          path.dirname(fileURLToPath(import.meta.url)),
          "../../../.env.stonecaster-local",
        ),
      ),
    );
    const url = new URL(process.env.LOCAL_DATABASE_URL || env.DATABASE_URL);
    expect(["localhost", "127.0.0.1", "::1"]).toContain(
      url.hostname.toLowerCase(),
    );
    expect(url.pathname).toBe("/postgres");
    const db = new pg.Client({
      connectionString: url.toString(),
      application_name: "stonecaster-content-role-integration",
    });
    await db.connect();
    try {
      const grants = await db.query(`
        select
          has_function_privilege('stonecaster_content_deployer', 'content_deploy.content_sync_apply(bigint,uuid,jsonb)', 'EXECUTE') as sync_execute,
          has_table_privilege('stonecaster_content_deployer', 'content_deploy.validation_formats', 'SELECT') as format_read,
          has_table_privilege('stonecaster_content_deployer', 'public.chimera_content_source_items', 'SELECT') as source_read,
          has_table_privilege('stonecaster_content_deployer', 'public.chimera_game_states', 'INSERT') as game_insert,
          has_table_privilege('stonecaster_content_deployer', 'public.auth_ledger', 'SELECT') as ledger_read
      `);
      expect(grants.rows[0]).toEqual({
        sync_execute: true,
        format_read: true,
        source_read: false,
        game_insert: false,
        ledger_read: false,
      });

      const password = randomBytes(32).toString("base64url");
      const statement = await db.query(
        "select format('alter role stonecaster_content_deployer login noinherit password %L', $1::text) as sql",
        [password],
      );
      await db.query(statement.rows[0].sql);
      const deployUrl = new URL(url);
      deployUrl.username = "stonecaster_content_deployer";
      deployUrl.password = password;
      const deployer = new pg.Client({
        connectionString: deployUrl.toString(),
        application_name: "stonecaster-content-role-proof",
      });
      await deployer.connect();
      try {
        const formats = await deployer.query(
          "select content_kind from content_deploy.validation_formats limit 1",
        );
        expect(formats.rows.length).toBe(1);
        let denied: unknown;
        try {
          await deployer.query(
            "select * from public.chimera_game_states limit 0",
          );
        } catch (error) {
          denied = error;
        }
        expect((denied as { code?: string })?.code).toBe("42501");
      } finally {
        await deployer.end();
      }
    } finally {
      await db.end();
    }
  });
});
