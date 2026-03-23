// ============================================
// GLANCE — Main App Controller
// ============================================

import { getState, setState, onStateChange, addRewards } from './state.js';
import { checkStreak, recordStudySession, reviveStreak, resetStreak } from './streak.js';
import {
    loadQuestions, createSprint, getCurrentQuestion,
    getStepData, checkAnswer, recordStepResult,
    getSprintSummary, endSprint,
    createBlitz, getCurrentBlitzQuestion, submitBlitzAnswer, getBlitzSummary, endBlitz
} from './questions.js';
import { checkStreakMilestones } from './rewards.js';
import {
    hapticTap, hapticSuccess, playSound, showConfetti,
    initAudioOnInteraction
} from './animations.js';
import { getCurrentUser, signUpUser, signInUser, signOutUser, syncStateToCloud, fetchStateFromCloud, signInWithGoogle, onAuthChange } from './supabase.js';

// --- Screen Management ---
const screens = ['screen-splash', 'screen-home', 'screen-games', 'screen-profile', 'screen-question', 'screen-blitz', 'screen-success', 'screen-sprint-complete', 'screen-revive'];

function showScreen(screenId) {
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.toggle('active', id === screenId);
        }
    });

    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) {
        // Show nav only on main hub/game/profile tabs
        const isTabScreen = ['screen-home', 'screen-games', 'screen-profile'].includes(screenId);
        bottomNav.style.display = isTabScreen ? 'flex' : 'none';
        bottomNav.classList.toggle('hidden', !isTabScreen);
    }
}

// --- Bottom Nav Handle ---
function switchTab(targetId) {
    showScreen(targetId);
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.target === targetId);
    });
}

// --- Sprint State ---
let currentQuestions = [];
let currentQuestion = null;
let currentStepIndex = 0;
let selectedOptionIndex = null;
let hasChecked = false;
let stepXPEarned = 0;
let stepCoinsEarned = 0;
let questionXP = 0;
let questionCoins = 0;

// --- Update Home Screen UI ---
async function updateHomeScreen() {
    const state = getState();

    // Check Cloud Auth State
    const user = await getCurrentUser();

    // Streak
    const streakEl = document.getElementById('streak-count');
    if (streakEl) streakEl.textContent = state.streak;

    // XP & Coins
    const xpEl = document.getElementById('home-xp');
    if (xpEl) xpEl.textContent = `${state.xp} XP`;

    const coinsEl = document.getElementById('home-coins');
    if (coinsEl) coinsEl.textContent = state.coins;

    // Goal (check if sprint exists and how many questions answered)
    const sprint = state.currentSprint;
    let progress = 0;
    if (sprint && sprint.results) {
        progress = sprint.results.length;
    }
    const goalText = document.getElementById('goal-text');
    if (goalText) goalText.textContent = `Today: ${progress} / 2`;
    const goalFill = document.getElementById('goal-fill');
    if (goalFill) goalFill.style.width = `${(progress / 2) * 100}%`;

    // --- Update Profile Screen ---
    const profileName = document.getElementById('profile-name-text');
    const profileEmail = document.getElementById('profile-email-text');
    const btnLoginModal = document.getElementById('btn-login-modal');
    const btnLogout = document.getElementById('btn-logout');

    if (user && profileName) {
        profileName.textContent = user.email.split('@')[0];
        profileEmail.textContent = user.email;
        if (btnLoginModal) btnLoginModal.classList.add('hidden');
        if (btnLogout) btnLogout.classList.remove('hidden');
    } else if (profileName) {
        profileName.textContent = 'Guest Learner';
        profileEmail.textContent = 'Offline progress only';
        if (btnLoginModal) btnLoginModal.classList.remove('hidden');
        if (btnLogout) btnLogout.classList.add('hidden');
    }

    const profileXp = document.getElementById('profile-xp');
    if (profileXp) profileXp.textContent = state.xp;

    // For now longest streak is just current streak since we dont track historical max
    const profileStreakMax = document.getElementById('profile-streak-max');
    if (profileStreakMax) profileStreakMax.textContent = state.streak;

    // Calculate global accuracy from sprintHistory
    let totalSteps = 0;
    let correctSteps = 0;
    (state.sprintHistory || []).forEach(s => {
        if (!s || !s.results) return;
        s.results.forEach(r => {
            if (!r || !r.stepsCorrect) return;
            totalSteps += r.stepsCorrect.length;
            correctSteps += r.stepsCorrect.filter(Boolean).length;
        });
    });

    const accuracy = totalSteps > 0 ? Math.round((correctSteps / totalSteps) * 100) : 0;
    const profileAccuracy = document.getElementById('profile-accuracy');
    if (profileAccuracy) profileAccuracy.textContent = `${accuracy}%`;

    const profileMastered = document.getElementById('profile-mastered');
    if (profileMastered) profileMastered.textContent = state.questionsCompleted ? state.questionsCompleted.length : 0;

    const errorsCount = state.errorBank ? state.errorBank.length : 0;
    const profileErrors = document.getElementById('profile-errors-count');
    if (profileErrors) profileErrors.textContent = `${errorsCount} mistakes logged`;
}

// --- Render Subject Hubs (Home) ---
function renderHubs() {
    const physicsHub = document.getElementById('hub-physics');
    const mathHub = document.getElementById('hub-math');
    if (!physicsHub || !mathHub) return;

    physicsHub.innerHTML = '';
    mathHub.innerHTML = '';

    const state = getState();
    const completedCount = state.questionsCompleted ? state.questionsCompleted.length : 0;

    // Very simple mockup mastery scale: Every completed question gives 2% everywhere for demo 
    const mockMastery = Math.min(100, completedCount * 2);

    const physicsTopics = [
        { id: 'Kinematics', icon: '🚀' },
        { id: 'Forces', icon: '🍎' },
        { id: 'Energy', icon: '⚡' },
        { id: 'Optics', icon: '🔦' }
    ];

    const mathTopics = [
        { id: 'Algebra', icon: '✖️' },
        { id: 'Calculus', icon: '📈' },
        { id: 'Trig', icon: '📐' },
        { id: 'Geometry', icon: '🧊' }
    ];

    const createNode = (topic) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'path-node-wrapper';

        const node = document.createElement('div');
        node.className = 'path-node';
        if (mockMastery >= 100) node.classList.add('mastered');

        // Apply a realistic radial mastery ring
        node.style.background = `conic-gradient(var(--accent-dark) 0%, var(--accent-dark) ${mockMastery}%, var(--bg-card) ${mockMastery}%, var(--bg-card) 100%)`;

        node.innerHTML = `
            <div style="background:var(--bg-card); width: 68px; height: 68px; border-radius: 50%; display: flex; align-items:center; justify-content:center;">
                ${topic.icon}
            </div>
            <div class="node-mastery">${mockMastery}%</div>
        `;

        node.addEventListener('click', () => {
            hapticTap();
            showModeSheet(topic.id);
        });

        const label = document.createElement('div');
        label.className = 'node-label';
        label.textContent = topic.id;

        wrapper.appendChild(node);
        wrapper.appendChild(label);
        return wrapper;
    };

    physicsTopics.forEach(t => physicsHub.appendChild(createNode(t)));
    mathTopics.forEach(t => mathHub.appendChild(createNode(t)));
}
// --- Hub Tab Toggle Listeners ---
function initHubTabs() {
    document.querySelectorAll('.hub-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.hub-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');

            const targetHub = e.target.dataset.hub;
            document.getElementById('hub-physics').classList.toggle('hidden', targetHub !== 'physics');
            document.getElementById('hub-math').classList.toggle('hidden', targetHub !== 'math');
            hapticTap();
        });
    });
}
initHubTabs();
// --- Mode Sheet Controller ---
let selectedTopicForMode = null;

function showModeSheet(topicId) {
    selectedTopicForMode = topicId;
    const sheet = document.getElementById('mode-sheet');
    const topicLabel = document.getElementById('mode-sheet-topic');
    if (topicLabel) topicLabel.textContent = topicId;
    if (sheet) sheet.classList.remove('hidden');
}

function hideModeSheet() {
    const sheet = document.getElementById('mode-sheet');
    if (sheet) sheet.classList.add('hidden');
    selectedTopicForMode = null;
}

// --- Mode Selection Listeners ---
function initModeSheet() {
    const btnSprint = document.getElementById('btn-choose-sprint');
    const btnBlitz = document.getElementById('btn-choose-blitz');
    const btnClose = document.getElementById('btn-close-sheet');
    const overlay = document.getElementById('mode-sheet');

    if (btnSprint) {
        btnSprint.addEventListener('click', () => {
            hapticTap();
            hideModeSheet();
            if (selectedTopicForMode) handleStartSprint(selectedTopicForMode);
        });
    }

    if (btnBlitz) {
        btnBlitz.addEventListener('click', () => {
            hapticTap();
            hideModeSheet();
            handleStartBlitz(); // For now Blitz is random mock, but we could pass topic in future
        });
    }

    if (btnClose) btnClose.addEventListener('click', hideModeSheet);
    if (overlay) overlay.addEventListener('click', (e) => {
        if (e.target === overlay) hideModeSheet();
    });
}
initModeSheet();

// --- Render Question Step ---
function renderQuestionStep() {
    const state = getState();
    const sprint = state.currentSprint;
    if (!sprint) return;

    currentQuestion = getCurrentQuestion();
    if (!currentQuestion) return;

    currentStepIndex = sprint.stepIndex;
    selectedOptionIndex = null;
    hasChecked = false;
    stepXPEarned = 0;
    stepCoinsEarned = 0;

    // Context
    document.getElementById('question-context').textContent = currentQuestion.context;

    // Progress bar
    for (let i = 0; i < 3; i++) {
        const seg = document.getElementById(`seg-${i}`);
        seg.classList.remove('completed', 'active');
        if (i < currentStepIndex) {
            seg.classList.add('completed');
        } else if (i === currentStepIndex) {
            seg.classList.add('active');
        }
    }

    // Reset all accordion steps
    for (let i = 0; i < 3; i++) {
        const accordion = document.getElementById(`accordion-step-${i}`);
        if (i < currentStepIndex) {
            // Show collapsed summary for completed steps
            accordion.classList.remove('hidden');
            accordion.classList.add('collapsed');
            accordion.style.maxHeight = '48px';
            const step = getStepData(currentQuestion, i);
            document.getElementById(`collapsed-text-${i}`).textContent =
                `${step.label}: ${step.summary}`;
        } else if (i === currentStepIndex) {
            // Show current step
            accordion.classList.remove('hidden', 'collapsed');
            accordion.style.maxHeight = 'none';
        } else {
            // Hide future steps
            accordion.classList.add('hidden');
            accordion.classList.remove('collapsed');
        }
    }

    // Render current step
    const step = getStepData(currentQuestion, currentStepIndex);
    if (!step) return;

    // Step label
    const stepLabels = ['Step 1: Concept', 'Step 2: Formula', 'Step 3: Calculation'];
    document.getElementById(`step-label-${currentStepIndex}`).textContent = stepLabels[currentStepIndex];

    // Options
    const optionsContainer = document.getElementById(`options-${currentStepIndex}`);
    optionsContainer.innerHTML = '';
    step.options.forEach((optionText, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.setAttribute('aria-label', optionText);
        btn.dataset.index = index;

        const indicator = document.createElement('span');
        indicator.className = 'option-indicator';
        indicator.textContent = String.fromCharCode(65 + index); // A, B, C

        const text = document.createElement('span');
        text.className = 'option-text';
        text.textContent = optionText;

        const feedback = document.createElement('span');
        feedback.className = 'option-feedback';

        btn.appendChild(indicator);
        btn.appendChild(text);
        btn.appendChild(feedback);

        btn.addEventListener('click', () => selectOption(index));
        optionsContainer.appendChild(btn);
    });

    // Reset feedback
    const feedbackEl = document.getElementById(`feedback-${currentStepIndex}`);
    feedbackEl.className = 'feedback-banner';
    feedbackEl.querySelector('.feedback-icon').textContent = '';
    feedbackEl.querySelector('.feedback-text').textContent = '';

    // Buttons
    document.getElementById('btn-check').classList.remove('hidden');
    document.getElementById('btn-check').disabled = true;
    document.getElementById('btn-continue').classList.add('hidden');
}

// --- Option Selection ---
function selectOption(index) {
    if (hasChecked) return;

    hapticTap();
    selectedOptionIndex = index;

    // Update UI
    const optionsContainer = document.getElementById(`options-${currentStepIndex}`);
    const buttons = optionsContainer.querySelectorAll('.option-btn');
    buttons.forEach((btn, i) => {
        btn.classList.toggle('selected', i === index);
    });

    // Enable check button
    document.getElementById('btn-check').disabled = false;
}

// --- Check Answer ---
function handleCheck() {
    if (selectedOptionIndex === null || hasChecked) return;

    hasChecked = true;
    const isCorrect = checkAnswer(currentQuestion, currentStepIndex, selectedOptionIndex);
    const step = getStepData(currentQuestion, currentStepIndex);

    // Record result
    const result = recordStepResult(isCorrect);
    stepXPEarned = result.xpEarned;
    stepCoinsEarned = result.coinsEarned;
    questionXP += result.xpEarned;
    questionCoins += result.coinsEarned;

    // Update XP
    addRewards(stepXPEarned, stepCoinsEarned);

    // Visual feedback on options
    const optionsContainer = document.getElementById(`options-${currentStepIndex}`);
    const buttons = optionsContainer.querySelectorAll('.option-btn');
    buttons.forEach((btn, i) => {
        if (i === step.ans) {
            btn.classList.add('correct');
            btn.querySelector('.option-feedback').textContent = '✅';
        } else if (i === selectedOptionIndex && !isCorrect) {
            btn.classList.add('incorrect');
            btn.querySelector('.option-feedback').textContent = '❌';
        } else {
            btn.classList.add('disabled');
        }
    });

    // Feedback banner
    const feedbackEl = document.getElementById(`feedback-${currentStepIndex}`);
    if (isCorrect) {
        feedbackEl.className = 'feedback-banner correct';
        feedbackEl.querySelector('.feedback-icon').textContent = '🎯';
        feedbackEl.querySelector('.feedback-text').textContent = 'Correct!';
        playSound('ding');
    } else {
        feedbackEl.className = 'feedback-banner incorrect';
        feedbackEl.querySelector('.feedback-icon').textContent = '💡';
        feedbackEl.querySelector('.feedback-text').textContent = `The answer is: ${step.options[step.ans]}`;
        playSound('thud');
    }

    // Swap Check → Continue
    document.getElementById('btn-check').classList.add('hidden');
    document.getElementById('btn-continue').classList.remove('hidden');

    // Store result info for transition
    document.getElementById('btn-continue').dataset.isQuestionDone = result.isQuestionDone;
    document.getElementById('btn-continue').dataset.isSprintDone = result.isSprintDone;
}

// --- Continue to Next Step ---
function handleContinue() {
    const isQuestionDone = document.getElementById('btn-continue').dataset.isQuestionDone === 'true';
    const isSprintDone = document.getElementById('btn-continue').dataset.isSprintDone === 'true';

    if (isQuestionDone) {
        // Show success screen
        showSuccessScreen(isSprintDone);
        return;
    }

    // Collapse current step and show next
    const step = getStepData(currentQuestion, currentStepIndex);
    document.getElementById(`collapsed-text-${currentStepIndex}`).textContent =
        `${step.label}: ${step.summary}`;

    collapseStep(currentStepIndex);

    // Show next step after a brief delay for animation
    setTimeout(() => {
        showNextStep(currentStepIndex + 1);
        renderQuestionStep();
    }, 350);
}

// --- Success Screen ---
function showSuccessScreen(isSprintDone) {
    hapticSuccess();
    playSound('tada');
    showConfetti();

    showScreen('screen-success');

    // Pro tip
    document.getElementById('tip-text').textContent = currentQuestion.pro_tip || '';

    // Rewards with count-up
    countUp(document.getElementById('reward-xp'), questionXP, '+', ' XP');
    countUp(document.getElementById('reward-coins'), questionCoins, '+', ' 🪙');

    // Show/hide next question vs finish
    if (isSprintDone) {
        document.getElementById('btn-next-question').classList.add('hidden');
        document.getElementById('btn-finish-sprint').textContent = 'View Results';
        document.getElementById('btn-finish-sprint').className = 'btn btn-primary';
    } else {
        document.getElementById('btn-next-question').classList.remove('hidden');
        document.getElementById('btn-finish-sprint').textContent = 'Finish Sprint';
        document.getElementById('btn-finish-sprint').className = 'btn btn-ghost';
    }

    // Reset question-level reward tracking
    questionXP = 0;
    questionCoins = 0;
}

// --- Next Question ---
function handleNextQuestion() {
    questionXP = 0;
    questionCoins = 0;
    showScreen('screen-question');
    renderQuestionStep();
}

// ============================================
// BLITZ ENGINE CONTROLLERS
// ============================================

function handleStartBlitz() {
    createBlitz();
    showScreen('screen-blitz');
    renderBlitzQuestion();
}

function renderBlitzQuestion() {
    const q = getCurrentBlitzQuestion();
    if (!q) {
        handleFinishBlitz();
        return;
    }

    const state = getState();
    const currentIdx = state.currentBlitzIndex || 0; // if it was tracking
    // Actually we exported currentBlitzIndex from questions.js but we can't read it easily without an import if we didn't export it
    // Wait, import is there but we can also just use the length of the sprint.
    // Let's rely on getBlitzSummary to know how many we've answered.
    const summary = getBlitzSummary();
    const answered = summary ? summary.questionsAnswered : 0;

    document.getElementById('blitz-statement').textContent = q.statement;
    document.getElementById('blitz-counter').textContent = `${answered + 1}/5`;
    document.getElementById('blitz-progress-fill').style.width = `${(answered / 5) * 100}%`;

    // Immediately snap the card back to center for the new question
    const card = document.getElementById('blitz-card');
    const stampTrue = document.getElementById('blitz-stamp-true');
    const stampFalse = document.getElementById('blitz-stamp-false');

    if (card) {
        card.style.transition = 'none';
        card.style.transform = 'translateX(0) rotate(0)';
        if (stampTrue) stampTrue.style.opacity = '0';
        if (stampFalse) stampFalse.style.opacity = '0';
    }
}

function handleBlitzAnswer(isTrueSelected) {
    hapticTap();
    const result = submitBlitzAnswer(isTrueSelected);
    if (!result) return;

    if (result.isCorrect) {
        playSound('success');
        hapticSuccess();
    } else {
        playSound('wrong');
        // Vibrate differently for wrong? 
    }

    if (result.isFinished) {
        setTimeout(handleFinishBlitz, 300);
    } else {
        setTimeout(renderBlitzQuestion, 300);
    }
}

async function handleFinishBlitz() {
    const summary = getBlitzSummary();
    if (!summary) {
        showScreen('screen-home');
        return;
    }

    // A blitz ALWAYS counts as a study session specifically engineered to save a streak
    recordStudySession();

    showScreen('screen-sprint-complete');

    document.getElementById('sprint-questions').textContent = `${summary.questionsAnswered} / 5`;
    document.getElementById('sprint-accuracy').textContent = `${summary.accuracy}%`;
    document.getElementById('sprint-xp').textContent = `+${summary.totalXP}`;
    document.getElementById('sprint-coins').textContent = `+${summary.totalCoins}`;

    endBlitz();

    // Clearing a Blitz clears the immediate error bank (Pivot Rule)
    setState({ errorBank: [] });

    const newState = getState();
    await syncStateToCloud(newState);
}

function handleQuitBlitz() {
    endBlitz();
    showScreen('screen-home');
    updateHomeScreen();
}

// ============================================
// SPRINT ENGINE CONTROLLERS
// ============================================

// --- Sprint Complete ---
async function handleFinishSprint() {
    const summary = getSprintSummary();
    if (!summary) {
        showScreen('screen-home');
        updateHomeScreen();
        return;
    }

    // Record study session for streak
    const newStreak = recordStudySession();
    const milestone = checkStreakMilestones(newStreak);

    showScreen('screen-sprint-complete');

    document.getElementById('sprint-questions').textContent =
        `${summary.questionsAnswered} / ${summary.totalQuestions}`;
    document.getElementById('sprint-accuracy').textContent = `${summary.accuracy}%`;
    document.getElementById('sprint-xp').textContent = `+${summary.totalXP}`;
    document.getElementById('sprint-coins').textContent = `+${summary.totalCoins}`;

    endSprint();

    // Sync new resulting state
    const newState = getState();
    await syncStateToCloud(newState);
}

// --- Back to Home ---
function handleBackHome() {
    switchTab('screen-home');
    updateHomeScreen();
    renderHubs();
}

// --- Start Sprint ---
function handleStartSprint(topic) {
    const { sprint, questions } = createSprint(topic);
    currentQuestions = questions;
    questionXP = 0;
    questionCoins = 0;

    showScreen('screen-question');
    renderQuestionStep();
}

// --- Streak Revive ---
async function handleRevive() {
    const state = getState();
    const errors = state.errorBank || [];

    if (errors.length > 0) {
        hapticTap();
        // Concept: Clearing errors restores the streak.
        // We launch a Blitz. In a real app, this Blitz would filter for ONLY the error questions.
        handleStartBlitz();
    } else {
        // No errors? Direct revive (maybe they just missed time but got everything right before)
        reviveStreak();
        hapticSuccess();
        playSound('success');
        showConfetti();
        updateHomeScreen();
        showScreen('screen-home');

        await syncStateToCloud(getState());
    }
}

function handleFreshStart() {
    resetStreak();
    showScreen('screen-home');
    updateHomeScreen();
}

// --- Init ---
async function init() {
    // Listen for Auth changes globally (handles OAuth redirects automatically)
    onAuthChange(async (event, session) => {
        if (event === 'SIGNED_IN') {
            const cloudState = await fetchStateFromCloud();
            if (cloudState && cloudState.xp > getState().xp) {
                setState({
                    xp: cloudState.xp,
                    coins: cloudState.coins,
                    streak: cloudState.streak,
                    lastStudyDate: cloudState.last_study_date,
                    questionsCompleted: cloudState.questions_completed,
                    errorBank: cloudState.error_bank
                });
            } else {
                await syncStateToCloud(getState());
            }
            updateHomeScreen();
        }
    });

    // Load questions
    await loadQuestions();

    // Init audio
    initAudioOnInteraction();

    // Check streak status
    const streakStatus = checkStreak();

    // Update home screen
    updateHomeScreen();

    // Show appropriate screen behind splash
    if (streakStatus.status === 'broken' && streakStatus.streak > 0) {
        // Show revive screen
        document.getElementById('revive-streak').textContent = `🔥 ${streakStatus.streak}`;
        document.getElementById('revive-days').textContent = streakStatus.streak;
        const state = getState();
        const canAfford = state.coins >= 50;
        document.getElementById('btn-revive').disabled = !canAfford;
        if (!canAfford) {
            document.getElementById('btn-revive').textContent = 'NOT ENOUGH COINS 😢';
        }
        showScreen('screen-revive');
    } else {
        showScreen('screen-home');
    }

    renderHubs();

    // Remove splash screen after 0.8s
    setTimeout(() => {
        const splash = document.getElementById('screen-splash');
        if (splash) {
            splash.style.opacity = '0';
            splash.style.transform = 'scale(1.1)';
            setTimeout(() => {
                splash.classList.remove('active');
                splash.style.display = 'none'; // Force hide to prevent pointer-events blocking
            }, 300); // Fades quickly 
        }
    }, 800);

    // --- Event Listeners ---
    document.getElementById('btn-check').addEventListener('click', handleCheck);
    document.getElementById('btn-continue').addEventListener('click', handleContinue);

    const btnNext = document.getElementById('btn-next-question');
    if (btnNext) btnNext.addEventListener('click', handleNextQuestion);

    const btnFinish = document.getElementById('btn-finish-sprint');
    if (btnFinish) btnFinish.addEventListener('click', handleFinishSprint);

    const btnBack = document.getElementById('btn-back-home');
    if (btnBack) btnBack.addEventListener('click', handleBackHome);

    const btnRevive = document.getElementById('btn-revive');
    if (btnRevive) btnRevive.addEventListener('click', handleRevive);

    const btnFresh = document.getElementById('btn-fresh-start');
    if (btnFresh) btnFresh.addEventListener('click', handleFreshStart);

    const btnDailyBlitz = document.getElementById('btn-daily-blitz');
    if (btnDailyBlitz) btnDailyBlitz.addEventListener('click', () => {
        hapticTap();
        handleStartBlitz();
    });

    // --- Blitz Swipe Listeners ---
    const blitzCard = document.getElementById('blitz-card');
    const stampTrue = document.getElementById('blitz-stamp-true');
    const stampFalse = document.getElementById('blitz-stamp-false');

    if (blitzCard) {
        let isDragging = false;
        let startX = 0;
        let currentX = 0;
        const SWIPE_THRESHOLD = 100;

        blitzCard.addEventListener('pointerdown', (e) => {
            isDragging = true;
            startX = e.clientX;
            blitzCard.style.transition = 'none';
        });

        blitzCard.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            currentX = e.clientX - startX;
            const rotation = currentX * 0.05;
            blitzCard.style.transform = `translateX(${currentX}px) rotate(${rotation}deg)`;

            // Opacities for stamps
            if (currentX > 0) {
                stampTrue.style.opacity = Math.min(1, currentX / SWIPE_THRESHOLD);
                stampFalse.style.opacity = 0;
            } else {
                stampFalse.style.opacity = Math.min(1, Math.abs(currentX) / SWIPE_THRESHOLD);
                stampTrue.style.opacity = 0;
            }
        });

        blitzCard.addEventListener('pointerup', () => {
            if (!isDragging) return;
            isDragging = false;
            blitzCard.style.transition = 'transform 0.3s ease-out';

            if (currentX > SWIPE_THRESHOLD) {
                // Swiped Right -> TRUE
                blitzCard.style.transform = `translateX(500px) rotate(30deg)`;
                handleBlitzAnswer(true);
            } else if (currentX < -SWIPE_THRESHOLD) {
                // Swiped Left -> FALSE
                blitzCard.style.transform = `translateX(-500px) rotate(-30deg)`;
                handleBlitzAnswer(false);
            } else {
                // Snap back
                blitzCard.style.transform = 'translateX(0) rotate(0)';
                stampTrue.style.opacity = 0;
                stampFalse.style.opacity = 0;
            }
            currentX = 0;
        });

        // Handle cancel
        blitzCard.addEventListener('pointerleave', () => {
            if (isDragging) {
                isDragging = false;
                blitzCard.style.transition = 'transform 0.3s ease-out';
                blitzCard.style.transform = 'translateX(0) rotate(0)';
                stampTrue.style.opacity = 0;
                stampFalse.style.opacity = 0;
                currentX = 0;
            }
        });
    }

    const btnQuitBlitz = document.getElementById('btn-quit-blitz');
    if (btnQuitBlitz) btnQuitBlitz.addEventListener('click', handleQuitBlitz);

    const btnArenaBlitz = document.getElementById('btn-arena-blitz');
    if (btnArenaBlitz) btnArenaBlitz.addEventListener('click', () => {
        hapticTap();
        handleStartBlitz();
    });

    // Bottom Nav Listeners
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            if (!target) return;

            hapticTap();
            switchTab(target);

            // Refresh screen data
            updateHomeScreen();
            if (target === 'screen-home') renderHubs();
        });
    });

    // State change listener for reactive updates
    onStateChange(() => {
        // Update home screen stats if visible
        const homeScreen = document.getElementById('screen-home');
        if (homeScreen.classList.contains('active')) {
            updateHomeScreen();
        }
    });
}

// Start the app
init().catch(console.error);

// --- PWA Installation Logic ---
function showInstallButton() {
    const installRow = document.getElementById('install-row');
    if (installRow) {
        installRow.style.display = 'flex';
        installRow.classList.remove('hidden');
    }
}

if (window.pwaReadyToInstall || window.deferredPrompt) {
    showInstallButton();
} else {
    document.addEventListener('pwa-install-ready', showInstallButton);
}

const btnInstall = document.getElementById('btn-install-app');
if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
        if (!window.deferredPrompt) return;
        window.deferredPrompt.prompt();
        const { outcome } = await window.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('User accepted the A2HS prompt');
            const installRow = document.getElementById('install-row');
            if (installRow) installRow.style.display = 'none';
        }
        window.deferredPrompt = null;
    });
}

window.addEventListener('appinstalled', () => {
    const installRow = document.getElementById('install-row');
    if (installRow) installRow.style.display = 'none';
});

// --- Auth Modal Logic ---
const authModal = document.getElementById('auth-modal');
const btnLoginModal = document.getElementById('btn-login-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnAuthSignIn = document.getElementById('btn-auth-signin');
const btnAuthSignUp = document.getElementById('btn-auth-signup');
const btnAuthGoogle = document.getElementById('btn-auth-google');
const btnLogout = document.getElementById('btn-logout');
const authError = document.getElementById('auth-error-msg');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');

if (btnLoginModal) {
    btnLoginModal.addEventListener('click', () => {
        authModal.classList.remove('hidden');
        authModal.style.display = 'flex';
    });
}

if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
        authModal.classList.add('hidden');
        authModal.style.display = 'none';
        authError.textContent = '';
    });
}

if (btnAuthGoogle) {
    btnAuthGoogle.addEventListener('click', async () => {
        authError.textContent = 'Redirecting...';
        btnAuthGoogle.disabled = true;
        const { error } = await signInWithGoogle();
        if (error) {
            authError.textContent = error.message;
            btnAuthGoogle.disabled = false;
        }
        // If successful, the page naturally redirects to Google and then back
    });
}

if (btnAuthSignUp) {
    btnAuthSignUp.addEventListener('click', async () => {
        authError.textContent = 'Loading...';
        btnAuthSignUp.disabled = true;
        const { data, error } = await signUpUser(authEmail.value, authPassword.value);
        btnAuthSignUp.disabled = false;

        if (error) {
            authError.textContent = error.message;
        } else {
            authModal.classList.add('hidden');
            authModal.style.display = 'none';
        }
    });
}

if (btnAuthSignIn) {
    btnAuthSignIn.addEventListener('click', async () => {
        authError.textContent = 'Loading...';
        btnAuthSignIn.disabled = true;
        const { data, error } = await signInUser(authEmail.value, authPassword.value);
        btnAuthSignIn.disabled = false;

        if (error) {
            authError.textContent = error.message;
        } else {
            authModal.classList.add('hidden');
            authModal.style.display = 'none';
        }
    });
}

if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        await signOutUser();
        updateHomeScreen();
    });
}
