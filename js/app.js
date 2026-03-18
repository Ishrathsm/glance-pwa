// ============================================
// GLANCE — Main App Controller
// ============================================

import { getState, setState, onStateChange, addRewards } from './state.js';
import { checkStreak, recordStudySession, reviveStreak, resetStreak } from './streak.js';
import {
    loadQuestions, createSprint, getCurrentQuestion,
    getStepData, checkAnswer, recordStepResult,
    getSprintSummary, endSprint
} from './questions.js';
import { checkStreakMilestones } from './rewards.js';
import {
    hapticTap, hapticSuccess, playSound, showConfetti,
    countUp, collapseStep, showNextStep, loadSounds,
    initAudioOnInteraction
} from './animations.js';

// --- Screen Management ---
const screens = ['screen-splash', 'screen-home', 'screen-profile', 'screen-question', 'screen-success', 'screen-sprint-complete', 'screen-revive'];

function showScreen(screenId) {
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.toggle('active', id === screenId);
        }
    });

    // Handle bottom nav visibility
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) {
        if (screenId === 'screen-home' || screenId === 'screen-profile') {
            bottomNav.classList.remove('hidden');
        } else {
            bottomNav.classList.add('hidden');
        }
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
function updateHomeScreen() {
    const state = getState();

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
    document.getElementById('profile-xp').textContent = state.xp;
    // For now longest streak is just current streak since we dont track historical max
    document.getElementById('profile-streak-max').textContent = state.streak;

    // Calculate global accuracy from sprintHistory
    let totalSteps = 0;
    let correctSteps = 0;
    state.sprintHistory.forEach(s => {
        if (!s.results) return;
        s.results.forEach(r => {
            if (!r.stepsCorrect) return;
            totalSteps += r.stepsCorrect.length;
            correctSteps += r.stepsCorrect.filter(Boolean).length;
        });
    });
    const accuracy = totalSteps > 0 ? Math.round((correctSteps / totalSteps) * 100) : 0;
    document.getElementById('profile-accuracy').textContent = `${accuracy}%`;

    document.getElementById('profile-mastered').textContent = state.questionsCompleted ? state.questionsCompleted.length : 0;

    const errorsCount = state.errorBank ? state.errorBank.length : 0;
    document.getElementById('profile-errors-count').textContent = `${errorsCount} mistakes logged`;
}

// --- Render Learning Path (Home) ---
function renderPath() {
    const pathContainer = document.getElementById('learning-path');
    if (!pathContainer) return;

    pathContainer.innerHTML = '';
    const state = getState();
    const completedNodes = Math.floor((state.questionsCompleted || []).length / 2);

    // Create 6 dummy nodes to show progression
    const topics = ['Kinematics', 'Trig', 'Forces', 'Calculus', 'Energy', 'Algebra'];
    const emojis = ['🚀', '📐', '🍎', '📈', '⚡', '✖️'];

    topics.forEach((topic, i) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'path-node-wrapper';

        const node = document.createElement('div');
        node.className = 'path-node';
        node.textContent = emojis[i];

        const label = document.createElement('span');
        label.className = 'node-label';
        label.textContent = topic;

        if (i < completedNodes) {
            node.classList.add('completed');
            // Clicking completed nodes acts like review
            node.addEventListener('click', () => handleStartSprint());
        } else if (i === completedNodes) {
            node.classList.add('active');
            node.addEventListener('click', () => handleStartSprint());
        } else {
            node.classList.add('locked');
        }

        wrapper.appendChild(node);
        wrapper.appendChild(label);
        pathContainer.appendChild(wrapper);
    });
}

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

// --- Sprint Complete ---
function handleFinishSprint() {
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
}

// --- Back to Home ---
function handleBackHome() {
    switchTab('screen-home');
    updateHomeScreen();
    renderPath();
}

// --- Start Sprint ---
function handleStartSprint() {
    const { sprint, questions } = createSprint();
    currentQuestions = questions;
    questionXP = 0;
    questionCoins = 0;

    showScreen('screen-question');
    renderQuestionStep();
}

// --- Streak Revive ---
function handleRevive() {
    const success = reviveStreak();
    if (success) {
        showScreen('screen-home');
        updateHomeScreen();
    } else {
        // Not enough coins — could show a toast, for now just shake
        const btn = document.getElementById('btn-revive');
        btn.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => { btn.style.animation = ''; }, 500);
    }
}

function handleFreshStart() {
    resetStreak();
    showScreen('screen-home');
    updateHomeScreen();
}

// --- Init ---
async function init() {
    // Load questions
    await loadQuestions();

    // Init audio
    initAudioOnInteraction();
    loadSounds();

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

    renderPath();

    // Remove splash screen after 1.5s
    setTimeout(() => {
        const splash = document.getElementById('screen-splash');
        if (splash) {
            splash.style.opacity = '0';
            splash.style.transform = 'scale(1.1)';
            setTimeout(() => splash.classList.remove('active'), 500);
        }
    }, 1500);

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

    // Bottom Nav Listeners
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.target);
            if (btn.dataset.target === 'screen-home') {
                updateHomeScreen();
                renderPath();
            } else if (btn.dataset.target === 'screen-profile') {
                updateHomeScreen(); // also updates profile data
            }
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
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67+ from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;

    // Update UI notify the user they can add to home screen
    const installRow = document.getElementById('install-row');
    if (installRow) {
        installRow.style.display = 'flex';
        installRow.classList.remove('hidden');
    }
});

const btnInstall = document.getElementById('btn-install-app');
if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        // Show the prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('User accepted the A2HS prompt');
            const installRow = document.getElementById('install-row');
            if (installRow) installRow.style.display = 'none';
        }
        deferredPrompt = null;
    });
}
window.addEventListener('appinstalled', () => {
    const installRow = document.getElementById('install-row');
    if (installRow) installRow.style.display = 'none';
});

