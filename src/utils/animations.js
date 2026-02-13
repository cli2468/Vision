// Animation Utilities

/**
 * Create confetti burst effect
 * @param {HTMLElement} element - Element to burst from (optional, defaults to center)
 * @param {Object} options - Configuration options
 */
export function createConfettiBurst(element = null, options = {}) {
  const defaults = {
    count: 50,
    colors: ['#CCFF00', '#FFFFFF', '#D4D0C9', '#B4B1AB'],
    duration: 2000,
    spread: 100
  };
  
  const config = { ...defaults, ...options };
  
  // Create container
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);
  
  // Get burst origin
  let originX = window.innerWidth / 2;
  let originY = window.innerHeight / 2;
  
  if (element) {
    const rect = element.getBoundingClientRect();
    originX = rect.left + rect.width / 2;
    originY = rect.top + rect.height / 2;
  }
  
  // Create confetti pieces
  for (let i = 0; i < config.count; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    
    // Random properties
    const color = config.colors[Math.floor(Math.random() * config.colors.length)];
    const size = Math.random() * 8 + 6;
    const angle = (Math.random() * 360) * (Math.PI / 180);
    const velocity = Math.random() * config.spread + 50;
    const tx = Math.cos(angle) * velocity;
    const ty = Math.sin(angle) * velocity - 100;
    const rotation = Math.random() * 720;
    
    confetti.style.cssText = `
      background: ${color};
      width: ${size}px;
      height: ${size}px;
      left: ${originX}px;
      top: ${originY}px;
      transform: translate(-50%, -50%);
    `;
    
    // Custom animation for each piece
    confetti.style.animation = `none`;
    container.appendChild(confetti);
    
    // Trigger animation
    requestAnimationFrame(() => {
      confetti.style.transition = `all ${config.duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
      confetti.style.opacity = '1';
      confetti.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) rotate(${rotation}deg)`;
      
      // Fade out and fall
      setTimeout(() => {
        confetti.style.transition = `all ${config.duration * 0.5}ms ease-in`;
        confetti.style.opacity = '0';
        confetti.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty + 300}px)) rotate(${rotation * 2}deg)`;
      }, config.duration * 0.5);
    });
  }
  
  // Clean up
  setTimeout(() => {
    container.remove();
  }, config.duration * 1.5);
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
    if (button.classList.contains('nav-item')) return;
    
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
