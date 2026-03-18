// ============================================
// GLANCE — Animations & Juice
// ============================================

/**
 * Haptic feedback (vibration)
 */
export function haptic(duration = 10) {
    if (navigator.vibrate) {
        navigator.vibrate(duration);
    }
}

/**
 * Short haptic for option selection
 */
export function hapticTap() {
    haptic(10);
}

/**
 * Strong haptic for success screen
 */
export function hapticSuccess() {
    haptic(40);
}

// --- Sound Effects ---
const audioContext = typeof AudioContext !== 'undefined'
    ? new AudioContext()
    : typeof webkitAudioContext !== 'undefined'
        ? new webkitAudioContext()
        : null;

const soundBuffers = {};
let soundsLoaded = false;

/**
 * Pre-load sound effects
 */
export async function loadSounds() {
    if (!audioContext) return;

    const sounds = {
        ding: '/assets/sounds/ding.mp3',
        thud: '/assets/sounds/thud.mp3',
        tada: '/assets/sounds/tada.mp3'
    };

    // Try to load sounds, but don't block if they fail
    for (const [name, url] of Object.entries(sounds)) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Not found');

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                throw new Error('Fallback HTML returned instead of audio file');
            }

            const buffer = await response.arrayBuffer();
            soundBuffers[name] = await audioContext.decodeAudioData(buffer);
        } catch (e) {
            console.warn(`Failed to load sound: ${name}`, e);
        }
    }
    soundsLoaded = true;
}

/**
 * Play a sound effect
 */
export function playSound(name) {
    if (!audioContext || !soundBuffers[name]) return;

    // Resume audio context if suspended (requires user gesture)
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const source = audioContext.createBufferSource();
    source.buffer = soundBuffers[name];
    source.connect(audioContext.destination);
    source.start(0);
}

// --- Confetti ---

/**
 * Shoot confetti particles on the success screen
 */
export function showConfetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    const colors = ['#BEF264', '#58A700', '#FFD700', '#FF6B6B', '#7C3AED', '#38BDF8'];
    const shapes = ['circle', 'square', 'triangle'];

    for (let i = 0; i < 50; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';

        const color = colors[Math.floor(Math.random() * colors.length)];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const left = Math.random() * 100;
        const delay = Math.random() * 0.5;
        const size = 6 + Math.random() * 8;
        const duration = 2 + Math.random() * 2;

        piece.style.left = `${left}%`;
        piece.style.width = `${size}px`;
        piece.style.height = `${size}px`;
        piece.style.backgroundColor = color;
        piece.style.animationDelay = `${delay}s`;
        piece.style.animationDuration = `${duration}s`;

        if (shape === 'circle') {
            piece.style.borderRadius = '50%';
        } else if (shape === 'triangle') {
            piece.style.width = '0';
            piece.style.height = '0';
            piece.style.backgroundColor = 'transparent';
            piece.style.borderLeft = `${size / 2}px solid transparent`;
            piece.style.borderRight = `${size / 2}px solid transparent`;
            piece.style.borderBottom = `${size}px solid ${color}`;
        }

        container.appendChild(piece);
    }

    // Clean up after animation
    setTimeout(() => {
        container.remove();
    }, 4000);
}

// --- Count-Up Animation ---

/**
 * Animate a number counting up from 0 to target
 */
export function countUp(element, target, prefix = '+', suffix = '', duration = 800) {
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * target);

        element.textContent = `${prefix}${current}${suffix}`;

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.classList.add('count-up');
        }
    }

    requestAnimationFrame(update);
}

// --- Accordion Animation ---

/**
 * Collapse a step to its summary
 */
export function collapseStep(stepIndex) {
    const accordion = document.getElementById(`accordion-step-${stepIndex}`);
    if (!accordion) return;

    // Set explicit height for smooth transition
    const content = accordion.querySelector('.step-content');
    if (content) {
        accordion.style.maxHeight = accordion.scrollHeight + 'px';
        // Force reflow
        accordion.offsetHeight;
        // Collapse
        accordion.classList.add('collapsed');
        accordion.style.maxHeight = '48px';
    }
}

/**
 * Show the next step with slide-up animation
 */
export function showNextStep(stepIndex) {
    const accordion = document.getElementById(`accordion-step-${stepIndex}`);
    if (!accordion) return;

    accordion.classList.remove('hidden');
    // Force reflow
    accordion.offsetHeight;
}

// --- Resume AudioContext on first user interaction ---
export function initAudioOnInteraction() {
    const resume = () => {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
        document.removeEventListener('touchstart', resume);
        document.removeEventListener('click', resume);
    };
    document.addEventListener('touchstart', resume, { once: true });
    document.addEventListener('click', resume, { once: true });
}
