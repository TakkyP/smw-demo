import "server-only";
import { GridFSBucket, MongoClient, ObjectId, type Collection, type Db } from "mongodb";
import type { AssignedType, ReviewStatus, Role, TaskStatus, UserStatus } from "@/types";

// ---------- Document shapes (what is stored in MongoDB) ----------

export interface UserDoc {
  _id: ObjectId;
  firebase_uid: string;
  username: string;
  name: string;
  phone: string;
  email: string;
  role: Role;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
  // Passwords are never stored here: Firebase Authentication owns them.
}

export interface TaskDoc {
  _id: ObjectId;
  code: string;
  title: string;
  description: string;
  location: string;
  assigned_type: AssignedType;
  assigned_user: ObjectId | null;
  status: TaskStatus;
  /** Status before archiving, so Restore can put it back exactly. */
  previous_status: TaskStatus | null;
  due_date: Date | null;
  is_archived: boolean;
  created_by: ObjectId;
  created_at: Date;
  updated_at: Date;
  claimed_at: Date | null;
}

export interface SubmissionDoc {
  _id: ObjectId;
  task_id: ObjectId;
  user_id: ObjectId;
  note: string;
  image_urls: string[];
  submitted_at: Date;
  review_status: ReviewStatus;
  review_note: string;
  reviewed_by: ObjectId | null;
  reviewed_at: Date | null;
}

export interface PasswordHistoryDoc {
  _id: ObjectId;
  user_id: ObjectId;
  changed_at: Date;
  changed_by: ObjectId;
}

interface CounterDoc {
  _id: string;
  seq: number;
}

// ---------- Connection (reused across hot reloads and serverless invocations) ----------

const globalForMongo = globalThis as unknown as {
  _mongoClient?: Promise<MongoClient>;
  _mongoIndexes?: Promise<void>;
};

function getClient(): Promise<MongoClient> {
  if (!globalForMongo._mongoClient) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set");
    globalForMongo._mongoClient = new MongoClient(uri, { maxPoolSize: 10 }).connect();
  }
  return globalForMongo._mongoClient;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  const db = client.db(process.env.MONGODB_DB || "worklist");
  if (!globalForMongo._mongoIndexes) {
    globalForMongo._mongoIndexes = ensureIndexes(db).catch((err) => {
      globalForMongo._mongoIndexes = undefined;
      throw err;
    });
  }
  await globalForMongo._mongoIndexes;
  return db;
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection("users").createIndex({ username: 1 }, { unique: true }),
    db.collection("users").createIndex({ firebase_uid: 1 }, { unique: true }),
    db.collection("tasks").createIndex({ code: 1 }, { unique: true }),
    db.collection("tasks").createIndex({ is_archived: 1, status: 1 }),
    db.collection("tasks").createIndex({ assigned_user: 1 }),
    db.collection("task_submissions").createIndex({ task_id: 1, submitted_at: -1 }),
    db.collection("password_history").createIndex({ user_id: 1, changed_at: -1 }),
  ]);
}

export async function collections() {
  const db = await getDb();
  return {
    users: db.collection<UserDoc>("users") as Collection<UserDoc>,
    tasks: db.collection<TaskDoc>("tasks") as Collection<TaskDoc>,
    submissions: db.collection<SubmissionDoc>("task_submissions") as Collection<SubmissionDoc>,
    passwordHistory: db.collection<PasswordHistoryDoc>("password_history") as Collection<PasswordHistoryDoc>,
    counters: db.collection<CounterDoc>("counters") as Collection<CounterDoc>,
  };
}

/** Images are stored in MongoDB GridFS so the system needs only MongoDB + Firebase Auth. */
export async function imageBucket(): Promise<GridFSBucket> {
  return new GridFSBucket(await getDb(), { bucketName: "images" });
}

/** Human-friendly sequential task code, e.g. T-00042. */
export async function nextTaskCode(): Promise<string> {
  const { counters } = await collections();
  const res = await counters.findOneAndUpdate(
    { _id: "task" },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  return `T-${String(res?.seq ?? 1).padStart(5, "0")}`;
}

export function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) && String(new ObjectId(id)) === id ? new ObjectId(id) : null;
}
