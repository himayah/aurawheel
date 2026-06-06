// AuraWheel Application Logic

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const wheelWrapper = document.getElementById('wheelWrapper');
  const wheelRotator = document.getElementById('wheelRotator');
  const canvas = document.getElementById('colorWheelCanvas');
  const ctx = canvas.getContext('2d');
  const pointer = document.getElementById('wheelPointer');

  const playPauseBtn = document.getElementById('playPauseBtn');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const playPauseText = document.getElementById('playPauseText');
  const directionBtn = document.getElementById('directionBtn');
  const cwIcon = document.getElementById('cwIcon');
  const ccwIcon = document.getElementById('ccwIcon');
  const directionText = document.getElementById('directionText');
  const speedSlider = document.getElementById('speedSlider');
  const speedValueText = document.getElementById('speedValue');

  // Grid & Action Elements
  const colorGrid = document.getElementById('colorGrid');
  const undoBtn = document.getElementById('undoBtn');

  const hexValueText = document.getElementById('hexValue');
  const rgbValueText = document.getElementById('rgbValue');
  const hslValueText = document.getElementById('hslValue');
  const toast = document.getElementById('toast');

  const bgGlow1 = document.getElementById('bgGlow1');
  const bgGlow2 = document.getElementById('bgGlow2');
  const styleRadios = document.querySelectorAll('input[name="wheelStyle"]');

  // --- Constants & Config ---
  const CANVAS_SIZE = 800;
  const CENTER = CANVAS_SIZE / 2;
  const RADIUS = 390; // Leave 10px padding for anti-aliasing shadow boundary
  const BASE_SPEED = 15; // Degrees per second at 1.0x

  // Grid Dimensions
  const COLS = 12;
  const ROWS = 8;
  const TOTAL_CELLS = COLS * ROWS;

  // --- State Variables ---
  let currentRotation = 0; // Degrees
  let speedMultiplier = 1.0;
  let direction = 1; // 1 = Clockwise, -1 = Counter-Clockwise
  let isPlaying = true;
  let currentStyle = 'smooth'; // 'smooth' or 'segmented'
  
  let hasSelectedColor = false;
  let selectedColor = { h: 0, s: 0, l: 100 };
  
  // Normalized polar coordinates of the pointer relative to the wheel (independent of rotation)
  // rRatio: 0 (center) to 1 (outer edge), angle: 0 to 360 deg
  let pointerPolar = { rRatio: 0, angle: 0 };
  
  let isDragging = false;
  let lastFrameTime = 0;

  // Grid States
  let stepCount = 0; // Track the sequence index of added colors
  let actionHistory = []; // Action log for Undo operations
  let cellStates = Array(TOTAL_CELLS).fill(null); // Save current color of each cell
  let cellElements = []; // DOM element reference array

  // Set Canvas internal dimensions for crisp rendering
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  // --- Initialize Color Grid ---
  function initColorGrid() {
    colorGrid.innerHTML = '';
    cellElements = [];
    
    for (let i = 0; i < TOTAL_CELLS; i++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      colorGrid.appendChild(cell);
      cellElements.push(cell);
    }
    updateActiveTarget();
  }

  // --- Grid Position Mapping ---
  // Calculates coordinates for: Right-to-Left, Top-to-Bottom columns
  function getGridPosition(step) {
    const colIndex = Math.floor(step / ROWS) % COLS; // How many columns leftwards from right side
    const col = (COLS - 1) - colIndex; // Actual 0-based column index from left
    const row = step % ROWS; // Row index (top-to-bottom: 0 to 7)
    
    // Convert 2D coordinate to 1D index matching standard grid DOM order (row-major: left-to-right)
    const index = row * COLS + col;
    return { col, row, index };
  }

  function updateActiveTarget() {
    // Remove target borders from all cells
    cellElements.forEach(cell => cell.classList.remove('active-target'));
    
    // Add pulsing border to the cell matching the next write step
    const nextPos = getGridPosition(stepCount);
    if (cellElements[nextPos.index]) {
      cellElements[nextPos.index].classList.add('active-target');
    }
  }

  // --- Color Wheel Rendering Functions ---

  function drawColorWheel() {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    if (currentStyle === 'smooth') {
      // Draw smooth HSL spectrum using small sectors with radial gradients
      // 0.2 deg steps to avoid visible gaps
      const steps = 360 * 5;
      const angleStep = 360 / steps;
      
      for (let i = 0; i < steps; i++) {
        const angle = i * angleStep;
        // Add 0.1 deg overlap to eliminate rendering seam lines
        const radStart = ((angle - 0.1) * Math.PI) / 180;
        const radEnd = ((angle + angleStep + 0.1) * Math.PI) / 180;

        ctx.beginPath();
        ctx.moveTo(CENTER, CENTER);
        ctx.arc(CENTER, CENTER, RADIUS, radStart, radEnd);
        ctx.closePath();

        // White at center (S=0% or L=100%) to full color at edge
        const grad = ctx.createRadialGradient(CENTER, CENTER, 0, CENTER, CENTER, RADIUS);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(1, `hsl(${angle}, 100%, 50%)`);

        ctx.fillStyle = grad;
        ctx.fill();
      }
    } else if (currentStyle === 'segmented') {
      // Draw a clean palette-based color wheel
      const sectors = 24;
      const rings = 5;
      const angleStep = 360 / sectors;
      const ringWidth = RADIUS / rings;

      for (let s = 0; s < sectors; s++) {
        // Add tiny overlap to prevent antialiasing seams
        const startAngle = ((s * angleStep - 0.3) * Math.PI) / 180;
        const endAngle = (((s + 1) * angleStep + 0.3) * Math.PI) / 180;
        const hue = s * angleStep;

        for (let r = 0; r < rings; r++) {
          const innerR = r * ringWidth;
          const outerR = (r + 1) * ringWidth;
          
          // Outer rings are more saturated, center rings approach white
          const sat = Math.round(((r + 1) / rings) * 100);
          const light = Math.round(100 - ((r + 1) / rings) * 50);

          ctx.beginPath();
          ctx.arc(CENTER, CENTER, outerR, startAngle, endAngle);
          // Draw reverse arc for inner border to make a ring segment
          ctx.arc(CENTER, CENTER, innerR, endAngle, startAngle, true);
          ctx.closePath();

          ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
          ctx.fill();
        }
      }
    }
  }

  // --- Animation Engine ---

  function updateAnimation(time) {
    if (!lastFrameTime) lastFrameTime = time;
    const deltaTime = time - lastFrameTime;
    lastFrameTime = time;

    // Apply rotation
    if (isPlaying && speedMultiplier > 0) {
      const rotationAmount = (BASE_SPEED * speedMultiplier * direction * deltaTime) / 1000;
      currentRotation = (currentRotation + rotationAmount) % 360;
      if (currentRotation < 0) currentRotation += 360;
      
      wheelRotator.style.transform = `rotate(${currentRotation}deg)`;
    }

    // Dynamic background glow logic
    updateGlowColors();

    requestAnimationFrame(updateAnimation);
  }

  function updateGlowColors() {
    // Dynamic hue modulated by time and current rotation
    let hue1 = (currentRotation * 0.8) % 360;
    let hue2 = (currentRotation * 0.8 + 120) % 360;

    // Shift glow color scheme towards picked color if user has selected one
    if (hasSelectedColor) {
      const mixFactor = 0.5; // How much the picked color influences the atmosphere
      const pickedH = selectedColor.h;

      hue1 = (pickedH * mixFactor + hue1 * (1 - mixFactor)) % 360;
      hue2 = ((pickedH + 180) * mixFactor + hue2 * (1 - mixFactor)) % 360; // Use complementary color for depth
    }

    bgGlow1.style.background = `radial-gradient(circle, hsl(${hue1}, 75%, 40%) 0%, transparent 70%)`;
    bgGlow2.style.background = `radial-gradient(circle, hsl(${hue2}, 75%, 40%) 0%, transparent 70%)`;
  }

  // --- Color Picker Mathematics ---

  function processColorPick(clientX, clientY) {
    const rect = wheelWrapper.getBoundingClientRect();
    const width = rect.width;
    const cssCenter = width / 2;
    const cssRadius = width / 2 - (10 * (width / CANVAS_SIZE)); // Match canvas padded radius

    // Relative mouse vector from center of container (absolute screen frame)
    let dx = clientX - (rect.left + cssCenter);
    let dy = clientY - (rect.top + cssCenter);
    let dist = Math.sqrt(dx * dx + dy * dy);

    // Limit color picking to the radius of the wheel (clamping)
    if (dist > cssRadius) {
      dist = cssRadius;
    }

    // Angle relative to viewport (0 to 360deg)
    const angleRad = Math.atan2(dy, dx);
    let angleDeg = (angleRad * 180) / Math.PI;
    if (angleDeg < 0) angleDeg += 360;

    // Compensate for wheel rotation: Subtract rotation angle to find the original canvas coordinates
    let relativeAngle = (angleDeg - currentRotation) % 360;
    if (relativeAngle < 0) relativeAngle += 360;

    const ratio = dist / cssRadius;
    let finalH = 0, finalS = 100, finalL = 50;

    if (currentStyle === 'smooth') {
      finalH = Math.round(relativeAngle);
      finalS = Math.round(ratio * 100);
      finalL = Math.round(100 - ratio * 50);

      // Save pointer directly on the smooth wheel
      pointerPolar = { rRatio: ratio, angle: relativeAngle };
    } else if (currentStyle === 'segmented') {
      // Snap HSL and pointer to segments
      const sectors = 24;
      const rings = 5;
      
      const sectorAngle = 360 / sectors;
      const sectorIndex = Math.floor(relativeAngle / sectorAngle);
      finalH = Math.round(sectorIndex * sectorAngle);

      const ringIndex = Math.min(rings - 1, Math.max(0, Math.floor(ratio * rings)));
      finalS = Math.round(((ringIndex + 1) / rings) * 100);
      finalL = Math.round(100 - ((ringIndex + 1) / rings) * 50);

      // Snap polar coords to the center of this sector block
      const snapAngle = sectorIndex * sectorAngle + (sectorAngle / 2);
      const snapRatio = (ringIndex + 0.5) / rings;

      pointerPolar = { rRatio: snapRatio, angle: snapAngle };
    }

    // Capture the state changes for the current action
    const pos = getGridPosition(stepCount);
    const prevColor = cellStates[pos.index];
    const newColorString = `hsl(${finalH}, ${finalS}%, ${finalL}%)`;

    // Record complete application snapshot for precise undo operations
    actionHistory.push({
      step: stepCount,
      cellIndex: pos.index,
      prevColor: prevColor,
      newColor: newColorString,
      
      // Context properties for code displays and pointer recovery
      selectedColor: { ...selectedColor },
      pointerPolar: { ...pointerPolar },
      hasSelectedColor: hasSelectedColor
    });

    // Update cell arrays
    cellStates[pos.index] = newColorString;

    // Apply color to target DOM cell
    const cell = cellElements[pos.index];
    cell.style.backgroundColor = newColorString;

    // Trigger visual pop flash animation
    cell.classList.remove('pop-paint');
    void cell.offsetWidth; // Force CSS reflow
    cell.classList.add('pop-paint');

    // Proceed to next step
    stepCount++;
    undoBtn.disabled = false;
    updateActiveTarget();

    // Save picked color state
    selectedColor = { h: finalH, s: finalS, l: finalL };
    hasSelectedColor = true;

    // Display color preview and info
    updateColorUI();
  }

  function updateColorUI() {
    const { h, s, l } = selectedColor;
    const hslString = `hsl(${h}, ${s}%, ${l}%)`;
    const rgb = hslToRgb(h, s, l);
    const rgbString = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    const hexString = rgbToHex(rgb.r, rgb.g, rgb.b);

    // Apply text values to DOM
    hexValueText.textContent = hexString;
    rgbValueText.textContent = rgbString;
    hslValueText.textContent = hslString;

    if (hasSelectedColor) {
      // Position the pointer relative to the rotator container (which handles rotation)
      const rect = wheelWrapper.getBoundingClientRect();
      const cssRadius = rect.width / 2 - (10 * (rect.width / CANVAS_SIZE));
      
      // Calculate local x and y using polar coordinates
      const rad = pointerPolar.rRatio * cssRadius;
      const angleRad = (pointerPolar.angle * Math.PI) / 180;
      const localX = Math.cos(angleRad) * rad;
      const localY = Math.sin(angleRad) * rad;

      // Convert local coordinates to percentages relative to the rotator container
      const pctX = 50 + (localX / rect.width) * 100;
      const pctY = 50 + (localY / rect.height) * 100;

      pointer.style.left = `${pctX}%`;
      pointer.style.top = `${pctY}%`;
      pointer.style.display = 'block';
    } else {
      pointer.style.display = 'none';
    }
  }

  // --- HSL Style Snap Sync ---
  
  function syncPointerOnStyleChange() {
    if (!hasSelectedColor) return;

    const h = selectedColor.h;
    const ratio = selectedColor.s / 100;

    if (currentStyle === 'smooth') {
      // Re-map segmented snap color back to exact polar representation
      pointerPolar = { rRatio: ratio, angle: h };
    } else if (currentStyle === 'segmented') {
      // Snap current values to segmented layout
      const sectors = 24;
      const rings = 5;
      const sectorAngle = 360 / sectors;
      
      const sectorIndex = Math.floor(h / sectorAngle);
      const ringIndex = Math.min(rings - 1, Math.max(0, Math.floor(ratio * rings)));

      const snapAngle = sectorIndex * sectorAngle + (sectorAngle / 2);
      const snapRatio = (ringIndex + 0.5) / rings;

      pointerPolar = { rRatio: snapRatio, angle: snapAngle };

      // Update color state to the snapped segment values
      selectedColor.h = Math.round(sectorIndex * sectorAngle);
      selectedColor.s = Math.round(((ringIndex + 1) / rings) * 100);
      selectedColor.l = Math.round(100 - ((ringIndex + 1) / rings) * 50);
    }

    updateColorUI();
  }

  // --- Undo Operations ---
  
  function performUndo() {
    if (actionHistory.length === 0) return;
    
    // Pop last paint action
    const lastAction = actionHistory.pop();
    
    // Rollback step counter to the index of this action
    stepCount = lastAction.step;
    
    // Rollback cell color state
    cellStates[lastAction.cellIndex] = lastAction.prevColor;
    
    // Restore cell styling in DOM
    const cell = cellElements[lastAction.cellIndex];
    if (lastAction.prevColor) {
      cell.style.backgroundColor = lastAction.prevColor;
    } else {
      cell.style.backgroundColor = '';
    }
    
    // Pop visual pulse on modification
    cell.classList.remove('pop-paint');
    void cell.offsetWidth;
    cell.classList.add('pop-paint');

    // Disable button if history is fully cleared
    if (actionHistory.length === 0) {
      undoBtn.disabled = true;
    }
    
    // Update active target pointer
    updateActiveTarget();

    // Recover picker state and text inputs to matching values before this paint
    if (actionHistory.length > 0) {
      const prevAction = actionHistory[actionHistory.length - 1];
      selectedColor = { ...prevAction.selectedColor };
      pointerPolar = { ...prevAction.pointerPolar };
      hasSelectedColor = prevAction.hasSelectedColor;
    } else {
      // Fully clear back to initialization state (White and hidden pointer)
      selectedColor = { h: 0, s: 0, l: 100 };
      hasSelectedColor = false;
    }
    
    updateColorUI();
  }

  // --- Utility Color Conversion Formulas ---

  // HSL (0-360, 0-100, 0-100) to RGB (0-255)
  function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return {
      r: Math.round(255 * f(0)),
      g: Math.round(255 * f(8)),
      b: Math.round(255 * f(4))
    };
  }

  // RGB to HEX String
  function rgbToHex(r, g, b) {
    const hex = val => val.toString(16).padStart(2, '0').toUpperCase();
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }

  // --- Interaction Event Listeners ---

  // Click & Drag Handling
  const handleInteractionStart = (e) => {
    isDragging = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    processColorPick(clientX, clientY);
  };

  const handleInteractionMove = (e) => {
    if (!isDragging) return;
    // Prevent mobile scrolling while dragging on the color wheel
    if (e.cancelable) e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    processColorPick(clientX, clientY);
  };

  const handleInteractionEnd = () => {
    isDragging = false;
  };

  // Mouse Listeners
  wheelWrapper.addEventListener('mousedown', handleInteractionStart);
  window.addEventListener('mousemove', handleInteractionMove);
  window.addEventListener('mouseup', handleInteractionEnd);

  // Touch Listeners
  wheelWrapper.addEventListener('touchstart', handleInteractionStart, { passive: false });
  window.addEventListener('touchmove', handleInteractionMove, { passive: false });
  window.addEventListener('touchend', handleInteractionEnd);

  // Play / Pause Controls
  playPauseBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    if (isPlaying) {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
      playPauseText.textContent = '一時停止';
      playPauseBtn.setAttribute('aria-label', '一時停止');
    } else {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
      playPauseText.textContent = '再生';
      playPauseBtn.setAttribute('aria-label', '再生');
    }
  });

  // Direction Toggle Controls
  directionBtn.addEventListener('click', () => {
    direction *= -1;
    if (direction === 1) {
      cwIcon.style.display = 'block';
      ccwIcon.style.display = 'none';
      directionText.textContent = '時計回り';
    } else {
      cwIcon.style.display = 'none';
      ccwIcon.style.display = 'block';
      directionText.textContent = '反時計回り';
    }
  });

  // Speed Adjustment Slider
  speedSlider.addEventListener('input', (e) => {
    speedMultiplier = parseFloat(e.target.value);
    speedValueText.textContent = `${speedMultiplier.toFixed(1)}x`;
  });

  // Radio Style Toggle Controls
  styleRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentStyle = e.target.value;
      drawColorWheel();
      
      // Snaps pointer/color to matching coordinates on style toggle
      if (hasSelectedColor) {
        syncPointerOnStyleChange();
      }
    });
  });

  // Undo Action Trigger
  undoBtn.addEventListener('click', performUndo);

  // Copy Clipboard Helper
  const copyButtons = document.querySelectorAll('.copy-btn');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const textToCopy = document.getElementById(targetId).textContent;

      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          // Trigger custom toast pop notification
          toast.classList.add('show');
          setTimeout(() => {
            toast.classList.remove('show');
          }, 2000);
        })
        .catch(err => {
          console.error('Copy failed: ', err);
        });
    });
  });

  // Resize window handling
  window.addEventListener('resize', () => {
    if (hasSelectedColor) {
      updateColorUI();
    }
  });

  // Run initialization setup
  initColorGrid();
  drawColorWheel();
  
  // Set initial picked color as white
  updateColorUI();
  // Hide pointer initially until first explicit user click
  pointer.style.display = 'none';
  hasSelectedColor = false;

  // Start Animation engine
  requestAnimationFrame(updateAnimation);
});
