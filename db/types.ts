import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/** Works for the real connection, the in-memory test database and transactions. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
