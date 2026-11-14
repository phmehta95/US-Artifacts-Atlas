const loginForm = document.querySelector("#reviewer-login-form");
const reviewerPassword = document.querySelector("#reviewer-password");
const loginStatus = document.querySelector("#login-status");
const reviewerQueue = document.querySelector("#reviewer-queue");
const queueStatus = document.querySelector("#queue-status");
const submissionsList = document.querySelector("#review-submissions");
const refreshButton = document.querySelector("#refresh-review-queue");
const logoutButton = document.querySelector("#reviewer-logout");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  loginStatus.textContent = "Signing in…";

  try {
    const response = await fetch("/api/reviewer/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: reviewerPassword.value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not sign in.");
    reviewerPassword.value = "";
    loginForm.hidden = true;
    reviewerQueue.hidden = false;
    await loadReviewQueue();
  } catch (error) {
    loginStatus.textContent = `Could not sign in: ${error.message}`;
  } finally {
    submitButton.disabled = false;
  }
});

refreshButton.addEventListener("click", loadReviewQueue);

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  try {
    const response = await fetch("/api/reviewer/logout", {
      method: "POST",
      credentials: "same-origin"
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not sign out.");
    showLogin("You have signed out.");
  } catch (error) {
    queueStatus.textContent = `Could not sign out: ${error.message}`;
  } finally {
    logoutButton.disabled = false;
  }
});

async function checkReviewerSession() {
  try {
    const response = await fetch("/api/reviewer/session", {
      credentials: "same-origin",
      cache: "no-store"
    });
    const result = await response.json();
    if (response.status === 401) {
      showLogin();
      return;
    }
    if (!response.ok) throw new Error(result.error || "Could not check reviewer access.");
    if (result.authenticated) {
      loginForm.hidden = true;
      reviewerQueue.hidden = false;
      await loadReviewQueue();
    }
  } catch (error) {
    showLogin(error.message);
  }
}

async function loadReviewQueue() {
  refreshButton.disabled = true;
  queueStatus.textContent = "Loading pending submissions…";
  submissionsList.replaceChildren();

  try {
    const response = await fetch("/api/reviewer/queue", {
      credentials: "same-origin",
      cache: "no-store"
    });
    const result = await response.json();
    if (response.status === 401) {
      showLogin("Your reviewer session has expired. Sign in again.");
      return;
    }
    if (!response.ok) throw new Error(result.error || "Could not load pending submissions.");
    if (!Array.isArray(result.submissions)) throw new Error("The review queue response was invalid.");

    if (result.submissions.length === 0) {
      queueStatus.textContent = "There are no submissions awaiting review.";
      return;
    }

    queueStatus.textContent = `${result.submissions.length} submission${result.submissions.length === 1 ? "" : "s"} awaiting review.`;
    for (const submission of result.submissions) {
      submissionsList.append(createSubmissionCard(submission));
    }
  } catch (error) {
    queueStatus.textContent = `Could not load pending submissions: ${error.message}`;
  } finally {
    refreshButton.disabled = false;
  }
}

function createSubmissionCard(submission) {
  const card = document.createElement("article");
  card.className = "review-submission-card";

  const heading = document.createElement("h3");
  heading.textContent = submission.artifactName;
  card.append(heading);

  const category = document.createElement("p");
  category.className = "review-submission-category";
  category.textContent = submission.artifactCategory;
  card.append(category);

  const submitted = document.createElement("p");
  submitted.className = "review-submission-meta";
  submitted.textContent = `Submitted ${new Date(submission.createdAt).toLocaleString()}. Automatically removed after ${new Date(submission.expiresAt).toLocaleString()} if not reviewed.`;
  card.append(submitted);

  if (submission.caption) {
    const caption = document.createElement("p");
    caption.className = "review-submission-caption";
    caption.textContent = submission.caption;
    card.append(caption);
  }

  const previews = document.createElement("div");
  previews.className = "review-preview-grid";
  for (const image of submission.images) {
    const figure = document.createElement("figure");
    const preview = document.createElement("img");
    preview.src = `/api/reviewer/images/${encodeURIComponent(image.id)}`;
    preview.alt = image.filename;
    preview.loading = "lazy";
    preview.decoding = "async";
    preview.referrerPolicy = "no-referrer";
    figure.append(preview);
    const filename = document.createElement("figcaption");
    filename.textContent = image.filename;
    figure.append(filename);
    previews.append(figure);
  }
  card.append(previews);

  const status = document.createElement("p");
  status.className = "review-submission-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  card.append(status);

  const actions = document.createElement("div");
  actions.className = "review-page-actions";
  const approveButton = document.createElement("button");
  approveButton.className = "upload-button";
  approveButton.type = "button";
  approveButton.textContent = "Approve and add to gallery";
  approveButton.addEventListener("click", () => {
    submitReviewDecision(submission.id, "approved", card, status, actions);
  });
  const declineButton = document.createElement("button");
  declineButton.className = "secondary-button";
  declineButton.type = "button";
  declineButton.textContent = "Decline and delete";
  declineButton.addEventListener("click", () => {
    submitReviewDecision(submission.id, "rejected", card, status, actions);
  });
  actions.append(approveButton, declineButton);
  card.append(actions);
  return card;
}

async function submitReviewDecision(submissionId, decision, card, status, actions) {
  const verb = decision === "approved" ? "approve" : "decline and delete";
  if (!window.confirm(`Are you sure you want to ${verb} this image submission?`)) return;

  for (const button of actions.querySelectorAll("button")) button.disabled = true;
  status.textContent = "Saving your decision…";
  try {
    const response = await fetch("/api/reviewer/decision", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, decision })
    });
    const result = await response.json();
    if (response.status === 401) {
      showLogin("Your reviewer session has expired. Sign in again.");
      return;
    }
    if (!response.ok) throw new Error(result.error || "Could not save your decision.");
    status.textContent = result.message;
    card.remove();
    const remaining = submissionsList.children.length;
    if (remaining === 0) queueStatus.textContent = "There are no submissions awaiting review.";
    else queueStatus.textContent = `${remaining} submission${remaining === 1 ? "" : "s"} awaiting review.`;
  } catch (error) {
    status.textContent = `Could not save your decision: ${error.message}`;
    for (const button of actions.querySelectorAll("button")) button.disabled = false;
  }
}

function showLogin(message = "") {
  reviewerQueue.hidden = true;
  loginForm.hidden = false;
  loginStatus.textContent = message;
}

checkReviewerSession();
