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
const authForm = document.querySelector("#authForm");
const authNameField = document.querySelector("#authNameField");
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
  return `${profile.role} focused on ${profile.build_interest}. Strongest in ${profile.skills.join(", ") || profile.strength_zone}.`;
}

function setupProfileFromForm(form) {
  const formData = new FormData(form);
  const baseName = state.authProfile?.name || "Guest";

  const profile = {
    name: baseName,
    role: String(formData.get("role") || "").trim(),
    skills: normalizeList(String(formData.get("skills") || "")),
    event_goal: String(formData.get("event_goal") || "").trim(),
    build_interest: String(formData.get("build_interest") || "").trim(),
    build_style: String(formData.get("build_style") || "").trim(),
    pace: String(formData.get("pace") || "").trim(),
    collaboration: "balanced",
    strength_zone: String(formData.get("strength_zone") || "").trim(),
    looking_for: String(formData.get("looking_for") || "").trim(),
    contact_handle: String(formData.get("contact_handle") || "").trim(),
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
    build_style: profile.build_style || "visionary",
    pace: profile.pace || "fast-moving",
    strength_zone: profile.strength_zone || "product",
    looking_for: profile.looking_for || "",
    contact_handle: profile.contact_handle || "",
  };

  Object.entries(fields).forEach(([name, value]) => {
    const field = profileForm.elements.namedItem(name);
    if (field) {
      field.value = value;
    }
  });

  syncChoiceGroup("event_goal", fields.event_goal);
  syncChoiceGroup("build_style", fields.build_style);
  syncChoiceGroup("pace", fields.pace);
  syncChoiceGroup("strength_zone", fields.strength_zone);
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
              <span>${match.attendee.contact_handle}</span>
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
        <p><strong>Contact:</strong> ${attendee.contact_handle}</p>
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

  requestConnectionButton.disabled = false;
  sendMessageButton.disabled = false;
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
  const isSignIn = state.authMode === "signin";

  authNameField.hidden = isSignIn;
  nameInput.required = !isSignIn;
  if (isSignIn) {
    nameInput.value = "";
  } else if (state.authProfile?.name) {
    nameInput.value = state.authProfile.name;
  }
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
  const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/signin";
  return request(endpoint, {
    method: "POST",
    body: JSON.stringify(payload),
  });
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

  introOutput.value = `Connection request ready for ${attendee.name}.`;
}

function sendMessage() {
  const attendee = attendeeById(state.selectedAttendeeId);
  if (!attendee) {
    introOutput.value = "Choose someone first.";
    return;
  }

  introOutput.value = `Opening message flow for ${attendee.name}...`;
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
    syncChoiceGroup("build_style", "visionary");
    syncChoiceGroup("pace", "fast-moving");
    syncChoiceGroup("strength_zone", "product");
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

    state.authProfile = {
      mode: state.authMode,
      name: result.user?.name || payload.name || "Guest",
      email: result.user?.email || payload.email,
      id: result.user?.id || "",
    };
    state.authSession = result.session || null;
    localStorage.setItem("the-room-auth", JSON.stringify(state.authProfile));
    if (state.authSession) {
      localStorage.setItem("the-room-auth-session", JSON.stringify(state.authSession));
    }
    logoutButton.hidden = false;
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
  await loadAttendees();
  requestConnectionButton.disabled = true;
  sendMessageButton.disabled = true;
  setActiveScreen("landing");
}

bootstrap().catch((error) => {
  matchesState.hidden = false;
  matchesState.className = "empty-state is-error";
  matchesState.textContent = error.message;
});
