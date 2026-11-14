const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_TOTAL_BYTES = 6 * 1024 * 1024;
const MAX_FILES = 5;
const PENDING_SUBMISSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REVIEWER_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const REVIEWER_COOKIE_NAME = "atlas_reviewer";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/submissions") {
      return handleSubmission(request, env);
    }
    if (url.pathname === "/api/reviewer/login") {
      return handleReviewerLogin(request, env);
    }
    if (url.pathname === "/api/reviewer/logout") {
      return handleReviewerLogout(request, env);
    }
    if (url.pathname === "/api/reviewer/session") {
      return handleReviewerSession(request, env);
    }
    if (url.pathname === "/api/reviewer/queue") {
      return handleReviewerQueue(request, env);
    }
    if (url.pathname === "/api/reviewer/decision") {
      return handleReviewerDecision(request, env);
    }
    if (url.pathname.startsWith("/api/reviewer/images/")) {
      return handleReviewerImage(request, env, url.pathname.slice("/api/reviewer/images/".length));
    }
    if (url.pathname === "/api/gallery") {
      return handleGalleryList(request, env);
    }
    if (url.pathname.startsWith("/api/gallery/")) {
      return handleGalleryImage(request, env, url.pathname.slice("/api/gallery/".length));
    }
    if (url.pathname.startsWith("/api/")) {
      return jsonResponse({ error: "Not found." }, 404);
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(cleanupExpiredSubmissions(env));
  }
};

async function handleSubmission(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "POST" });
  }
  if (!isSameOrigin(request)) {
    return jsonResponse({ error: "Submission origin is not allowed." }, 403);
  }
  const unavailable = requireStorageAndRateLimit(env);
  if (unavailable) return unavailable;
  const limitResponse = await enforceRateLimit(request, env);
  if (limitResponse) return limitResponse;

  const contentLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_TOTAL_BYTES + 64 * 1024) {
    return jsonResponse({ error: "The total image upload must not exceed 6 MB." }, 413);
  }
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("multipart/form-data;")) {
    return jsonResponse({ error: "Expected a multipart image submission." }, 415);
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ error: "Could not read the image submission." }, 400);
  }

  const rawFiles = formData.getAll("images");
  if (
    rawFiles.length === 0 ||
    rawFiles.length > MAX_FILES ||
    rawFiles.some((file) => !(file instanceof File) || file.size === 0)
  ) {
    return jsonResponse({ error: "Choose between 1 and 5 non-empty image files." }, 400);
  }

  const artifactId = readTextField(formData, "artifactId", 60);
  const artifactName = readTextField(formData, "artifactName", 100);
  const artifactCategory = readTextField(formData, "artifactCategory", 100);
  const caption = readTextField(formData, "caption", 500);
  if (!/^[a-z0-9-]+$/.test(artifactId) || !artifactName || !artifactCategory) {
    return jsonResponse({ error: "Artifact details are incomplete or invalid." }, 400);
  }

  const submissionId = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + PENDING_SUBMISSION_TTL_MS;
  const images = [];
  let totalBytes = 0;

  for (const file of rawFiles) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES) {
      return jsonResponse({ error: "Use JPEG, PNG or WebP images no larger than 6 MB each." }, 400);
    }
    totalBytes += file.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return jsonResponse({ error: "The total image upload must not exceed 6 MB." }, 413);
    }

    let bytes;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      return jsonResponse({ error: "Could not read an uploaded image." }, 400);
    }
    if (!hasValidImageSignature(bytes, file.type)) {
      return jsonResponse({ error: "An uploaded file does not match its image type." }, 400);
    }
    const imageId = crypto.randomUUID();
    images.push({
      id: imageId,
      filename: sanitizeFilename(file.name),
      contentType: file.type,
      bytes,
      objectKey: `submissions/${submissionId}/${imageId}`,
      sizeBytes: bytes.byteLength
    });
  }

  try {
    for (const image of images) {
      await env.SUBMISSION_IMAGES.put(image.objectKey, image.bytes, {
        httpMetadata: { contentType: image.contentType }
      });
    }
    const statements = [
      env.DB.prepare(
        `INSERT INTO submissions
          (id, artifact_id, artifact_name, artifact_category, caption, status, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
      ).bind(
        submissionId,
        artifactId,
        artifactName,
        artifactCategory,
        caption,
        now,
        expiresAt
      ),
      ...images.map((image) =>
        env.DB.prepare(
          `INSERT INTO submission_images (id, submission_id, filename, content_type, object_key, size_bytes)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          image.id,
          submissionId,
          image.filename,
          image.contentType,
          image.objectKey,
          image.sizeBytes
        )
      )
    ];
    await env.DB.batch(statements);
  } catch (error) {
    await removeUnregisteredImages(env, images);
    console.error("Could not save an image review submission.", error);
    return jsonResponse({ error: "Could not store this submission for review. Please try again later." }, 502);
  }

  return jsonResponse({ accepted: true }, 200);
}

async function handleReviewerLogin(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "POST" });
  }
  if (!isSameOrigin(request)) {
    return jsonResponse({ error: "Reviewer sign-in origin is not allowed." }, 403);
  }
  if (!hasReviewerPassword(env)) {
    return jsonResponse({ error: "Reviewer access is not configured yet." }, 503);
  }
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse({ error: "Expected a JSON sign-in request." }, 415);
  }
  const limitResponse = await enforceRateLimit(request, env);
  if (limitResponse) return limitResponse;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Could not read the reviewer sign-in request." }, 400);
  }
  if (typeof body?.password !== "string" || body.password.length > 512) {
    return jsonResponse({ error: "Enter the reviewer password." }, 400);
  }

  if (!constantTimeEqual(body.password, env.REVIEWER_PASSWORD)) {
    return jsonResponse({ error: "The reviewer password is incorrect." }, 401);
  }

  const session = await createReviewerSession(env.REVIEWER_PASSWORD);
  return jsonResponse({ authenticated: true }, 200, {
    "Set-Cookie": `${REVIEWER_COOKIE_NAME}=${session.value}; HttpOnly; Secure; SameSite=Strict; Path=/api/reviewer; Max-Age=${Math.floor(REVIEWER_SESSION_TTL_MS / 1000)}`
  });
}

async function handleReviewerLogout(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "POST" });
  }
  if (!isSameOrigin(request)) {
    return jsonResponse({ error: "Reviewer sign-out origin is not allowed." }, 403);
  }
  const authResponse = await requireReviewerSession(request, env);
  if (authResponse) return authResponse;
  return jsonResponse({ authenticated: false }, 200, {
    "Set-Cookie": `${REVIEWER_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/api/reviewer; Max-Age=0`
  });
}

async function handleReviewerSession(request, env) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "GET" });
  }
  if (!hasReviewerPassword(env)) {
    return jsonResponse({ error: "Reviewer access is not configured yet." }, 503);
  }
  if (!await hasValidReviewerSession(request, env)) {
    return jsonResponse({ authenticated: false }, 401);
  }
  return jsonResponse({ authenticated: true });
}

async function handleReviewerQueue(request, env) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "GET" });
  }
  const authResponse = await requireReviewerSession(request, env);
  if (authResponse) return authResponse;
  if (!env.DB) return jsonResponse({ error: "Image review storage is not configured yet." }, 503);

  try {
    const result = await env.DB.prepare(
      `SELECT s.id AS submission_id, s.artifact_id, s.artifact_name, s.artifact_category,
              s.caption, s.created_at, s.expires_at, i.id AS image_id, i.filename,
              i.content_type, i.size_bytes
       FROM submissions s
       JOIN submission_images i ON i.submission_id = s.id
       WHERE s.status = 'pending' AND s.expires_at > ?
       ORDER BY s.created_at ASC, i.id ASC`
    ).bind(Date.now()).all();
    const submissions = new Map();
    for (const row of result.results || []) {
      let submission = submissions.get(row.submission_id);
      if (!submission) {
        submission = {
          id: row.submission_id,
          artifactId: row.artifact_id,
          artifactName: row.artifact_name,
          artifactCategory: row.artifact_category,
          caption: row.caption,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
          images: []
        };
        submissions.set(row.submission_id, submission);
      }
      submission.images.push({
        id: row.image_id,
        filename: row.filename,
        contentType: row.content_type,
        sizeBytes: row.size_bytes
      });
    }
    return jsonResponse({ submissions: [...submissions.values()] });
  } catch (error) {
    console.error("Could not load pending image submissions.", error);
    return jsonResponse({ error: "Could not load pending submissions right now." }, 503);
  }
}

async function handleReviewerImage(request, env, imageId) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "GET" });
  }
  const authResponse = await requireReviewerSession(request, env);
  if (authResponse) return authResponse;
  if (!/^[0-9a-f-]{36}$/i.test(imageId) || !env.DB || !env.SUBMISSION_IMAGES) {
    return jsonResponse({ error: "Image not found." }, 404);
  }

  try {
    const image = await env.DB.prepare(
      `SELECT i.object_key, i.content_type
       FROM submission_images i
       JOIN submissions s ON s.id = i.submission_id
       WHERE i.id = ? AND s.status = 'pending' AND s.expires_at > ?`
    ).bind(imageId, Date.now()).first();
    if (!image) return jsonResponse({ error: "Image not found." }, 404);
    const object = await env.SUBMISSION_IMAGES.get(image.object_key);
    if (!object) {
      console.error("A pending reviewer image is missing from private storage.", imageId);
      return jsonResponse({ error: "Image is temporarily unavailable." }, 503);
    }
    return new Response(object.body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": image.content_type,
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer"
      }
    });
  } catch (error) {
    console.error("Could not load a private reviewer image.", error);
    return jsonResponse({ error: "Could not load this image right now." }, 503);
  }
}

async function handleReviewerDecision(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "POST" });
  }
  if (!isSameOrigin(request)) {
    return jsonResponse({ error: "Review decision origin is not allowed." }, 403);
  }
  const authResponse = await requireReviewerSession(request, env);
  if (authResponse) return authResponse;
  const unavailable = requireStorageAndRateLimit(env);
  if (unavailable) return unavailable;
  const limitResponse = await enforceRateLimit(request, env);
  if (limitResponse) return limitResponse;
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse({ error: "Expected a JSON review decision." }, 415);
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return jsonResponse({ error: "Could not read the review decision." }, 400);
  }
  const { submissionId, decision } = body || {};
  if (
    typeof submissionId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(submissionId) ||
    !["approved", "rejected"].includes(decision)
  ) {
    return jsonResponse({ error: "The review decision is incomplete or invalid." }, 400);
  }

  let submission;
  try {
    submission = await env.DB.prepare(
      `SELECT id, status, expires_at FROM submissions WHERE id = ?`
    ).bind(submissionId).first();
  } catch (error) {
    console.error("Could not read an image review submission.", error);
    return jsonResponse({ error: "Could not check this submission. Please try again later." }, 503);
  }
  if (!submission || submission.status !== "pending") {
    return jsonResponse({ error: "This submission has already been reviewed or is no longer available." }, 409);
  }
  if (submission.expires_at <= Date.now()) {
    return jsonResponse({ error: "This submission has expired and will be removed." }, 410);
  }

  const now = Date.now();
  try {
    const update = await env.DB.prepare(
      `UPDATE submissions
       SET status = ?, review_token_hash = NULL, reviewed_at = ?
       WHERE id = ? AND status = 'pending' AND expires_at > ?`
    ).bind(decision, now, submissionId, now).run();
    if (update.meta.changes !== 1) {
      return jsonResponse({ error: "This submission has already been reviewed or is no longer available." }, 409);
    }
  } catch (error) {
    console.error("Could not save an image review decision.", error);
    return jsonResponse({ error: "Could not save this decision. Please try again later." }, 503);
  }

  if (decision === "rejected") {
    try {
      await deleteRejectedSubmission(env, submissionId);
    } catch (error) {
      console.error("A declined image submission could not be fully removed; scheduled cleanup will retry.", error);
    }
    return jsonResponse({ message: "Submission declined. Its image(s) will not appear in the atlas." });
  }
  return jsonResponse({ message: "Submission approved. Its image(s) are now available in the relevant gallery." });
}

async function requireReviewerSession(request, env) {
  if (!hasReviewerPassword(env)) {
    return jsonResponse({ error: "Reviewer access is not configured yet." }, 503);
  }
  if (!await hasValidReviewerSession(request, env)) {
    return jsonResponse({ error: "Please sign in to the reviewer dashboard." }, 401);
  }
  return null;
}

function hasReviewerPassword(env) {
  return typeof env.REVIEWER_PASSWORD === "string" && env.REVIEWER_PASSWORD.length >= 24;
}

async function createReviewerSession(password) {
  const expiresAt = Date.now() + REVIEWER_SESSION_TTL_MS;
  const nonce = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  const payload = `${expiresAt}.${nonce}`;
  const signature = await signReviewerSession(payload, password);
  return { value: `${payload}.${signature}` };
}

async function hasValidReviewerSession(request, env) {
  const cookiePrefix = `${REVIEWER_COOKIE_NAME}=`;
  const cookie = (request.headers.get("Cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(cookiePrefix))
    ?.slice(cookiePrefix.length);
  if (!cookie) return false;

  const match = cookie.match(/^(\d{13})\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/);
  if (!match) return false;
  const expiresAt = Number(match[1]);
  if (expiresAt <= Date.now() || expiresAt > Date.now() + REVIEWER_SESSION_TTL_MS) return false;
  const payload = `${match[1]}.${match[2]}`;
  const expectedSignature = await signReviewerSession(payload, env.REVIEWER_PASSWORD);
  return constantTimeEqual(match[3], expectedSignature);
}

async function signReviewerSession(payload, password) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`reviewer-session:${payload}`)
  );
  return toBase64Url(new Uint8Array(signature));
}

function isSameOrigin(request) {
  return request.headers.get("Origin") === new URL(request.url).origin;
}

async function handleGalleryList(request, env) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "GET" });
  }
  if (!env.DB) return jsonResponse({ error: "Gallery storage is not configured yet." }, 503);
  const artifactId = new URL(request.url).searchParams.get("artifact");
  if (artifactId && !/^[a-z0-9-]{1,60}$/.test(artifactId)) {
    return jsonResponse({ error: "Artifact identifier is invalid." }, 400);
  }
  try {
    const query = artifactId
      ? `SELECT i.id, i.filename, s.artifact_id, s.caption
         FROM submission_images i
         JOIN submissions s ON s.id = i.submission_id
         WHERE s.status = 'approved' AND s.artifact_id = ?
         ORDER BY s.created_at DESC, i.id`
      : `SELECT i.id, i.filename, s.artifact_id, s.caption
         FROM submission_images i
         JOIN submissions s ON s.id = i.submission_id
         WHERE s.status = 'approved'
         ORDER BY s.created_at DESC, i.id`;
    const statement = env.DB.prepare(query);
    const result = artifactId ? await statement.bind(artifactId).all() : await statement.all();
    return jsonResponse({ images: result.results || [] });
  } catch (error) {
    console.error("Could not load approved gallery images.", error);
    return jsonResponse({ error: "Could not load gallery images right now." }, 503);
  }
}

async function handleGalleryImage(request, env, imageId) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, 405, { Allow: "GET" });
  }
  if (!/^[0-9a-f-]{36}$/i.test(imageId) || !env.DB || !env.SUBMISSION_IMAGES) {
    return jsonResponse({ error: "Image not found." }, 404);
  }
  try {
    const image = await env.DB.prepare(
      `SELECT i.object_key, i.content_type
       FROM submission_images i
       JOIN submissions s ON s.id = i.submission_id
       WHERE i.id = ? AND s.status = 'approved'`
    ).bind(imageId).first();
    if (!image) return jsonResponse({ error: "Image not found." }, 404);
    const object = await env.SUBMISSION_IMAGES.get(image.object_key);
    if (!object) {
      console.error("An approved gallery image is missing from private storage.", imageId);
      return jsonResponse({ error: "Image is temporarily unavailable." }, 503);
    }
    return new Response(object.body, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": image.content_type,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("Could not serve an approved gallery image.", error);
    return jsonResponse({ error: "Could not load this image right now." }, 503);
  }
}

async function cleanupExpiredSubmissions(env) {
  if (!env.DB || !env.SUBMISSION_IMAGES) {
    console.error("Scheduled image cleanup cannot run because D1 or R2 is not configured.");
    return;
  }
  const now = Date.now();
  try {
    await env.DB.prepare(
      `UPDATE submissions
       SET status = 'rejected', review_token_hash = NULL
       WHERE status = 'pending' AND expires_at <= ?`
    ).bind(now).run();
    const result = await env.DB.prepare(
      `SELECT id FROM submissions WHERE status = 'rejected' LIMIT 100`
    ).all();
    for (const row of result.results || []) {
      try {
        await deleteRejectedSubmission(env, row.id);
      } catch (error) {
        console.error("Scheduled cleanup could not remove a rejected submission.", row.id, error);
      }
    }
  } catch (error) {
    console.error("Scheduled cleanup could not query expired submissions.", error);
  }
}

async function deleteRejectedSubmission(env, submissionId) {
  const result = await env.DB.prepare(
    `SELECT object_key FROM submission_images WHERE submission_id = ?`
  ).bind(submissionId).all();
  const images = result.results || [];
  await Promise.all(images.map((image) => env.SUBMISSION_IMAGES.delete(image.object_key)));
  await env.DB.prepare("DELETE FROM submission_images WHERE submission_id = ?").bind(submissionId).run();
  await env.DB.prepare(
    "DELETE FROM submissions WHERE id = ? AND status = 'rejected'"
  ).bind(submissionId).run();
}

async function removeUnregisteredImages(env, images) {
  try {
    await Promise.all(images.map((image) => env.SUBMISSION_IMAGES.delete(image.objectKey)));
  } catch (error) {
    console.error("Could not remove images from a failed submission.", error);
  }
}

function requireStorageAndRateLimit(env) {
  if (!env.DB || !env.SUBMISSION_IMAGES) {
    return jsonResponse({ error: "Image review storage is not configured yet." }, 503);
  }
  if (!env.SUBMISSION_RATE_LIMITER) {
    return jsonResponse({ error: "Submission protection is not configured yet." }, 503);
  }
  return null;
}

async function enforceRateLimit(request, env) {
  try {
    const result = await env.SUBMISSION_RATE_LIMITER.limit({
      key: request.headers.get("CF-Connecting-IP") || "unknown"
    });
    if (!result.success) {
      return jsonResponse({ error: "Too many requests. Please try again later." }, 429, { "Retry-After": "60" });
    }
    return null;
  } catch (error) {
    console.error("Could not check the image review rate limit.", error);
    return jsonResponse({ error: "Request protection is temporarily unavailable." }, 503);
  }
}

function readTextField(formData, name, maximumLength) {
  const value = formData.get(name);
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maximumLength);
}

function sanitizeFilename(filename) {
  return filename.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120) || "image";
}

function hasValidImageSignature(bytes, contentType) {
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  return contentType === "image/webp" &&
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function toBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function toBase64Url(bytes) {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}
