// ============================================
// GLANCE — Streak Logic (1 AM Reset Rule)
// ============================================

import { getState, setState } from './state.js';

/**
 * Get the "study date" using the 1 AM cutoff rule.
 * Before 1 AM → counts as yesterday.
 * After 1 AM  → counts as today.
 */
export function getStudyDate() {
    const now = new Date();
    if (now.getHours() < 1) {
        // Before 1 AM → yesterday's study session
        const yesterday = new Date(now.getTime() - 86400000);
        return formatDate(yesterday);
    }
    return formatDate(now);
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Get yesterday's study date (for comparison)
 */
function getYesterdayStudyDate() {
    const now = new Date();
    let reference;
    if (now.getHours() < 1) {
        reference = new Date(now.getTime() - 86400000);
    } else {
        reference = now;
    }
    const yesterday = new Date(reference.getTime() - 86400000);
    return formatDate(yesterday);
}

/**
 * Check streak status on app open.
 * Returns: { status, streak, missedDays }
 * - status: 'continue' | 'new_day' | 'broken'
 */
export function checkStreak() {
    const state = getState();
    const todayStudy = getStudyDate();
    const yesterdayStudy = getYesterdayStudyDate();

    // First time user — no last study date
    if (!state.lastStudyDate) {
        return { status: 'new_day', streak: 0, missedDays: 0 };
    }

    // Same study date — continue current session
    if (state.lastStudyDate === todayStudy) {
        return { status: 'continue', streak: state.streak, missedDays: 0 };
    }

    // Yesterday — streak continues, but new day
    if (state.lastStudyDate === yesterdayStudy) {
        return { status: 'new_day', streak: state.streak, missedDays: 0 };
    }

    // Older — streak broken
    const lastDate = new Date(state.lastStudyDate);
    const todayDate = new Date(todayStudy);
    const diffDays = Math.floor((todayDate - lastDate) / 86400000);

    return {
        status: 'broken',
        streak: state.streak,
        missedDays: diffDays
    };
}

/**
 * Record that user studied today — updates streak & date
 */
export function recordStudySession() {
    const state = getState();
    const todayStudy = getStudyDate();

    // Already recorded today
    if (state.lastStudyDate === todayStudy) {
        return state.streak;
    }

    const newStreak = state.streak + 1;
    setState({
        streak: newStreak,
        lastStudyDate: todayStudy
    });

    return newStreak;
}

/**
 * Revive a broken streak (costs 50 coins)
 * Returns: true if revived, false if not enough coins
 */
export function reviveStreak() {
    const state = getState();
    if (state.coins >= 50) {
        setState({
            coins: state.coins - 50,
            lastStudyDate: getYesterdayStudyDate()
            // Streak count preserved — next study will increment
        });
        return true;
    }
    return false;
}

/**
 * Reset streak to 0 (user chose "Start Fresh")
 */
export function resetStreak() {
    setState({
        streak: 0,
        lastStudyDate: null
    });
}
