// ============================================
// GLANCE — State Manager (localStorage)
// ============================================

const STORAGE_KEY = 'glance_state';

const DEFAULT_STATE = {
    streak: 0,
    lastStudyDate: null,
    xp: 0,
    coins: 0,
    questionsCompleted: [],
    errorBank: [],
    currentSprint: null,
    sprintHistory: [],
    hasOnboarded: false,
    userName: '',
    userGrade: '',
    userExam: ''
};

// Event listeners for state changes
const listeners = new Set();

/**
 * Get current state from localStorage
 */
export function getState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            return { ...DEFAULT_STATE, ...JSON.parse(raw) };
        }
    } catch (e) {
        console.warn('Failed to read state:', e);
    }
    return { ...DEFAULT_STATE };
}

/**
 * Update state — merges partial updates, persists, notifies listeners
 */
export function setState(partial) {
    const current = getState();
    const next = { ...current, ...partial };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
        console.warn('Failed to save state:', e);
    }
    // Notify listeners
    listeners.forEach(fn => {
        try { fn(next); } catch (e) { console.warn('Listener error:', e); }
    });
    return next;
}

/**
 * Reset state to defaults
 */
export function resetState() {
    localStorage.removeItem(STORAGE_KEY);
    listeners.forEach(fn => {
        try { fn({ ...DEFAULT_STATE }); } catch (e) { console.warn('Listener error:', e); }
    });
    return { ...DEFAULT_STATE };
}

/**
 * Subscribe to state changes
 * @returns {Function} unsubscribe function
 */
export function onStateChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/**
 * Add XP and coins
 */
export function addRewards(xp, coins) {
    const state = getState();
    return setState({
        xp: state.xp + xp,
        coins: state.coins + coins
    });
}

/**
 * Deduct coins (for streak revive)
 * @returns {boolean} true if deduction successful
 */
export function deductCoins(amount) {
    const state = getState();
    if (state.coins >= amount) {
        setState({ coins: state.coins - amount });
        return true;
    }
    return false;
}

/**
 * Mark a question as completed
 */
export function markQuestionCompleted(qId) {
    const state = getState();
    if (!state.questionsCompleted.includes(qId)) {
        setState({
            questionsCompleted: [...state.questionsCompleted, qId]
        });
    }
}

/**
 * Add to error bank
 */
export function addToErrorBank(errorId) {
    const state = getState();
    if (!state.errorBank.includes(errorId)) {
        setState({
            errorBank: [...state.errorBank, errorId]
        });
    }
}
