import assert from "node:assert/strict";
import { File } from "node:buffer";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { webcrypto } from "node:crypto";

globalThis.crypto ||= webcrypto;
globalThis.File ||= File;

const REVIEWER_PASSWORD = "test-reviewer-password-with-at-least-24-characters";
const workerSource = await readFile(new URL("../worker.js", import.meta.url), "utf8");
const { default: worker } = await import(
  `data:text/javascript;base64,${Buffer.from(workerSource).toString("base64")}`
);
const jpegBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0x00, 0x01]);

test("pending images stay private until an authenticated reviewer approves them", async () => {
  const { env, database, objects } = createEnvironment();
  const submissionResponse = await submitImage(env);
  assert.equal(submissionResponse.status, 200);
  const submissionResult = await submissionResponse.json();
  assert.equal(submissionResult.accepted, true);
  assert.equal(submissionResult.notificationSent, false);

  const submissionId = [...database.submissions.keys()][0];
  const image = [...database.images.values()][0];
  assert.equal(objects.size, 1);
  assert.equal((await getGallery(env, "reverberation")).images.length, 0);

  const unauthenticatedQueue = await worker.fetch(
    new Request("https://atlas.test/api/reviewer/queue"),
    env
  );
  assert.equal(unauthenticatedQueue.status, 401);
  const privateImage = await worker.fetch(
    new Request(`https://atlas.test/api/reviewer/images/${image.id}`),
    env
  );
  assert.equal(privateImage.status, 401);
  const publicImage = await worker.fetch(
    new Request(`https://atlas.test/api/gallery/${image.id}`),
    env
  );
  assert.equal(publicImage.status, 404);

  assert.equal((await signIn(env, "wrong reviewer password")).status, 401);
  const loginResponse = await signIn(env, REVIEWER_PASSWORD);
  assert.equal(loginResponse.status, 200);
  const cookie = loginResponse.headers.get("Set-Cookie").split(";")[0];
  assert.match(loginResponse.headers.get("Set-Cookie"), /HttpOnly; Secure; SameSite=Strict/);

  const queueResponse = await worker.fetch(
    new Request("https://atlas.test/api/reviewer/queue", {
      headers: { Cookie: cookie }
    }),
    env
  );
  assert.equal(queueResponse.status, 200);
  const queue = await queueResponse.json();
  assert.equal(queue.submissions.length, 1);
  assert.equal(queue.submissions[0].id, submissionId);
  assert.equal(queue.submissions[0].images[0].id, image.id);
  assert.equal("objectKey" in queue.submissions[0].images[0], false);

  const authenticatedImage = await worker.fetch(
    new Request(`https://atlas.test/api/reviewer/images/${image.id}`, {
      headers: { Cookie: cookie }
    }),
    env
  );
  assert.equal(authenticatedImage.status, 200);
  assert.deepEqual(new Uint8Array(await authenticatedImage.arrayBuffer()), jpegBytes);
  assert.equal(authenticatedImage.headers.get("Cache-Control"), "private, no-store");

  const tamperedCookie = `${cookie.slice(0, -1)}${cookie.endsWith("A") ? "B" : "A"}`;
  const tamperedSession = await worker.fetch(
    new Request("https://atlas.test/api/reviewer/queue", {
      headers: { Cookie: tamperedCookie }
    }),
    env
  );
  assert.equal(tamperedSession.status, 401);

  const approved = await decide(env, cookie, submissionId, "approved");
  assert.equal(approved.status, 200);
  assert.match((await approved.json()).message, /now available/);
  const gallery = await getGallery(env, "reverberation");
  assert.equal(gallery.images.length, 1);
  assert.equal(gallery.images[0].caption, "Review caption");
  const publishedImage = await worker.fetch(
    new Request(`https://atlas.test/api/gallery/${image.id}`),
    env
  );
  assert.equal(publishedImage.status, 200);
  assert.deepEqual(new Uint8Array(await publishedImage.arrayBuffer()), jpegBytes);
  const noLongerPrivatePreview = await worker.fetch(
    new Request(`https://atlas.test/api/reviewer/images/${image.id}`, {
      headers: { Cookie: cookie }
    }),
    env
  );
  assert.equal(noLongerPrivatePreview.status, 404);
  assert.equal((await decide(env, cookie, submissionId, "approved")).status, 409);

  const logout = await worker.fetch(new Request("https://atlas.test/api/reviewer/logout", {
    method: "POST",
    headers: {
      Origin: "https://atlas.test",
      Cookie: cookie
    }
  }), env);
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("Set-Cookie"), /Max-Age=0/);
  const signedOutQueue = await worker.fetch(
    new Request("https://atlas.test/api/reviewer/queue"),
    env
  );
  assert.equal(signedOutQueue.status, 401);
});

test("decline and expiry remove stored images without publishing them", async () => {
  const { env, database, objects } = createEnvironment();
  const cookie = await reviewerCookie(env);

  await submitImage(env);
  const declinedId = [...database.submissions.keys()][0];
  const declinedImageId = [...database.images.keys()][0];
  assert.equal((await decide(env, cookie, declinedId, "rejected")).status, 200);
  assert.equal(objects.size, 0);
  assert.equal(database.submissions.has(declinedId), false);
  assert.equal((await worker.fetch(
    new Request(`https://atlas.test/api/gallery/${declinedImageId}`),
    env
  )).status, 404);

  await submitImage(env);
  const expiredId = [...database.submissions.keys()][0];
  const expiredImageId = [...database.images.keys()][0];
  database.submissions.get(expiredId).expires_at = Date.now() - 1;
  let cleanup;
  await worker.scheduled({}, env, { waitUntil(promise) { cleanup = promise; } });
  await cleanup;
  assert.equal(database.submissions.has(expiredId), false);
  assert.equal(objects.size, 0);
  assert.equal((await worker.fetch(
    new Request(`https://atlas.test/api/gallery/${expiredImageId}`),
    env
  )).status, 404);
});

test("sends a Resend notification after saving a private image submission", async () => {
  const { env, database, objects } = createEnvironment();
  env.RESEND_API_KEY = "re_test_key";
  const originalFetch = globalThis.fetch;
  let resendRequest;
  globalThis.fetch = async (url, options) => {
    assert.equal(database.submissions.size, 1);
    assert.equal(objects.size, 1);
    resendRequest = { url, options };
    return new Response(JSON.stringify({ id: "email_test_id" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    const response = await submitImage(env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { accepted: true, notificationSent: true });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(resendRequest.url, "https://api.resend.com/emails");
  assert.equal(resendRequest.options.headers.Authorization, "Bearer re_test_key");
  const email = JSON.parse(resendRequest.options.body);
  assert.equal(email.from, "Ultrasound Artifact Atlas <onboarding@resend.dev>");
  assert.deepEqual(email.to, ["pruthvi.mehta@nhs.net"]);
  assert.match(email.text, /awaiting review/);
  assert.match(email.text, /\/review\.html/);
  assert.doesNotMatch(email.text, /Review caption|sample\.jpg/);
});

test("reports a Resend delivery failure without losing the private submission", async () => {
  const { env, database, objects } = createEnvironment();
  env.RESEND_API_KEY = "re_test_key";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("Unauthorized", { status: 401 });

  try {
    const response = await submitImage(env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { accepted: true, notificationSent: false });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(database.submissions.size, 1);
  assert.equal(objects.size, 1);
});

test("reviewers can delete approved images individually from the gallery", async () => {
  const { env, database, objects } = createEnvironment();
  const cookie = await reviewerCookie(env);

  await submitImage(env, 2);
  const submissionId = [...database.submissions.keys()][0];
  const imageIds = [...database.images.keys()];
  assert.equal((await decide(env, cookie, submissionId, "approved")).status, 200);

  const unauthenticatedDelete = await worker.fetch(new Request(
    `https://atlas.test/api/reviewer/gallery/${imageIds[0]}`,
    {
      method: "DELETE",
      headers: { Origin: "https://atlas.test" }
    }
  ), env);
  assert.equal(unauthenticatedDelete.status, 401);

  const listResponse = await worker.fetch(new Request("https://atlas.test/api/reviewer/gallery", {
    headers: { Cookie: cookie }
  }), env);
  assert.equal(listResponse.status, 200);
  assert.equal((await listResponse.json()).images.length, 2);

  const firstDelete = await deleteApprovedImage(env, cookie, imageIds[0]);
  assert.equal(firstDelete.status, 200);
  assert.equal(database.submissions.get(submissionId).status, "approved");
  assert.equal((await getGallery(env, "reverberation")).images.length, 1);
  assert.equal((await worker.fetch(
    new Request(`https://atlas.test/api/gallery/${imageIds[0]}`),
    env
  )).status, 404);
  assert.equal(objects.size, 1);

  const lastDelete = await deleteApprovedImage(env, cookie, imageIds[1]);
  assert.equal(lastDelete.status, 200);
  assert.equal(database.submissions.has(submissionId), false);
  assert.equal((await getGallery(env, "reverberation")).images.length, 0);
  assert.equal(objects.size, 0);
});

test("reviewer login rejects cross-origin requests and unconfigured access", async () => {
  const { env } = createEnvironment();
  const crossOrigin = await worker.fetch(new Request("https://atlas.test/api/reviewer/login", {
    method: "POST",
    headers: {
      Origin: "https://other.test",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ password: REVIEWER_PASSWORD })
  }), env);
  assert.equal(crossOrigin.status, 403);

  const unconfigured = await worker.fetch(new Request("https://atlas.test/api/reviewer/login", {
    method: "POST",
    headers: {
      Origin: "https://atlas.test",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ password: REVIEWER_PASSWORD })
  }), { ...env, REVIEWER_PASSWORD: "" });
  assert.equal(unconfigured.status, 503);
});

async function submitImage(env, imageCount = 1) {
  const form = new FormData();
  for (let index = 0; index < imageCount; index += 1) {
    const filename = imageCount === 1 ? "sample.jpg" : `sample-${index + 1}.jpg`;
    form.append("images", new File([jpegBytes], filename, { type: "image/jpeg" }));
  }
  form.set("artifactId", "reverberation");
  form.set("artifactName", "Reverberation");
  form.set("artifactCategory", "Acoustic artifacts");
  form.set("caption", "Review caption");
  return worker.fetch(new Request("https://atlas.test/api/submissions", {
    method: "POST",
    headers: { Origin: "https://atlas.test" },
    body: form
  }), env);
}

async function signIn(env, password) {
  return worker.fetch(new Request("https://atlas.test/api/reviewer/login", {
    method: "POST",
    headers: {
      Origin: "https://atlas.test",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ password })
  }), env);
}

async function reviewerCookie(env) {
  const response = await signIn(env, REVIEWER_PASSWORD);
  assert.equal(response.status, 200);
  return response.headers.get("Set-Cookie").split(";")[0];
}

async function decide(env, cookie, submissionId, decision) {
  return worker.fetch(new Request("https://atlas.test/api/reviewer/decision", {
    method: "POST",
    headers: {
      Origin: "https://atlas.test",
      Cookie: cookie,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ submissionId, decision })
  }), env);
}

async function deleteApprovedImage(env, cookie, imageId) {
  return worker.fetch(new Request(`https://atlas.test/api/reviewer/gallery/${imageId}`, {
    method: "DELETE",
    headers: {
      Origin: "https://atlas.test",
      Cookie: cookie
    }
  }), env);
}

async function getGallery(env, artifactId) {
  const response = await worker.fetch(
    new Request(`https://atlas.test/api/gallery?artifact=${artifactId}`),
    env
  );
  assert.equal(response.status, 200);
  return response.json();
}

function createEnvironment() {
  const database = new MemoryD1();
  const objects = new Map();
  return {
    database,
    objects,
    env: {
      DB: database,
      SUBMISSION_IMAGES: {
        async put(key, value) { objects.set(key, new Uint8Array(value)); },
        async get(key) {
          if (!objects.has(key)) return null;
          return { body: new Blob([objects.get(key)]).stream() };
        },
        async delete(key) { objects.delete(key); }
      },
      SUBMISSION_RATE_LIMITER: { async limit() { return { success: true }; } },
      REVIEWER_PASSWORD,
      ASSETS: { async fetch() { return new Response("not found", { status: 404 }); } }
    }
  };
}

class MemoryD1 {
  constructor() {
    this.submissions = new Map();
    this.images = new Map();
  }

  prepare(sql) {
    return new MemoryStatement(this, sql);
  }

  async batch(statements) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}

class MemoryStatement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql.trim();
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  async run() {
    const { submissions, images } = this.database;
    if (this.sql.startsWith("INSERT INTO submissions")) {
      const [id, artifact_id, artifact_name, artifact_category, caption, created_at, expires_at] = this.values;
      submissions.set(id, { id, artifact_id, artifact_name, artifact_category, caption, status: "pending", created_at, expires_at });
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("INSERT INTO submission_images")) {
      const [id, submission_id, filename, content_type, object_key, size_bytes] = this.values;
      images.set(id, { id, submission_id, filename, content_type, object_key, size_bytes });
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("DELETE FROM submission_images") && this.sql.includes("WHERE id = ?")) {
      const [id, submission_id] = this.values;
      const image = images.get(id);
      const submission = submissions.get(submission_id);
      if (image?.submission_id === submission_id && submission?.status === "approved") {
        images.delete(id);
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    }
    if (this.sql.startsWith("UPDATE submissions") && this.sql.includes("SET status = ?, review_token_hash = NULL")) {
      const [status, reviewed_at, id, now] = this.values;
      const submission = submissions.get(id);
      if (submission?.status === "pending" && submission.expires_at > now) {
        Object.assign(submission, { status, review_token_hash: null, reviewed_at });
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    }
    if (this.sql.startsWith("UPDATE submissions") && this.sql.includes("WHERE status = 'pending' AND expires_at <= ?")) {
      let changes = 0;
      for (const submission of submissions.values()) {
        if (submission.status === "pending" && submission.expires_at <= this.values[0]) {
          Object.assign(submission, { status: "rejected", review_token_hash: null });
          changes += 1;
        }
      }
      return { meta: { changes } };
    }
    if (this.sql.startsWith("DELETE FROM submission_images")) {
      let changes = 0;
      for (const [id, image] of images) {
        if (image.submission_id === this.values[0]) {
          images.delete(id);
          changes += 1;
        }
      }
      return { meta: { changes } };
    }
    if (this.sql.startsWith("DELETE FROM submissions")) {
      const submission = submissions.get(this.values[0]);
      if (this.sql.includes("status = 'approved'")) {
        const hasImages = [...images.values()].some((image) => image.submission_id === this.values[0]);
        if (submission?.status === "approved" && !hasImages) {
          submissions.delete(this.values[0]);
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      }
      if (submission?.status === "rejected") {
        submissions.delete(this.values[0]);
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    }
    throw new Error(`Unexpected run query: ${this.sql}`);
  }

  async first() {
    const { submissions, images } = this.database;
    if (this.sql.startsWith("SELECT id, status, expires_at FROM submissions")) {
      const submission = submissions.get(this.values[0]);
      return submission && {
        id: submission.id,
        status: submission.status,
        expires_at: submission.expires_at
      };
    }
    if (this.sql.startsWith("SELECT i.object_key, i.content_type")) {
      const image = images.get(this.values[0]);
      const submission = image && submissions.get(image.submission_id);
      const now = this.values[1];
      const expectedStatus = this.sql.includes("s.status = 'approved'") ? "approved" : "pending";
      return image && submission?.status === expectedStatus &&
        (!this.sql.includes("s.expires_at > ?") || submission.expires_at > now)
        ? { object_key: image.object_key, content_type: image.content_type }
        : null;
    }
    if (this.sql.startsWith("SELECT i.submission_id, i.object_key")) {
      const image = images.get(this.values[0]);
      const submission = image && submissions.get(image.submission_id);
      return image && submission?.status === "approved"
        ? { submission_id: image.submission_id, object_key: image.object_key }
        : null;
    }
    throw new Error(`Unexpected first query: ${this.sql}`);
  }

  async all() {
    const { submissions, images } = this.database;
    if (this.sql.startsWith("SELECT s.id AS submission_id")) {
      const now = this.values[0];
      return { results: [...images.values()].flatMap((image) => {
        const submission = submissions.get(image.submission_id);
        if (!submission || submission.status !== "pending" || submission.expires_at <= now) return [];
        return [{
          submission_id: submission.id,
          artifact_id: submission.artifact_id,
          artifact_name: submission.artifact_name,
          artifact_category: submission.artifact_category,
          caption: submission.caption,
          created_at: submission.created_at,
          expires_at: submission.expires_at,
          image_id: image.id,
          filename: image.filename,
          content_type: image.content_type,
          size_bytes: image.size_bytes
        }];
      }) };
    }
    if (this.sql.startsWith("SELECT i.id, i.filename, s.artifact_id, s.caption")) {
      const artifactId = this.values[0];
      return { results: [...images.values()].flatMap((image) => {
        const submission = submissions.get(image.submission_id);
        if (!submission || submission.status !== "approved" || (artifactId && submission.artifact_id !== artifactId)) return [];
        return [{ id: image.id, filename: image.filename, artifact_id: submission.artifact_id, caption: submission.caption }];
      }) };
    }
    if (this.sql.startsWith("SELECT i.id, i.filename, s.artifact_id AS artifactId")) {
      return { results: [...images.values()].flatMap((image) => {
        const submission = submissions.get(image.submission_id);
        if (!submission || submission.status !== "approved") return [];
        return [{
          id: image.id,
          filename: image.filename,
          artifactId: submission.artifact_id,
          artifactName: submission.artifact_name,
          artifactCategory: submission.artifact_category
        }];
      }) };
    }
    if (this.sql.startsWith("SELECT object_key FROM submission_images")) {
      return { results: [...images.values()]
        .filter((image) => image.submission_id === this.values[0])
        .map((image) => ({ object_key: image.object_key })) };
    }
    if (this.sql.startsWith("SELECT id FROM submissions WHERE status = 'rejected'")) {
      return { results: [...submissions.values()]
        .filter((submission) => submission.status === "rejected")
        .map((submission) => ({ id: submission.id })) };
    }
    throw new Error(`Unexpected all query: ${this.sql}`);
  }
}
