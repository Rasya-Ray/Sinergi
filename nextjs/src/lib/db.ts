import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default pool;

export async function getOrCreateUser(firebaseUid: string, email: string, name?: string) {
  const client = await pool.connect();
  try {
    const existing = await client.query(
      "SELECT * FROM users WHERE firebase_uid = $1",
      [firebaseUid]
    );
    if (existing.rows.length > 0) {
      return existing.rows[0];
    }
    const result = await client.query(
      "INSERT INTO users (firebase_uid, email, name) VALUES ($1, $2, $3) RETURNING *",
      [firebaseUid, email, name || ""]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getUserByFirebaseUid(firebaseUid: string) {
  const result = await pool.query(
    "SELECT * FROM users WHERE firebase_uid = $1",
    [firebaseUid]
  );
  return result.rows[0] || null;
}

export async function verifyUserOwnership(
  userId: string,
  resourceType: string,
  resourceId: string
): Promise<boolean> {
  const queries: Record<string, string> = {
    session: "SELECT id FROM sessions WHERE id = $1 AND user_id = $2",
    message: "SELECT id FROM messages WHERE id = $1 AND user_id = $2",
    scan: "SELECT id FROM scans WHERE id = $1 AND user_id = $2",
    analysis: "SELECT id FROM analyses WHERE id = $1 AND user_id = $2",
    monitoring: "SELECT id FROM monitoring WHERE id = $1 AND user_id = $2",
  };
  const query = queries[resourceType];
  if (!query) return false;
  const result = await pool.query(query, [resourceId, userId]);
  return result.rows.length > 0;
}
