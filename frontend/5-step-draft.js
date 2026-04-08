const SYSTEM_REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const STEP_BEATS = {
  sequence: [
    { group: "hero", delay: 0 },
    { group: "transform", delay: 520 },
    { group: "caption", delay: 1180 },
    { group: "secondary", delay: 1560 },
  ],
  fragment: [
    { group: "hero", delay: 0 },
    { group: "transform", delay: 480 },
    { group: "resolve", delay: 900 },
    { group: "caption", delay: 1680 },
    { group: "secondary", delay: 2040 },
  ],
  fit: [
    { group: "hero", delay: 0 },
    { group: "transform", delay: 520 },
    { group: "resolve", delay: 1320 },
    { group: "caption", delay: 1720 },
    { group: "secondary", delay: 2040 },
  ],
  ranking: [
    { group: "hero", delay: 0 },
    { group: "transform", delay: 520 },
    { group: "resolve", delay: 1080 },
    { group: "caption", delay: 1480 },
    { group: "secondary", delay: 1840 },
  ],
  assembly: [
    { group: "hero", delay: 0 },
    { group: "transform", delay: 560 },
    { group: "resolve", delay: 980 },
    { group: "caption", delay: 1880 },
    { group: "secondary", delay: 2220 },
  ],
  handoff: [
    { group: "caption", delay: 0 },
    { group: "secondary", delay: 340 },
  ],
};

const state = {
  forceMotion: false,
};

const stepTimers = new WeakMap();

function isReducedMotionActive() {
  return SYSTEM_REDUCED_MOTION && !state.forceMotion;
}

function getBeatNodes(step, group) {
  return step.querySelectorAll(`.beat[data-beat-group="${group}"]`);
}

function clearStepTimers(step) {
  const timers = stepTimers.get(step) || [];
  timers.forEach((id) => window.clearTimeout(id));
  stepTimers.set(step, []);
}

function queueStepTimer(step, id) {
  const timers = stepTimers.get(step) || [];
  timers.push(id);
  stepTimers.set(step, timers);
}

function revealBeatGroup(step, group) {
  getBeatNodes(step, group).forEach((node) => {
    node.classList.add("is-visible");
  });
}

function showCompletedState(step) {
  step.classList.add("is-active", "is-complete");
  step.querySelectorAll(".beat").forEach((node) => {
    node.classList.add("is-visible");
  });
}

function resetStep(step) {
  clearStepTimers(step);
  step.classList.remove("is-complete");
  step.querySelectorAll(".beat").forEach((node) => {
    node.classList.remove("is-visible");
  });
}

function playStep(step, { replay = false } = {}) {
  const stepName = step.dataset.step;
  const sequence = STEP_BEATS[stepName] || [];

  clearStepTimers(step);
  step.classList.add("is-active");
  step.classList.toggle("is-replaying", replay);
  step.classList.remove("is-complete");

  if (isReducedMotionActive()) {
    showCompletedState(step);
    return;
  }

  resetStep(step);

  // Force style recalculation so replay starts from the hidden state.
  void step.offsetWidth;

  sequence.forEach(({ group, delay }) => {
    const timer = window.setTimeout(() => {
      revealBeatGroup(step, group);
    }, delay);
    queueStepTimer(step, timer);
  });

  const finalDelay = (sequence.at(-1)?.delay || 0) + 900;
  const doneTimer = window.setTimeout(() => {
    step.classList.add("is-complete");
    step.classList.remove("is-replaying");
  }, finalDelay);
  queueStepTimer(step, doneTimer);
}

function updateMotionUI() {
  const status = document.getElementById("motion-status");
  const button = document.getElementById("motion-toggle");
  if (!status || !button) return;

  if (isReducedMotionActive()) {
    document.body.classList.add("reduced-motion");
    status.textContent = "Motion: Reduced by system";
    button.textContent = "Force motion on";
  } else if (SYSTEM_REDUCED_MOTION && state.forceMotion) {
    document.body.classList.remove("reduced-motion");
    status.textContent = "Motion: Forced on";
    button.textContent = "Use reduced mode";
  } else {
    document.body.classList.remove("reduced-motion");
    status.textContent = "Motion: Auto";
    button.textContent = "Replay all";
  }
}

function replayAllSteps() {
  document.querySelectorAll(".motion-step").forEach((step, index) => {
    window.setTimeout(() => {
      playStep(step, { replay: true });
    }, index * 180);
  });
}

function setupMotionToggle() {
  const button = document.getElementById("motion-toggle");
  if (!button) return;

  button.addEventListener("click", () => {
    if (SYSTEM_REDUCED_MOTION) {
      state.forceMotion = !state.forceMotion;
      updateMotionUI();
      replayAllSteps();
      return;
    }

    replayAllSteps();
  });
}

function setupReplayButtons() {
  document.querySelectorAll(".motion-step").forEach((step) => {
    const button = step.querySelector(".replay-btn");
    if (!button) return;

    button.addEventListener("click", () => {
      playStep(step, { replay: true });
    });
  });
}

function setupScrollTrigger() {
  const steps = document.querySelectorAll(".motion-step");

  if (isReducedMotionActive()) {
    steps.forEach((step) => showCompletedState(step));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const step = entry.target;
      if (step.classList.contains("is-complete")) return;
      playStep(step);
      observer.unobserve(step);
    });
  }, {
    threshold: 0.18,
    rootMargin: "0px 0px -8% 0px",
  });

  steps.forEach((step) => observer.observe(step));

  const firstVisibleStep = Array.from(steps).find((step) => {
    const rect = step.getBoundingClientRect();
    return rect.top < window.innerHeight * 0.8 && rect.bottom > 0;
  });

  if (firstVisibleStep && !firstVisibleStep.classList.contains("is-complete")) {
    playStep(firstVisibleStep);
    observer.unobserve(firstVisibleStep);
  }
}

updateMotionUI();
setupMotionToggle();
setupReplayButtons();
setupScrollTrigger();
