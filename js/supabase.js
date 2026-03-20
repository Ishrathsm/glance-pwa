import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getCurrentUser() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return null;
    return session.user;
}

export async function signUpUser(email, password) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password
    });
    return { data, error };
}

export async function signInUser(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    return { data, error };
}

export async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin, // Returns back to the PWA home
        }
    });
    return { data, error };
}

export async function signOutUser() {
    const { error } = await supabase.auth.signOut();
    return error;
}

export function onAuthChange(callback) {
    supabase.auth.onAuthStateChange(callback);
}

// Syncer functions will go here
export async function syncStateToCloud(state) {
    const user = await getCurrentUser();
    if (!user) return; // Only sync if logged in

    const { error } = await supabase
        .from('profiles')
        .upsert({
            user_id: user.id,
            xp: state.xp,
            coins: state.coins,
            streak: state.streak,
            last_study_date: state.lastStudyDate,
            questions_completed: state.questionsCompleted,
            error_bank: state.errorBank
        });

    if (error) {
        console.error('Failed to sync to cloud:', error);
    }
}

export async function fetchStateFromCloud() {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (error) {
        // PostgREST returns 406 when the row doesn't exist yet for single() queries.
        console.log('No cloud profile found yet or error:', error);
        return null;
    }

    return data;
}
