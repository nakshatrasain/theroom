const state = {
  attendees: [],
  matches: [],
  selectedAttendeeId: null,
  currentProfile: null,
  authProfile: null,
  currentMatchIndex: 0,
  config: null,
  authMode: "signup",
  authSession: null,
};

const screens = Array.from(document.querySelectorAll("[data-screen]"));
const authTabs = Array.from(document.querySelectorAll("[data-auth-tab]"));
const authToggle = document.querySelector("#authToggle");
const authForm = document.querySelector("#authForm");
const authNameField = document.querySelector("#authNameField");
const authEmailField = document.querySelector("#authEmailField");
const authPasswordField = document.querySelector("#authPasswordField");
const authNote = document.querySelector("#authNote");
const authSubmitButton = document.querySelector("#authSubmitButton");
const oauthDivider = document.querySelector("#oauthDivider");
const googleAuthButton = document.querySelector("#googleAuthButton");
const profileForm = document.querySelector("#profileForm");
const logoutButton = document.querySelector("#logoutButton");
const matchTriggerButton = document.querySelector("#matchTriggerButton");
const matchingStatus = document.querySelector("#matchingStatus");
const matchesState = document.querySelector("#matchesState");
const matchesExperience = document.querySelector("#matchesExperience");
const matchSummary = document.querySelector("#matchSummary");
const swipeStack = document.querySelector("#swipeStack");
const swipeProgress = document.querySelector("#swipeProgress");
const passButton = document.querySelector("#passButton");
const inspectButton = document.querySelector("#inspectButton");
const saveMatchButton = document.querySelector("#saveMatchButton");
const directoryList = document.querySelector("#directoryList");
const directorySummary = document.querySelector("#directorySummary");
const detailName = document.querySelector("#detailName");
const detailSubtitle = document.querySelector("#detailSubtitle");
const detailCard = document.querySelector("#detailCard");
const introOutput = document.querySelector("#introOutput");
const generateIntroButton = document.querySelector("#generateIntroButton");
const requestConnectionButton = document.querySelector("#requestConnectionButton");
const sendMessageButton = document.querySelector("#sendMessageButton");
const directorySearch = document.querySelector("#directorySearch");
const directoryFilter = document.querySelector("#directoryFilter");

function setActiveScreen(name) {
  screens.forEach((screen) => {
    screen.classList.toggle("is-active", screen.dataset.screen === name);
  });
}

function normalizeList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function inferBio(profile) {
  const role = profile.role || "Builder";
  const interest = profile.build_interest || profile.event_goal || "meeting interesting people at the event";
  const strongest = profile.skills.join(", ") || profile.strength_zone || "collaboration";
  return `${role} focused on ${interest}. Strongest in ${strongest}.`;
}

function preferredContact(profile) {
  return (
    profile.linkedin_handle ||
    profile.instagram_handle ||
    profile.x_handle ||
    profile.contact_handle ||
    "No contact shared yet"
  );
}

function contactMethods(profile) {
  return [
    profile.linkedin_handle ? `LinkedIn: ${profile.linkedin_handle}` : null,
    profile.instagram_handle ? `Instagram: ${profile.instagram_handle}` : null,
    profile.x_handle ? `X: ${profile.x_handle}` : null,
    profile.contact_handle &&
    ![profile.linkedin_handle, profile.instagram_handle, profile.x_handle].includes(profile.contact_handle)
      ? `Contact: ${profile.contact_handle}`
      : null,
  ].filter(Boolean);
}

function looksLikeUrl(value) {
  return /^https?:\/\//i.test(value);
}

function normalizeUrl(value, base) {
  if (!value) {
    return null;
  }

  if (looksLikeUrl(value)) {
    return value;
  }

  return `${base}${value.replace(/^@/, "")}`;
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function primaryContactAction(attendee) {
  if (attendee.linkedin_handle) {
    return {
      label: "LinkedIn",
      url: normalizeUrl(attendee.linkedin_handle, "https://www.linkedin.com/in/"),
    };
  }

  if (attendee.x_handle) {
    return {
      label: "X",
      url: normalizeUrl(attendee.x_handle, "https://x.com/"),
    };
  }

  if (attendee.instagram_handle) {
    return {
      label: "Instagram",
      url: normalizeUrl(attendee.instagram_handle, "https://www.instagram.com/"),
    };
  }

  if (isEmail(attendee.contact_handle)) {
    return {
      label: "Email",
      url: `mailto:${attendee.contact_handle}`,
    };
  }

  if (attendee.contact_handle) {
    return {
      label: "Contact",
      url: attendee.contact_handle,
    };
  }

  return null;
}

function fallbackIntroMessage(attendee) {
  const senderName = state.currentProfile?.name || "I";
  const project = state.currentProfile?.build_interest || state.currentProfile?.event_goal || "a project at this event";
  return `Hey ${attendee.name}, I’m ${senderName}. The Room suggested we connect because it looks like there could be a strong fit. I’m exploring ${project}. Open to chatting for 10 minutes?`;
}

async function copyText(value) {
  if (!value) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (_error) {
    return false;
  }
}

function setupProfileFromForm(form) {
  const formData = new FormData(form);
  const baseName = state.authProfile?.name || "Guest";
  const linkedinHandle = String(formData.get("linkedin_handle") || "").trim();
  const instagramHandle = String(formData.get("instagram_handle") || "").trim();
  const xHandle = String(formData.get("x_handle") || "").trim();

  const profile = {
    name: baseName,
    role: String(formData.get("role") || "").trim(),
    skills: normalizeList(String(formData.get("skills") || "")),
    event_goal: String(formData.get("event_goal") || "").trim(),
    build_interest: String(formData.get("build_interest") || "").trim(),
    build_style: "visionary",
    pace: "fast-moving",
    collaboration: "balanced",
    strength_zone: "product",
    looking_for: String(formData.get("looking_for") || "").trim(),
    linkedin_handle: linkedinHandle,
    instagram_handle: instagramHandle,
    x_handle: xHandle,
    contact_handle: linkedinHandle || instagramHandle || xHandle,
  };

  return {
    ...profile,
    bio: inferBio(profile),
  };
}

function fillSetupForm(profile) {
  if (!profile) {
    return;
  }

  const fields = {
    role: profile.role || "",
    skills: Array.isArray(profile.skills) ? profile.skills.join(", ") : "",
    event_goal: profile.event_goal || "Find a teammate and build this weekend",
    build_interest: profile.build_interest || "",
    looking_for: profile.looking_for || "",
    linkedin_handle: profile.linkedin_handle || "",
    instagram_handle: profile.instagram_handle || "",
    x_handle: profile.x_handle || "",
  };

  Object.entries(fields).forEach(([name, value]) => {
    const field = profileForm.elements.namedItem(name);
    if (field) {
      field.value = value;
    }
  });

  syncChoiceGroup("event_goal", fields.event_goal);
}

function setMessage(target, text, isError = false) {
  target.hidden = false;
  target.textContent = text;
  target.className = `empty-state${isError ? " is-error" : ""}`;
}

function renderStatuses() {
  if (!state.config) {
    return;
  }

  const guestMode = !state.config.supabase_enabled || !state.config.supabase_ready;
  const emailInput = authForm.elements.namedItem("email");
  const passwordInput = authForm.elements.namedItem("password");

  authToggle.hidden = guestMode;
  authEmailField.hidden = guestMode;
  authPasswordField.hidden = guestMode;
  oauthDivider.hidden = guestMode;
  googleAuthButton.hidden = guestMode;

  if (guestMode) {
    state.authMode = "guest";
    authTabs.forEach((tab) => tab.classList.remove("is-active"));
    emailInput.required = false;
    passwordInput.required = false;
    emailInput.value = "";
    passwordInput.value = "";
    authSubmitButton.textContent = "Continue as guest";
    authNote.textContent =
      "Supabase auth is not configured on this deployment, so you can enter with your name and try the app in guest mode.";
  } else {
    if (state.authMode === "guest") {
      state.authMode = "signup";
    }
    emailInput.required = true;
    passwordInput.required = true;
    authSubmitButton.textContent = "Continue";
    authNote.textContent = "Sign in, step into the room, and let the matching begin.";
    authTabs.forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.authTab === state.authMode);
    });
  }

  syncAuthMode();
}

function currentMatch() {
  return state.matches[state.currentMatchIndex] || null;
}

function renderSwipeProgress() {
  swipeProgress.innerHTML = state.matches
    .map((_, index) => {
      let className = "";
      if (index < state.currentMatchIndex) {
        className = "is-done";
      } else if (index === state.currentMatchIndex) {
        className = "is-active";
      }
      return `<span class="${className}"></span>`;
    })
    .join("");
}

function renderMatches() {
  if (!state.matches.length) {
    matchesExperience.hidden = true;
    setMessage(matchesState, "No stack yet. Complete the setup to generate matches.");
    return;
  }

  matchesState.hidden = true;
  matchesExperience.hidden = false;
  swipeStack.innerHTML = state.matches
    .map((match, index) => {
      const positionClass =
        index < state.currentMatchIndex
          ? "is-hidden"
          : index === state.currentMatchIndex
            ? "is-top"
            : index === state.currentMatchIndex + 1
              ? "is-next"
              : "";

      return `
        <article class="match-card ${positionClass}" data-card-index="${index}">
          <div class="card-topline">
            <span class="fit-badge">${match.score}% fit</span>
            <div class="card-stats">
              <span class="meta-pill">${match.attendee.strength_zone}</span>
              <span class="meta-pill">${match.attendee.build_style}</span>
            </div>
          </div>
          <div>
            <h3>${match.attendee.name}</h3>
            <p class="match-role">${match.attendee.role}</p>
          </div>
          <p class="match-reason">${match.why}</p>
          <div class="cue-grid">
            <article class="cue-card">
              <strong>Looking for</strong>
              <span>${match.attendee.looking_for}</span>
            </article>
            <article class="cue-card">
              <strong>Pace</strong>
              <span>${match.attendee.pace}</span>
            </article>
            <article class="cue-card">
              <strong>Contact</strong>
              <span>${preferredContact(match.attendee)}</span>
            </article>
          </div>
          <div class="tag-row">
            ${match.attendee.skills.map((skill) => `<span class="tag">${skill}</span>`).join("")}
          </div>
        </article>
      `;
    })
    .join("");

  renderSwipeProgress();
  const top = currentMatch();
  if (top) {
    selectAttendee(top.attendee.id);
  }
}

function filteredAttendees() {
  const search = directorySearch.value.trim().toLowerCase();
  const filter = directoryFilter.value;

  return state.attendees.filter((attendee) => {
    const matchesFilter = filter === "all" || attendee.strength_zone === filter;
    if (!matchesFilter) {
      return false;
    }

    if (!search) {
      return true;
    }

    const haystack = [
      attendee.name,
      attendee.role,
      attendee.bio,
      attendee.event_goal,
      attendee.build_interest,
      attendee.strength_zone,
      attendee.build_style,
      ...(attendee.skills || []),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });
}

function renderDirectory() {
  const attendees = filteredAttendees();
  directorySummary.textContent = `${attendees.length} attendee${attendees.length === 1 ? "" : "s"} visible`;

  directoryList.innerHTML = attendees
    .map(
      (attendee) => `
        <article class="directory-item ${attendee.id === state.selectedAttendeeId ? "is-active" : ""}" data-directory-id="${attendee.id}">
          <header>
            <div>
              <h3>${attendee.name}</h3>
              <p>${attendee.role}</p>
            </div>
            <span class="meta-pill">${attendee.strength_zone}</span>
          </header>
          <p>${attendee.bio}</p>
          <div class="tag-row">
            ${attendee.skills.map((skill) => `<span class="tag">${skill}</span>`).join("")}
          </div>
        </article>
      `
    )
    .join("");

  directoryList.querySelectorAll("[data-directory-id]").forEach((item) => {
    item.addEventListener("click", () => {
      selectAttendee(item.dataset.directoryId);
    });
  });
}

function attendeeById(id) {
  return state.attendees.find((attendee) => attendee.id === id) || null;
}

function selectAttendee(id) {
  state.selectedAttendeeId = id;
  renderDirectory();
  renderDetail();
}

function renderDetail() {
  const attendee = attendeeById(state.selectedAttendeeId);
  if (!attendee) {
    detailName.textContent = "Open a card to see the connection.";
    detailSubtitle.textContent = "This is where the AI context turns into a real conversation.";
    detailCard.className = "detail-card empty-state";
    detailCard.textContent = "Swipe or tap “Why this fit” on a card.";
    requestConnectionButton.disabled = true;
    sendMessageButton.disabled = true;
    return;
  }

  const match = state.matches.find((item) => item.attendee.id === attendee.id);
  detailName.textContent = attendee.name;
  detailSubtitle.textContent = attendee.role;
  detailCard.className = "detail-card";
  detailCard.innerHTML = `
    <div class="detail-grid">
      <section class="detail-column">
        <h4>Why this fit works</h4>
        <p>${match ? match.why : "The Room has not ranked this attendee for you yet, but you can still connect."}</p>
      </section>
      <section class="detail-column">
        <h4>What they bring</h4>
        <div class="tag-row">
          ${attendee.skills.map((skill) => `<span class="tag">${skill}</span>`).join("")}
        </div>
        <p>${attendee.bio}</p>
      </section>
      <section class="detail-column">
        <h4>Context</h4>
        <p><strong>Goal:</strong> ${attendee.event_goal}</p>
        <p><strong>Building:</strong> ${attendee.build_interest}</p>
        <p><strong>Looking for:</strong> ${attendee.looking_for}</p>
        <p><strong>Contact:</strong> ${contactMethods(attendee).join(" · ") || "No contact shared yet"}</p>
      </section>
      <section class="detail-column">
        <h4>Working style</h4>
        <p><strong>Build style:</strong> ${attendee.build_style}</p>
        <p><strong>Pace:</strong> ${attendee.pace}</p>
        <p><strong>Collaboration:</strong> ${attendee.collaboration}</p>
        <p><strong>Strength:</strong> ${attendee.strength_zone}</p>
      </section>
    </div>
  `;

  const hasContactAction = Boolean(primaryContactAction(attendee));
  requestConnectionButton.disabled = !hasContactAction;
  sendMessageButton.disabled = !hasContactAction;
}

function syncChoiceGroup(name, value) {
  const hidden = profileForm.elements.namedItem(name);
  if (hidden) {
    hidden.value = value;
  }

  document
    .querySelectorAll(`[data-choice-group="${name}"] [data-choice-value]`)
    .forEach((button) => {
      button.classList.toggle("is-active", button.dataset.choiceValue === value);
    });
}

function attachChoiceGroups() {
  document.querySelectorAll("[data-choice-group]").forEach((group) => {
    group.querySelectorAll("[data-choice-value]").forEach((button) => {
      button.addEventListener("click", () => {
        syncChoiceGroup(group.dataset.choiceGroup, button.dataset.choiceValue);
      });
    });
  });
}

function attachAuthTabs() {
  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.authMode = tab.dataset.authTab;
      authTabs.forEach((item) => item.classList.toggle("is-active", item === tab));
      syncAuthMode();
    });
  });
}

function syncAuthMode() {
  const nameInput = authForm.elements.namedItem("name");
  const isGuest = state.authMode === "guest";
  const isSignIn = state.authMode === "signin";

  authNameField.hidden = isSignIn && !isGuest;
  nameInput.required = !isSignIn || isGuest;
  if (isSignIn) {
    nameInput.value = "";
  } else if (state.authProfile?.name) {
    nameInput.value = state.authProfile.name;
  }
}

function persistAuth(result, mode, fallbackPayload = {}) {
  state.authProfile = {
    mode,
    name: result.user?.name || fallbackPayload.name || "Guest",
    email: result.user?.email || fallbackPayload.email || "",
    id: result.user?.id || "",
  };
  state.authSession = result.session || null;
  localStorage.setItem("the-room-auth", JSON.stringify(state.authProfile));
  if (state.authSession) {
    localStorage.setItem("the-room-auth-session", JSON.stringify(state.authSession));
  } else {
    localStorage.removeItem("the-room-auth-session");
  }
  logoutButton.hidden = false;
}

function authCallbackParams() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  return new URLSearchParams(hash);
}

async function restoreOAuthSessionFromUrl() {
  const params = authCallbackParams();
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const errorDescription = params.get("error_description");

  if (!accessToken && !errorDescription) {
    return false;
  }

  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);

  if (errorDescription) {
    throw new Error(errorDescription.replace(/\+/g, " "));
  }

  const session = {
    access_token: accessToken,
    refresh_token: refreshToken || "",
    expires_in: Number(params.get("expires_in") || 0),
    token_type: params.get("token_type") || "bearer",
  };

  const payload = await request("/api/auth/session", {
    method: "POST",
    body: JSON.stringify({ access_token: session.access_token }),
  });

  persistAuth({ user: payload.user, session }, "google");
  return true;
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Request failed");
  }

  return response.json();
}

async function authenticate(mode, payload) {
  if (mode === "guest") {
    return {
      user: {
        id: `guest-${(payload.name || "guest").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "guest"}`,
        email: "",
        name: payload.name || "Guest",
      },
      session: null,
      requires_confirmation: false,
      guest: true,
    };
  }

  const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/signin";
  return request(endpoint, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function beginGoogleAuth() {
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  window.location.assign(`/api/auth/google?redirect_to=${encodeURIComponent(redirectTo)}`);
}

async function loadConfig() {
  state.config = await request("/api/config");
  renderStatuses();
}

async function loadAttendees() {
  const payload = await request("/api/attendees");
  state.attendees = payload.attendees;
  renderDirectory();
}

async function saveProfile(profile) {
  const payload = await request("/api/profile", {
    method: "POST",
    body: JSON.stringify({ profile }),
  });

  state.currentProfile = payload.profile;
  localStorage.setItem("the-room-profile", JSON.stringify(state.currentProfile));
  await loadAttendees();
}

async function generateMatches(profile) {
  matchTriggerButton.disabled = true;
  matchTriggerButton.classList.add("is-loading");
  matchingStatus.textContent = "Reading the room and ranking your best matches...";
  state.currentMatchIndex = 0;
  state.selectedAttendeeId = null;
  matchesExperience.hidden = true;
  setMessage(matchesState, "Building your first stack...");

  try {
    await saveProfile(profile);
    const payload = await request("/api/match", {
      method: "POST",
      body: JSON.stringify({ profile }),
    });

    state.currentProfile = payload.profile;
    state.matches = payload.matches;
    matchSummary.textContent = payload.summary;

    const ids = new Set(payload.matches.map((match) => match.attendee.id));
    state.attendees = [...state.attendees].sort((left, right) => {
      const leftBoost = ids.has(left.id) ? -1 : 1;
      const rightBoost = ids.has(right.id) ? -1 : 1;
      return leftBoost - rightBoost;
    });

    renderMatches();
    renderDirectory();
    setActiveScreen("results");
    matchingStatus.textContent = "Your matches are ready.";
  } finally {
    matchTriggerButton.disabled = false;
    matchTriggerButton.classList.remove("is-loading");
  }
}

async function generateIntro() {
  const attendee = attendeeById(state.selectedAttendeeId);
  if (!state.currentProfile || !attendee) {
    introOutput.value = "Choose a card first.";
    return;
  }

  generateIntroButton.disabled = true;
  introOutput.value = "Drafting a stronger intro...";

  try {
    const payload = await request("/api/intro", {
      method: "POST",
      body: JSON.stringify({
        profile: state.currentProfile,
        attendee,
      }),
    });
    introOutput.value = payload.message;
  } catch (error) {
    introOutput.value = error.message;
  } finally {
    generateIntroButton.disabled = false;
  }
}

function requestConnection() {
  const attendee = attendeeById(state.selectedAttendeeId);
  if (!attendee) {
    introOutput.value = "Choose someone first.";
    return;
  }

  const action = primaryContactAction(attendee);
  if (!action?.url) {
    introOutput.value = `${attendee.name} has not shared a contact method yet.`;
    return;
  }

  window.open(action.url, "_blank", "noopener,noreferrer");
  introOutput.value = `Opened ${action.label} for ${attendee.name}.`;
}

async function sendMessage() {
  const attendee = attendeeById(state.selectedAttendeeId);
  if (!attendee) {
    introOutput.value = "Choose someone first.";
    return;
  }

  const action = primaryContactAction(attendee);
  if (!action?.url) {
    introOutput.value = `${attendee.name} has not shared a contact method yet.`;
    return;
  }

  const message = introOutput.value.trim() || fallbackIntroMessage(attendee);
  const copied = await copyText(message);

  if (action.label === "Email") {
    const subject = encodeURIComponent(`Quick hello from ${state.currentProfile?.name || "The Room"}`);
    const body = encodeURIComponent(message);
    window.open(`${action.url}?subject=${subject}&body=${body}`, "_blank", "noopener,noreferrer");
  } else {
    window.open(action.url, "_blank", "noopener,noreferrer");
  }

  introOutput.value = copied
    ? `Opened ${action.label} for ${attendee.name}. Your message is copied and ready to paste.`
    : `Opened ${action.label} for ${attendee.name}. Paste the intro message manually if needed.`;
}

function logout() {
  const finalize = () => {
    state.authProfile = null;
    state.authSession = null;
    state.currentProfile = null;
    state.matches = [];
    state.selectedAttendeeId = null;
    state.currentMatchIndex = 0;
    localStorage.removeItem("the-room-auth");
    localStorage.removeItem("the-room-auth-session");
    localStorage.removeItem("the-room-profile");
    authForm.reset();
    profileForm.reset();
    syncChoiceGroup("event_goal", "Find a teammate and build this weekend");
    matchesExperience.hidden = true;
    setMessage(matchesState, "No stack yet. Complete the setup to generate matches.");
    detailCard.className = "detail-card empty-state";
    detailCard.textContent = "Swipe or tap “Why this fit” on a card.";
    introOutput.value = "";
    requestConnectionButton.disabled = true;
    sendMessageButton.disabled = true;
    logoutButton.hidden = true;
    syncAuthMode();
    setActiveScreen("landing");
  };

  if (state.authSession?.access_token) {
    request("/api/auth/signout", {
      method: "POST",
      body: JSON.stringify({ access_token: state.authSession.access_token }),
    })
      .catch(() => null)
      .finally(finalize);
    return;
  }

  finalize();
}

function animateTopCard(direction) {
  const card = swipeStack.querySelector(`[data-card-index="${state.currentMatchIndex}"]`);
  if (!card) {
    return;
  }
  card.classList.add(direction === "save" ? "is-saving" : "is-passing");
}

function advanceMatch(direction) {
  const match = currentMatch();
  if (!match) {
    return;
  }

  animateTopCard(direction);

  window.setTimeout(() => {
    state.currentMatchIndex += 1;
    const next = currentMatch();
    renderMatches();
    if (next) {
      selectAttendee(next.attendee.id);
    } else {
      detailName.textContent = "You cleared the stack.";
      detailSubtitle.textContent = "Explore the full room or go back and generate fresh matches.";
      detailCard.className = "detail-card empty-state";
      detailCard.textContent = "You’ve reached the end of your first stack.";
    }
  }, 180);
}

function inspectCurrentMatch() {
  const match = currentMatch();
  if (!match) {
    return;
  }
  selectAttendee(match.attendee.id);
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(authForm);
  const payload = {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    password: String(formData.get("password") || "").trim(),
  };

  const submitButton = authForm.querySelector("button[type='submit']");
  submitButton.disabled = true;

  try {
    const result = await authenticate(state.authMode, payload);
    if (result.requires_confirmation) {
      throw new Error("Check your email to confirm your account before signing in.")
    }

    persistAuth(result, state.authMode, payload);
    setActiveScreen("setup");
  } catch (error) {
    alert(error.message);
  } finally {
    submitButton.disabled = false;
  }
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await generateMatches(setupProfileFromForm(profileForm));
  } catch (error) {
    matchingStatus.textContent = error.message;
    setMessage(matchesState, error.message, true);
  }
});

matchTriggerButton.addEventListener("click", async () => {
  try {
    await generateMatches(setupProfileFromForm(profileForm));
  } catch (error) {
    matchingStatus.textContent = error.message;
    setMessage(matchesState, error.message, true);
  }
});

passButton.addEventListener("click", () => advanceMatch("pass"));
saveMatchButton.addEventListener("click", () => advanceMatch("save"));
inspectButton.addEventListener("click", inspectCurrentMatch);
generateIntroButton.addEventListener("click", generateIntro);
requestConnectionButton.addEventListener("click", requestConnection);
sendMessageButton.addEventListener("click", sendMessage);
logoutButton.addEventListener("click", logout);
googleAuthButton.addEventListener("click", beginGoogleAuth);
directorySearch.addEventListener("input", renderDirectory);
directoryFilter.addEventListener("change", renderDirectory);

async function bootstrap() {
  attachAuthTabs();
  attachChoiceGroups();
  syncAuthMode();

  const savedAuth = localStorage.getItem("the-room-auth");
  if (savedAuth) {
    try {
      state.authProfile = JSON.parse(savedAuth);
      if (state.authProfile.name) {
        authForm.elements.namedItem("name").value = state.authProfile.name;
      }
      if (state.authProfile.email) {
        authForm.elements.namedItem("email").value = state.authProfile.email;
      }
      logoutButton.hidden = false;
    } catch (_error) {
      localStorage.removeItem("the-room-auth");
    }
  }

  const savedSession = localStorage.getItem("the-room-auth-session");
  if (savedSession) {
    try {
      state.authSession = JSON.parse(savedSession);
    } catch (_error) {
      localStorage.removeItem("the-room-auth-session");
    }
  }

  const savedProfile = localStorage.getItem("the-room-profile");
  if (savedProfile) {
    try {
      state.currentProfile = JSON.parse(savedProfile);
      fillSetupForm(state.currentProfile);
    } catch (_error) {
      localStorage.removeItem("the-room-profile");
    }
  }

  await loadConfig();
  const restoredFromOAuth = await restoreOAuthSessionFromUrl();
  await loadAttendees();
  requestConnectionButton.disabled = true;
  sendMessageButton.disabled = true;
  if (restoredFromOAuth || state.authProfile) {
    setActiveScreen("setup");
    return;
  }
  setActiveScreen("landing");
}

bootstrap().catch((error) => {
  matchesState.hidden = false;
  matchesState.className = "empty-state is-error";
  matchesState.textContent = error.message;
});
