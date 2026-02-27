// Animation Utilities

let canvas = null;
let ctx = null;
let particles = [];
let animId = null;

function setupCanvas() {
  if (!document.getElementById('canvas-overlay')) {
    canvas = document.createElement('canvas');
    canvas.id = 'canvas-overlay';
    document.body.appendChild(canvas);
  } else {
    canvas = document.getElementById('canvas-overlay');
  }
  ctx = canvas.getContext('2d');

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
}

function animateCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.vx *= p.drag;
    p.vy *= p.drag;
    p.rotation += p.rotationSpeed;
    p.life -= 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    if (p.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.shape === 'rect') {
      ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.lineTo(p.size, p.size);
      ctx.lineTo(-p.size, p.size);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  });
  if (particles.length > 0) {
    animId = requestAnimationFrame(animateCanvas);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    animId = null;
  }
}

function startCanvas() {
  if (!animId) animId = requestAnimationFrame(animateCanvas);
}

function rand(a, b) { return a + Math.random() * (b - a); }

const CONFETTI_COLORS = [
  '#34d399', '#6ee7b7', '#fbbf24', '#f87171', '#a78bfa', '#38bdf8', '#fb923c', '#f9fafb'
];
const SHAPES = ['circle', 'rect', 'triangle'];

/**
 * Create confetti burst effect
 * @param {HTMLElement} element - Element to burst from (optional, defaults to center)
 * @param {Object} options - Configuration options (ignored in canvas version but kept for signature)
 */
export function createConfettiBurst(element = null, options = {}) {
  if (!canvas) setupCanvas();

  let ox = window.innerWidth / 2;
  let oy = window.innerHeight / 2;

  if (element) {
    const rect = element.getBoundingClientRect();
    ox = rect.left + rect.width / 2;
    oy = rect.top + rect.height / 2;
  }

  for (let i = 0; i < 90; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(3, 14);
    const life = Math.floor(rand(60, 120));
    particles.push({
      x: ox, y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - rand(2, 6),
      gravity: 0.35,
      drag: 0.98,
      rotation: rand(0, Math.PI * 2),
      rotationSpeed: rand(-0.15, 0.15),
      size: rand(3, 8),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      life, maxLife: life,
    });
  }
  startCanvas();
}

/**
 * Create ripple effect on button click
 * @param {Event} event - Click event
 * @param {HTMLElement} button - Button element
 */
export function createRipple(event, button) {
  const ripple = document.createElement('span');
  ripple.className = 'ripple';

  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;

  ripple.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    left: ${x}px;
    top: ${y}px;
  `;

  button.appendChild(ripple);

  setTimeout(() => ripple.remove(), 600);
}

/**
 * Animate number counting up
 * @param {HTMLElement} element - Element to animate
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} duration - Animation duration in ms
 * @param {Function} formatter - Optional formatter function
 */
export function animateCountUp(element, start, end, duration = 1000, formatter = null) {
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function (easeOutExpo)
    const easeProgress = 1 - Math.pow(2, -10 * progress);

    const current = start + (end - start) * easeProgress;

    if (formatter) {
      element.textContent = formatter(current);
    } else {
      element.textContent = Math.round(current).toLocaleString();
    }

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      // Final value
      if (formatter) {
        element.textContent = formatter(end);
      } else {
        element.textContent = end.toLocaleString();
      }
    }
  }

  requestAnimationFrame(update);
}

/**
 * Apply staggered animation to list items
 * @param {string} selector - CSS selector for items
 * @param {number} delay - Delay between items in ms
 */
export function staggerListItems(selector, delay = 100) {
  const items = document.querySelectorAll(selector);
  items.forEach((item, index) => {
    item.classList.add('stagger-item');
    setTimeout(() => {
      item.classList.add('visible');
    }, index * delay);
  });
}

/**
 * Add ripple effect to all buttons except nav items
 */
export function initRippleEffects() {
  document.querySelectorAll('button, .btn').forEach(button => {
    // Skip nav items - they have their own animations
    if (button.classList.contains('nav-item') || button.classList.contains('sidebar-nav-item')) return;

    button.classList.add('ripple-btn');
    button.addEventListener('click', (e) => createRipple(e, button));
  });
}

/**
 * Celebrate success with confetti and animation
 * @param {HTMLElement} element - Element to celebrate from
 */
export function celebrateSuccess(element) {
  createConfettiBurst(element, {
    count: 80,
    duration: 2500,
    spread: 150
  });

  if (element) {
    element.classList.add('success-celebrate');
    setTimeout(() => element.classList.remove('success-celebrate'), 300);
  }
}
