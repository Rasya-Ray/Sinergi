#!/usr/bin/env python3
"""
NESTI Dynamic Database Reset
Auto-discovers all tables, dumps schema, drops and recreates.
No hardcoded table list.
"""
import os
import psycopg2

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_Zd4mRIq9PCjk@ep-square-hill-b3y1avud-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
)


def get_all_tables(cur):
    cur.execute(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema = 'public' ORDER BY table_name"
    )
    return [r[0] for r in cur.fetchall()]


def build_create_sql(cur, tables):
    """Build CREATE TABLE statements, split into base (no FK) and FK adds."""
    base_stmts = []
    fk_stmts = []

    for table in tables:
        cur.execute("""
            SELECT column_name, data_type, character_maximum_length,
                   is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = %s AND table_schema = 'public'
            ORDER BY ordinal_position
        """, (table,))
        columns = cur.fetchall()

        cur.execute("""
            SELECT tc.constraint_name, tc.constraint_type,
                   kcu.column_name, ccu.table_name AS foreign_table,
                   ccu.column_name AS foreign_column
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            LEFT JOIN information_schema.constraint_column_usage ccu
              ON tc.constraint_name = ccu.constraint_name
            WHERE tc.table_name = %s AND tc.table_schema = 'public'
        """, (table,))
        constraints = cur.fetchall()

        col_lines = []
        pk_cols = []

        for col_name, data_type, max_len, nullable, default in columns:
            is_serial = default and 'nextval(' in str(default)
            col_def = f'  "{col_name}"'
            if is_serial:
                col_def += ' SERIAL'
            else:
                col_def += f' {data_type.upper()}'
                if max_len:
                    col_def += f'({max_len})'
                if nullable == 'NO':
                    col_def += ' NOT NULL'
                if default and default != 'NULL' and not is_serial:
                    if 'gen_random_uuid()' in str(default):
                        col_def += ' DEFAULT gen_random_uuid()'
                    elif 'now()' in str(default).lower():
                        col_def += ' DEFAULT NOW()'
                    elif 'current_date' in str(default).lower():
                        col_def += ' DEFAULT CURRENT_DATE'
                    elif 'current_timestamp' in str(default).lower():
                        col_def += ' CURRENT_TIMESTAMP'
                    elif default == 'true':
                        col_def += ' DEFAULT TRUE'
                    elif default == 'false':
                        col_def += ' DEFAULT FALSE'
                    elif default.startswith("'") or default.startswith('"'):
                        col_def += f' DEFAULT {default}'
                    else:
                        try:
                            float(default)
                            col_def += f' DEFAULT {default}'
                        except (ValueError, TypeError):
                            col_def += f" DEFAULT '{default}'"
            col_lines.append(col_def)

        # PK and UNIQUE
        seen_unique = set()
        for cname, ctype, ccol, ftable, fcol in constraints:
            if ctype == 'PRIMARY KEY' and ccol:
                pk_cols.append(ccol)
            elif ctype == 'UNIQUE' and ccol and ccol not in pk_cols and ccol not in seen_unique:
                seen_unique.add(ccol)
                col_lines.append(f'  UNIQUE("{ccol}")')

        if pk_cols:
            pk_str = ', '.join(f'"{c}"' for c in pk_cols)
            col_lines.append(f'  PRIMARY KEY ({pk_str})')

        base_stmts.append(f'CREATE TABLE {table} (\n' + ',\n'.join(col_lines) + '\n);')

        # Collect FKs
        for cname, ctype, ccol, ftable, fcol in constraints:
            if ctype == 'FOREIGN KEY' and ftable and fcol:
                fk_stmts.append(
                    f'ALTER TABLE {table} ADD CONSTRAINT {cname} '
                    f'FOREIGN KEY("{ccol}") REFERENCES {ftable}("{fcol}") ON DELETE CASCADE;'
                )

    return base_stmts, fk_stmts


def main():
    print("========================================")
    print("  NESTI DYNAMIC DATABASE RESET")
    print("========================================\n")

    confirm = input("Type 'yes' to reset ALL tables: ").strip().lower()
    if confirm != "yes":
        print("Cancelled.")
        return

    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # Discover
    tables = get_all_tables(cur)
    print(f"Found {len(tables)} tables\n")

    # Dump schema
    print("Dumping schema...")
    base_stmts, fk_stmts = build_create_sql(cur, tables)

    # Drop all
    print("Dropping all tables...")
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
    all_tables = [r[0] for r in cur.fetchall()]
    for t in all_tables:
        cur.execute(f"DROP TABLE IF EXISTS {t} CASCADE")
        print(f"  Dropped: {t}")

    # Recreate base tables (no FKs)
    print("\nRecreating tables...")
    for stmt in base_stmts:
        cur.execute(stmt)

    # Add FKs
    print("Adding foreign keys...")
    for stmt in fk_stmts:
        cur.execute(stmt)

    # Post-reset fixups: constraints that dynamic dump may miss
    print("Applying fixups...")
    fixups = [
        # tg_hourly_limits needs composite UNIQUE for ON CONFLICT
        "ALTER TABLE tg_hourly_limits DROP CONSTRAINT IF EXISTS tg_hourly_limits_user_id_key",
        "ALTER TABLE tg_hourly_limits DROP CONSTRAINT IF EXISTS tg_hourly_limits_hour_start_key",
        "ALTER TABLE tg_hourly_limits ADD CONSTRAINT tg_hourly_limits_user_hour UNIQUE (user_id, hour_start)",
    ]
    for sql in fixups:
        try:
            cur.execute(sql)
        except Exception:
            pass

    conn.commit()
    conn.close()

    print("\n========================================")
    print(f"  DONE! {len(tables)} tables recreated")
    print("========================================")


if __name__ == "__main__":
    main()
