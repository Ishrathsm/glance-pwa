// ============================================
// GLANCE — Question Engine (3-Step State Machine)
// ============================================

import { getState, setState, markQuestionCompleted, addToErrorBank } from './state.js';

let questionsData = [];

/**
 * Load questions from JSON
 */
export async function loadQuestions() {
    try {
        const response = await fetch('/data/questions.json');
        questionsData = await response.json();
        return questionsData;
    } catch (e) {
        console.error('Failed to load questions:', e);
        return [];
    }
}

/**
 * Get all loaded questions
 */
export function getQuestions() {
    return questionsData;
}

/**
 * Create a new sprint session
 */
export function createSprint(topic) {
    const state = getState();
    const rawQuestions = questionsData;
    if (!rawQuestions || rawQuestions.length === 0) {
        return { sprint: null, questions: [] };
    }

    // Filter pool by topic if one is provided
    let pool = rawQuestions;
    if (topic) {
        const tLow = topic.toLowerCase();
        pool = rawQuestions.filter(q => q.topic && q.topic.toLowerCase().includes(tLow));
        // Fallback if no questions actually have this topic assigned in the mocked JSON
        if (pool.length === 0) pool = rawQuestions;
    }

    // Pick questions (avoiding recently completed if possible)
    const completedIds = state.questionsCompleted || [];
    let available = pool.filter(q => !completedIds.includes(q.q_id));

    // If all completed, reset and use all
    if (available.length < 2) {
        available = [...pool]; // Use the topic-filtered pool for reset
        // Optionally clear completed list to cycle
        setState({ questionsCompleted: [] });
    }

    // Shuffle and pick 2
    const shuffled = available.sort(() => Math.random() - 0.5);
    const questions = shuffled.slice(0, 2);

    const sprint = {
        questions: questions.map(q => q.q_id),
        questionIndex: 0,
        stepIndex: 0,
        results: [],  // { qId, stepsCorrect: [bool, bool, bool] }
        totalXP: 0,
        totalCoins: 0,
        startedAt: Date.now()
    };

    setState({ currentSprint: sprint });
    return { sprint, questions };
}

/**
 * Get current question in the sprint
 */
export function getCurrentQuestion() {
    const state = getState();
    const sprint = state.currentSprint;
    if (!sprint) return null;

    const qId = sprint.questions[sprint.questionIndex];
    return questionsData.find(q => q.q_id === qId) || null;
}

/**
 * Get the step data (step_1, step_2, step_3) for a question
 */
export function getStepData(question, stepIndex) {
    const stepKey = `step_${stepIndex + 1}`;
    return question[stepKey] || null;
}

/**
 * Check if the selected answer is correct
 */
export function checkAnswer(question, stepIndex, selectedIndex) {
    const step = getStepData(question, stepIndex);
    if (!step) return false;
    return selectedIndex === step.ans;
}

/**
 * Record step result and advance
 * Returns: { correct, isQuestionDone, isSprintDone, xpEarned, coinsEarned }
 */
export function recordStepResult(correct) {
    const state = getState();
    const sprint = { ...state.currentSprint };
    const qIndex = sprint.questionIndex;
    const stepIndex = sprint.stepIndex;

    // Initialize results for this question if needed
    if (!sprint.results[qIndex]) {
        sprint.results[qIndex] = {
            qId: sprint.questions[qIndex],
            stepsCorrect: []
        };
    }

    sprint.results[qIndex].stepsCorrect[stepIndex] = correct;

    // Calculate per-step rewards
    let xpEarned = correct ? 5 : 0;
    let coinsEarned = correct ? 1 : 0;

    // Track errors
    if (!correct) {
        addToErrorBank(`${sprint.questions[qIndex]}_step${stepIndex + 1}`);
    }

    const isLastStep = stepIndex >= 2;
    let isQuestionDone = false;
    let isSprintDone = false;

    if (isLastStep) {
        isQuestionDone = true;
        markQuestionCompleted(sprint.questions[qIndex]);

        // Bonus for all 3 correct
        const allCorrect = sprint.results[qIndex].stepsCorrect.every(Boolean);
        if (allCorrect) {
            xpEarned += 10; // bonus for perfect question
            coinsEarned += 4;
        }

        // Check if sprint is done
        if (qIndex >= sprint.questions.length - 1) {
            isSprintDone = true;
            // Sprint completion bonus
            xpEarned += 10;
            coinsEarned += 3;
        } else {
            // Move to next question
            sprint.questionIndex = qIndex + 1;
            sprint.stepIndex = 0;
        }
    } else {
        // Move to next step
        sprint.stepIndex = stepIndex + 1;
    }

    sprint.totalXP += xpEarned;
    sprint.totalCoins += coinsEarned;

    setState({ currentSprint: sprint });

    return { correct, isQuestionDone, isSprintDone, xpEarned, coinsEarned };
}

/**
 * Get sprint summary
 */
export function getSprintSummary() {
    const state = getState();
    const sprint = state.currentSprint;
    if (!sprint) return null;

    const totalSteps = sprint.results.reduce((sum, r) => sum + r.stepsCorrect.length, 0);
    const correctSteps = sprint.results.reduce((sum, r) => sum + r.stepsCorrect.filter(Boolean).length, 0);

    return {
        questionsAnswered: sprint.results.length,
        totalQuestions: sprint.questions.length,
        totalSteps,
        correctSteps,
        accuracy: totalSteps > 0 ? Math.round((correctSteps / totalSteps) * 100) : 0,
        totalXP: sprint.totalXP,
        totalCoins: sprint.totalCoins
    };
}

/**
 * End the sprint
 */
export function endSprint() {
    const state = getState();
    const sprint = state.currentSprint;
    if (!sprint) return;

    const history = state.sprintHistory || [];
    history.push({
        ...sprint,
        endedAt: Date.now()
    });

    setState({
        currentSprint: null,
        sprintHistory: history
    });
}
