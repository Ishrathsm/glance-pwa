// ============================================
// GLANCE — Rewards Engine
// ============================================

import { addRewards, getState, setState } from './state.js';

/**
 * Reward table
 */
export const REWARDS = {
    CORRECT_STEP: { xp: 5, coins: 1 },
    PERFECT_QUESTION: { xp: 10, coins: 4 },  // bonus for all 3 steps correct
    SPRINT_COMPLETE: { xp: 10, coins: 3 },
    STREAK_7: { xp: 50, coins: 20 },
    STREAK_30: { xp: 200, coins: 100 },
    REVIVE_COST: 50
};

/**
 * Check and award streak milestones
 */
export function checkStreakMilestones(streak) {
    let bonusXP = 0;
    let bonusCoins = 0;

    if (streak === 7) {
        bonusXP = REWARDS.STREAK_7.xp;
        bonusCoins = REWARDS.STREAK_7.coins;
    } else if (streak === 30) {
        bonusXP = REWARDS.STREAK_30.xp;
        bonusCoins = REWARDS.STREAK_30.coins;
    }

    if (bonusXP > 0) {
        addRewards(bonusXP, bonusCoins);
        return { milestone: streak, xp: bonusXP, coins: bonusCoins };
    }

    return null;
}

/**
 * Get user's "status" title based on XP
 */
export function getUserStatus(xp) {
    if (xp >= 5000) return 'Reflex Master 🧠';
    if (xp >= 2000) return 'Knowledge Pro ⭐';
    if (xp >= 500) return 'Quick Learner 🚀';
    if (xp >= 100) return 'Rising Star ✨';
    return 'Beginner 🌱';
}

/**
 * Calculate today's sprint progress (0, 1, or 2 questions done)
 */
export function getTodayProgress() {
    const state = getState();
    const sprint = state.currentSprint;
    if (!sprint) return 0;
    return sprint.results ? sprint.results.length : 0;
}
