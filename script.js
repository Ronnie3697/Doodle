document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const COLORS = [
        '#2d3436', // Black
        '#636e72', // Dark Grey
        '#b2bec3', // Light Grey
        '#dfe6e9', // Pale Grey
        '#ffffff', // White
        
        '#d63031', // Red
        '#e17055', // Terra Cotta
        '#fab1a0', // Salmon
        '#ff7675', // Pink
        '#fd79a8', // Hot Pink
        
        '#e84393', // Dark Pink
        '#fdcb6e', // Mustard
        '#ffeaa7', // Cream Yellow
        '#f1c40f', // Bright Yellow
        '#e67e22', // Orange
        
        '#d35400', // Pumpkin
        '#27ae60', // Green
        '#2ecc71', // Emerald
        '#55efc4', // Mint
        '#00b894', // Teal

        '#16a085', // Dark Teal
        '#00cec9', // Cyan
        '#74b9ff', // Sky Blue
        '#0984e3', // Blue
        '#0097e6', // Bright Blue

        '#182C61', // Midnight Blue
        '#6c5ce7', // Purple
        '#a29bfe', // Lavender
        '#8e44ad', // Dark Purple
        '#2c3e50', // Dark Blue Grey

        '#8395a7', // Blue Grey
        '#95a5a6', // Concrete
        '#7f8c8d', // Asbestos
        '#6D214F', // Plum
        '#2C3A47'  // Onyx
    ];
    
    // --- State ---
    const state = {
        isDrawing: false,
        currentPaperId: 0,
        papers: [],
        brushSize: 5,
        brushColor: '#2d3436',
        isEraser: false,
        lastX: 0,
        lastY: 0
    };

    // --- DOM Elements ---
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); // optimize for readback
    const container = document.querySelector('.canvas-wrapper');
    
    // Tools
    const btnBrush = document.getElementById('btn-brush');
    const btnEraser = document.getElementById('btn-eraser');
    const inputSize = document.getElementById('brush-size');
    const colorPalette = document.getElementById('color-palette');
    const papersList = document.getElementById('papers-list');
    const btnAddPaper = document.getElementById('btn-add-paper');

    // --- Initialization ---

    function init() {
        resizeCanvas();
        generateColors();
        
        // Create first paper
        addPaper();
        
        // Event Listeners
        window.addEventListener('resize', handleResize);
        
        // Canvas Drawing Events
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);
        
        // Touch support
        canvas.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            canvas.dispatchEvent(mouseEvent);
            e.preventDefault(); // prevent scroll
        });
        canvas.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            canvas.dispatchEvent(mouseEvent);
            e.preventDefault();
        });
        canvas.addEventListener('touchend', () => {
            const mouseEvent = new MouseEvent('mouseup', {});
            canvas.dispatchEvent(mouseEvent);
        });

        // UI Controls
        btnBrush.addEventListener('click', activateBrush);
        btnEraser.addEventListener('click', activateEraser);
        
        inputSize.addEventListener('input', (e) => {
            state.brushSize = e.target.value;
        });

        btnAddPaper.addEventListener('click', addPaper);
    }

    // --- Core Functions ---

    function resizeCanvas() {
        // We need to save content before resize if it exists
        let tempContent;
        if (state.papers.length > 0) {
            // Save state of current paper to memory before resizing canvas which clears it
             saveCurrentPaperState();
        }

        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        // Restore context settings that get reset on resize
        updateContextSettings();

        // If we have content for current paper, restore it
        if (state.papers.length > 0) {
            restorePaperState(state.currentPaperId);
        }
    }
    
    function handleResize() {
        // Debounce or just run? Native resize is firing often.
        // For simplicity, we just run. In prod, debounce.
        resizeCanvas();
    }

    function updateContextSettings() {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = state.brushSize;
        if (state.isEraser) {
            ctx.globalCompositeOperation = 'destination-out';
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = state.brushColor;
        }
    }

    // --- Drawing Logic ---

    function startDrawing(e) {
        state.isDrawing = true;
        [state.lastX, state.lastY] = getCoordinates(e);
        updateContextSettings(); // Ensure settings are fresh
    }

    function draw(e) {
        if (!state.isDrawing) return;
        
        const [x, y] = getCoordinates(e);
        
        ctx.beginPath();
        ctx.moveTo(state.lastX, state.lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        
        [state.lastX, state.lastY] = [x, y];
    }

    function stopDrawing() {
        if (state.isDrawing) {
            state.isDrawing = false;
            saveCurrentPaperState(); // Save to state object
        }
    }

    function getCoordinates(e) {
        const rect = canvas.getBoundingClientRect();
        return [
            e.clientX - rect.left,
            e.clientY - rect.top
        ];
    }

    // --- State Management : Papers ---

    function saveCurrentPaperState() {
        const paper = state.papers.find(p => p.id === state.currentPaperId);
        if (paper) {
            paper.imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }
    }

    function restorePaperState(id) {
        const paper = state.papers.find(p => p.id === id);
        if (paper && paper.imageData) {
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear first
            // Note: If resizing made canvas smaller, this puts data at 0,0 clipping the rest.
            // If made larger, it puts it at 0,0 with empty space.
            // This is acceptable behavior for a simple doodle app.
            ctx.putImageData(paper.imageData, 0, 0);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    function addPaper() {
        // Save current before switching
        if (state.papers.length > 0) saveCurrentPaperState();

        const newId = state.papers.length > 0 ? Math.max(...state.papers.map(p => p.id)) + 1 : 1;
        const newPaper = {
            id: newId,
            name: `Papír ${newId}`,
            imageData: null
        };
        
        state.papers.push(newPaper);
        switchPaper(newId);
        renderPaperList();
    }

    function switchPaper(id) {
        if (state.currentPaperId === id) return;
        
        if (state.currentPaperId !== 0) {
            saveCurrentPaperState();
        }
        
        state.currentPaperId = id;
        restorePaperState(id);
        renderPaperList();
    }

    function renderPaperList() {
        papersList.innerHTML = '';
        state.papers.forEach(paper => {
            const el = document.createElement('div');
            el.className = `paper-item ${paper.id === state.currentPaperId ? 'active' : ''}`;
            el.innerHTML = `
                <div class="paper-preview"></div>
                <span class="paper-name">${paper.name}</span>
            `;
            el.addEventListener('click', () => switchPaper(paper.id));
            papersList.appendChild(el);
        });
    }

    // --- Tools Logic ---

    function generateColors() {
        colorPalette.innerHTML = '';
        COLORS.forEach(color => {
            const dot = document.createElement('div');
            dot.className = `color-dot ${color === state.brushColor ? 'active' : ''}`;
            dot.style.backgroundColor = color;
            dot.addEventListener('click', () => setColor(color));
            colorPalette.appendChild(dot);
        });
    }

    function setColor(color) {
        state.brushColor = color;
        activateBrush(); // Switching color implicitly activates brush
        
        // Update UI
        document.querySelectorAll('.color-dot').forEach(d => {
            d.classList.toggle('active', d.style.backgroundColor === getComputedColor(color)); 
            // Note: style.backgroundColor converts hex to rgb, so exact string match might fail.
            // Simplified check:
            if (color === '#ffffff' && d.style.backgroundColor === 'rgb(255, 255, 255)') d.classList.add('active');
            // Better to re-render or track index, but this is fine.
        });
        
        // Easier: Re-render palette to update active class
        generateColors();
    }
    
    // Helper to normalize colors if needed, but regenerating is cheap enough for this list
    
    function activateBrush() {
        state.isEraser = false;
        btnBrush.classList.add('active');
        btnEraser.classList.remove('active');
        inputSize.disabled = false; // Enable size slider
        updateContextSettings();
    }

    function activateEraser() {
        state.isEraser = true;
        btnEraser.classList.add('active');
        btnBrush.classList.remove('active');
        // Reset active color in UI
        document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        updateContextSettings();
    }

    // Utility to get computed color for comparison (optional)
    function getComputedColor(c) {
        // Not used, regenerating is fine
        return c;
    }

    // Run
    init();
});
