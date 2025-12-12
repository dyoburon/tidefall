"""
HTML templates for OBS overlays and control panels.
"""

FEED_HTML = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Live Feed</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        html, body {
            background-color: rgba(0, 0, 0, 0) !important;
            background: transparent !important;
            overflow: hidden !important;
            font-family: 'JetBrains Mono', monospace;
        }

        #feed-container {
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        ::-webkit-scrollbar { display: none !important; }

        @keyframes slideIn {
            0% { opacity: 0; transform: translateX(-20px); }
            100% { opacity: 1; transform: translateX(0); }
        }

        @keyframes fadeOut {
            0% { opacity: 1; }
            100% { opacity: 0; }
        }

        .feed-item {
            animation: slideIn 0.3s ease-out both, fadeOut 1s ease-in forwards;
            animation-delay: 0s, 15s;
            background: rgba(0, 0, 0, 0.95);
            backdrop-filter: blur(4px);
            border-left: 4px solid #2ea043;
            border-radius: 4px 12px 12px 4px;
            padding: 14px 34px;
            width: fit-content;
            max-width: 90%;
            box-shadow: 2px 4px 10px rgba(0,0,0,0.5);
        }

        .feed-item.removing {
            animation: fadeOut 0.5s ease-out forwards;
        }

        .feed-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 6px;
        }

        .feed-icon {
            width: 36px;
            height: 36px;
            flex-shrink: 0;
        }

        .feed-author {
            font-size: 24px;
            font-weight: 700;
            color: #2ea043;
            letter-spacing: -0.5px;
        }

        .feed-message {
            font-size: 28px;
            color: #EEEEEE;
            line-height: 1.4;
            font-weight: 400;
        }

        .feed-project {
            color: #2ea043;
            font-weight: 700;
        }
    </style>
</head>
<body>
    <div id="feed-container"></div>

    <script>
        const container = document.getElementById('feed-container');
        const displayedItems = new Set();

        // GitHub icon SVG
        const githubIcon = `<svg class="feed-icon" viewBox="0 0 24 24" fill="#EEEEEE"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>`;

        function addItem(item) {
            if (displayedItems.has(item.id)) return;
            displayedItems.add(item.id);

            const el = document.createElement('div');
            el.className = 'feed-item';
            el.id = item.id;

            let icon = githubIcon;
            let content = '';

            if (item.type === 'commit') {
                content = `
                    <div class="feed-header">
                        ${icon}
                        <span class="feed-author">${escapeHtml(item.author)}</span>
                    </div>
                    <div class="feed-message">
                        ${escapeHtml(item.message)} to <span class="feed-project">${escapeHtml(item.project)}</span>
                    </div>
                `;
            } else {
                content = `
                    <div class="feed-header">
                        ${icon}
                        <span class="feed-author">${escapeHtml(item.author || 'System')}</span>
                    </div>
                    <div class="feed-message">${escapeHtml(item.message)}</div>
                `;
            }

            el.innerHTML = content;
            container.insertBefore(el, container.firstChild);

            // Remove after animation completes (16 seconds = 15s delay + 1s fade)
            setTimeout(() => {
                el.classList.add('removing');
                setTimeout(() => {
                    el.remove();
                    displayedItems.delete(item.id);
                }, 500);
            }, 16000);

            // Keep only last 10 items visible
            while (container.children.length > 10) {
                const last = container.lastChild;
                displayedItems.delete(last.id);
                last.remove();
            }
        }

        function escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Server-Sent Events for real-time updates
        function connectSSE() {
            const evtSource = new EventSource('/feed/events');

            evtSource.onmessage = (event) => {
                try {
                    const item = JSON.parse(event.data);
                    addItem(item);
                } catch (e) {
                    console.error('Error parsing SSE data:', e);
                }
            };

            evtSource.onerror = () => {
                console.log('SSE connection lost, reconnecting...');
                evtSource.close();
                setTimeout(connectSSE, 3000);
            };
        }

        // Load existing items on page load
        fetch('/feed/items')
            .then(r => r.json())
            .then(items => {
                // Show last 5 items on load (oldest first so newest appears on top)
                items.slice(-5).forEach(item => addItem(item));
            })
            .catch(console.error);

        // Start SSE connection
        connectSSE();
    </script>
</body>
</html>'''

WORKING_HTML = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Working Status</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        html, body {
            background-color: rgba(0, 0, 0, 0) !important;
            background: transparent !important;
            overflow: hidden !important;
            font-family: 'JetBrains Mono', monospace;
        }

        #working-container {
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        ::-webkit-scrollbar { display: none !important; }

        @keyframes slideIn {
            0% { opacity: 0; transform: translateX(-20px); }
            100% { opacity: 1; transform: translateX(0); }
        }

        @keyframes slideOut {
            0% { opacity: 1; transform: translateX(0); }
            100% { opacity: 0; transform: translateX(-20px); }
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }

        .working-item {
            animation: slideIn 0.3s ease-out both;
            background: rgba(0, 0, 0, 0.95);
            backdrop-filter: blur(4px);
            border-left: 4px solid #f59e0b;
            border-radius: 4px 12px 12px 4px;
            padding: 14px 34px;
            width: fit-content;
            max-width: 90%;
            box-shadow: 2px 4px 10px rgba(0,0,0,0.5);
            transition: border-color 0.3s ease;
        }

        .working-item.break-mode {
            border-left-color: #8b5cf6;
        }

        .working-item.removing {
            animation: slideOut 0.3s ease-out forwards;
        }

        .working-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 6px;
        }

        .working-icon {
            width: 36px;
            height: 36px;
            flex-shrink: 0;
            animation: pulse 2s ease-in-out infinite;
        }

        .working-label {
            font-size: 24px;
            font-weight: 700;
            color: #f59e0b;
            letter-spacing: -0.5px;
            transition: color 0.3s ease;
        }

        .break-mode .working-label {
            color: #8b5cf6;
        }

        .working-text {
            font-size: 28px;
            color: #EEEEEE;
            line-height: 1.4;
            font-weight: 400;
        }

        .countdown {
            font-variant-numeric: tabular-nums;
        }

        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div id="working-container">
        <div id="working-item" class="working-item hidden">
            <div class="working-header">
                <svg id="working-icon" class="working-icon" viewBox="0 0 24 24" fill="#f59e0b">
                    <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
                </svg>
                <span id="working-label" class="working-label">Working on</span>
            </div>
            <div id="working-text" class="working-text"></div>
        </div>
    </div>

    <script>
        const workingItem = document.getElementById('working-item');
        const workingIcon = document.getElementById('working-icon');
        const workingLabel = document.getElementById('working-label');
        const workingText = document.getElementById('working-text');

        // Icons
        const wrenchIcon = '<path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>';
        const coffeeIcon = '<path d="M2 21h18v-2H2v2zm16-8.18c.64-.37 1.14-.93 1.43-1.61.29-.68.37-1.44.23-2.16-.14-.73-.51-1.39-1.05-1.9-.54-.52-1.24-.85-1.98-.96V4h1V2H4v2h1v2.19c-.74.11-1.44.44-1.98.96-.54.51-.91 1.17-1.05 1.9-.14.72-.06 1.48.23 2.16.29.68.79 1.24 1.43 1.61L2 21h2l.52-3h12.96l.52 3h2l-2-8.18zM9 4h6v2H9V4zM6.14 10c-.04-.17-.06-.35-.06-.52 0-.82.39-1.59 1.03-2.06.24-.18.51-.31.8-.41V7h8.18v-.01c.29.1.56.23.8.41.64.47 1.03 1.24 1.03 2.06 0 .17-.02.35-.06.52-.14.68-.52 1.27-1.05 1.68-.53.4-1.19.63-1.87.63H9.06c-.68 0-1.34-.23-1.87-.63-.53-.41-.91-1-1.05-1.68V10z"/>';

        let currentStatus = null;
        let countdownInterval = null;

        function escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function formatTime(seconds) {
            if (seconds <= 0) return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return mins + ':' + secs.toString().padStart(2, '0');
        }

        function updateCountdown() {
            if (!currentStatus || currentStatus.mode !== 'break' || !currentStatus.end_time) {
                return;
            }

            const now = Date.now() / 1000;
            const remaining = currentStatus.end_time - now;

            if (remaining <= 0) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                hideStatus();
            } else {
                workingText.innerHTML = '<span class="countdown">' + formatTime(remaining) + '</span>';
            }
        }

        function hideStatus() {
            workingItem.classList.add('removing');
            setTimeout(() => {
                workingItem.classList.add('hidden');
                workingItem.classList.remove('removing', 'break-mode');
            }, 300);
        }

        function updateStatus(status) {
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }

            currentStatus = status;

            if (status.text || (status.mode === 'break' && status.end_time)) {
                if (status.mode === 'break') {
                    workingIcon.innerHTML = coffeeIcon;
                    workingIcon.setAttribute('fill', '#8b5cf6');
                    workingLabel.textContent = 'Coffee break';
                    workingItem.classList.add('break-mode');

                    updateCountdown();
                    countdownInterval = setInterval(updateCountdown, 1000);
                } else {
                    workingIcon.innerHTML = wrenchIcon;
                    workingIcon.setAttribute('fill', '#f59e0b');
                    workingLabel.textContent = 'Working on';
                    workingItem.classList.remove('break-mode');
                    workingText.innerHTML = escapeHtml(status.text);
                }

                workingItem.classList.remove('hidden', 'removing');
                workingItem.style.animation = 'none';
                workingItem.offsetHeight;
                workingItem.style.animation = null;
            } else {
                hideStatus();
            }
        }

        function connectSSE() {
            const evtSource = new EventSource('/working/events');

            evtSource.onmessage = (event) => {
                try {
                    const status = JSON.parse(event.data);
                    if (status.type !== 'ping') {
                        updateStatus(status);
                    }
                } catch (e) {
                    console.error('Error parsing SSE data:', e);
                }
            };

            evtSource.onerror = () => {
                console.log('SSE connection lost, reconnecting...');
                evtSource.close();
                setTimeout(connectSSE, 3000);
            };
        }

        fetch('/working/status')
            .then(r => r.json())
            .then(status => {
                if (status.text || (status.mode === 'break' && status.end_time)) {
                    updateStatus(status);
                }
            })
            .catch(console.error);

        connectSSE();
    </script>
</body>
</html>'''

BRB_HTML = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coffee Break - Be Right Back</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            width: 100vw;
            height: 100vh;
            overflow: hidden;
            background: #1a1612;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        canvas {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }

        .content {
            position: relative;
            z-index: 10;
            text-align: center;
            color: #f5f0eb;
            background: rgba(0, 0, 0, 0.7);
            padding: 50px 80px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
        }

        .coffee-icon {
            font-size: 64px;
            margin-bottom: 20px;
            animation: steam 2s ease-in-out infinite;
            display: inline-block;
        }

        @keyframes steam {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
        }

        .title {
            font-family: 'Playfair Display', serif;
            font-size: 72px;
            font-weight: 700;
            letter-spacing: 4px;
            text-transform: uppercase;
            margin-bottom: 16px;
            text-shadow: 0 4px 30px rgba(139, 90, 43, 0.5);
            background: linear-gradient(135deg, #f5f0eb 0%, #d4a574 50%, #f5f0eb 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .subtitle {
            font-family: 'Inter', sans-serif;
            font-size: 24px;
            font-weight: 300;
            letter-spacing: 8px;
            text-transform: uppercase;
            opacity: 0.8;
            color: #d4a574;
        }

        .divider {
            width: 200px;
            height: 2px;
            background: linear-gradient(90deg, transparent, #d4a574, transparent);
            margin: 30px auto;
        }
    </style>
</head>
<body>
    <canvas id="swirls"></canvas>

    <div class="content">
        <div class="coffee-icon">&#9749;</div>
        <h1 class="title">Coffee Break</h1>
        <div class="divider"></div>
        <p class="subtitle">Be Right Back</p>
    </div>

    <script>
        const canvas = document.getElementById('swirls');
        const ctx = canvas.getContext('2d');

        let width, height;
        let particles = [];
        let time = 0;

        const colors = [
            { r: 139, g: 90, b: 43 },
            { r: 212, g: 165, b: 116 },
            { r: 245, g: 240, b: 235 },
            { r: 180, g: 130, b: 80 },
            { r: 100, g: 60, b: 30 },
            { r: 230, g: 210, b: 180 },
        ];

        function resize() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            initParticles();
        }

        function initParticles() {
            particles = [];
            const count = Math.floor((width * height) / 8000);

            for (let i = 0; i < count; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    size: Math.random() * 150 + 50,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    speedX: (Math.random() - 0.5) * 0.3,
                    speedY: (Math.random() - 0.5) * 0.3,
                    angle: Math.random() * Math.PI * 2,
                    angleSpeed: (Math.random() - 0.5) * 0.008,
                    noiseOffsetX: Math.random() * 1000,
                    noiseOffsetY: Math.random() * 1000,
                    opacity: Math.random() * 0.3 + 0.1
                });
            }
        }

        function noise(x, y, t) {
            return Math.sin(x * 0.01 + t) * Math.cos(y * 0.01 + t * 0.7) *
                   Math.sin((x + y) * 0.005 + t * 0.5);
        }

        function drawSwirl(p) {
            const noiseVal = noise(p.x + p.noiseOffsetX, p.y + p.noiseOffsetY, time * 0.5);

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle + noiseVal * 0.5);

            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
            gradient.addColorStop(0, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.opacity})`);
            gradient.addColorStop(0.5, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.opacity * 0.5})`);
            gradient.addColorStop(1, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, 0)`);

            ctx.fillStyle = gradient;

            ctx.beginPath();
            const points = 6;
            for (let i = 0; i <= points * 20; i++) {
                const t = (i / (points * 20)) * Math.PI * 2 * 3;
                const r = p.size * (1 - i / (points * 20)) * (0.8 + 0.2 * Math.sin(t * 2 + time));
                const x = Math.cos(t) * r * (1 + 0.3 * Math.sin(t * 3));
                const y = Math.sin(t) * r * (1 + 0.3 * Math.cos(t * 2));

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }

        function update() {
            particles.forEach(p => {
                const noiseX = noise(p.x * 0.01, p.y * 0.01, time * 0.3);
                const noiseY = noise(p.y * 0.01, p.x * 0.01, time * 0.3 + 100);

                p.x += p.speedX + noiseX * 0.5;
                p.y += p.speedY + noiseY * 0.5;
                p.angle += p.angleSpeed;

                if (p.x < -p.size) p.x = width + p.size;
                if (p.x > width + p.size) p.x = -p.size;
                if (p.y < -p.size) p.y = height + p.size;
                if (p.y > height + p.size) p.y = -p.size;
            });
        }

        function draw() {
            ctx.fillStyle = 'rgba(26, 22, 18, 0.08)';
            ctx.fillRect(0, 0, width, height);

            particles.sort((a, b) => a.size - b.size);
            particles.forEach(drawSwirl);
        }

        function animate() {
            time += 0.016;
            update();
            draw();
            requestAnimationFrame(animate);
        }

        function addCreamStreams() {
            const streamCount = 5;
            for (let i = 0; i < streamCount; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    size: Math.random() * 300 + 200,
                    color: colors[2],
                    speedX: (Math.random() - 0.5) * 0.15,
                    speedY: (Math.random() - 0.5) * 0.15,
                    angle: Math.random() * Math.PI * 2,
                    angleSpeed: (Math.random() - 0.5) * 0.003,
                    noiseOffsetX: Math.random() * 1000,
                    noiseOffsetY: Math.random() * 1000,
                    opacity: Math.random() * 0.15 + 0.05
                });
            }
        }

        window.addEventListener('resize', resize);
        resize();
        addCreamStreams();

        ctx.fillStyle = '#1a1612';
        ctx.fillRect(0, 0, width, height);

        animate();
    </script>
</body>
</html>'''

CONTROL_PANEL_HTML = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stream Controls</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e;
            color: #eee;
            min-height: 100vh;
            padding: 40px;
        }
        h1 { margin-bottom: 30px; color: #d4a574; }
        .section { margin-bottom: 30px; }
        .section h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #888; margin-bottom: 15px; }
        .buttons { display: flex; gap: 15px; flex-wrap: wrap; }
        button {
            padding: 15px 30px;
            font-size: 16px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: transform 0.1s, box-shadow 0.1s;
        }
        button:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        button:active { transform: translateY(0); }
        .btn-coffee { background: #8b5cf6; color: white; }
        .btn-back { background: #10b981; color: white; }
        .btn-clear { background: #ef4444; color: white; }
        .btn-set { background: #f59e0b; color: black; }
        input[type="text"] {
            padding: 15px;
            font-size: 16px;
            border: 2px solid #333;
            border-radius: 8px;
            background: #16213e;
            color: #eee;
            width: 300px;
        }
        input[type="text"]:focus { outline: none; border-color: #f59e0b; }
        .status { margin-top: 20px; padding: 15px; background: #16213e; border-radius: 8px; }
        .status.success { border-left: 4px solid #10b981; }
        .status.error { border-left: 4px solid #ef4444; }
        .key-input { margin-bottom: 30px; }
        .key-input label { display: block; margin-bottom: 8px; color: #888; }
    </style>
</head>
<body>
    <h1>Stream Controls</h1>

    <div class="key-input">
        <label>API Key (saved in browser)</label>
        <input type="password" id="apiKey" placeholder="Enter your secret key" />
    </div>

    <div class="section">
        <h2>Working Status</h2>
        <div class="buttons">
            <input type="text" id="taskInput" placeholder="What are you working on?" />
            <button class="btn-set" onclick="setWorking()">Set Status</button>
            <button class="btn-clear" onclick="clearWorking()">Clear</button>
        </div>
    </div>

    <div class="section">
        <h2>Break Controls</h2>
        <div class="buttons">
            <button class="btn-coffee" onclick="startCoffee()">Coffee Break</button>
            <button class="btn-back" onclick="endBreak()">Back from Break</button>
        </div>
    </div>

    <div id="status" class="status" style="display:none;"></div>

    <script>
        document.getElementById('apiKey').value = localStorage.getItem('streamControlKey') || '';
        document.getElementById('apiKey').addEventListener('change', (e) => {
            localStorage.setItem('streamControlKey', e.target.value);
        });

        function getKey() {
            return document.getElementById('apiKey').value;
        }

        function showStatus(message, isError = false) {
            const el = document.getElementById('status');
            el.textContent = message;
            el.className = 'status ' + (isError ? 'error' : 'success');
            el.style.display = 'block';
            setTimeout(() => el.style.display = 'none', 3000);
        }

        async function apiCall(endpoint, params = {}) {
            const url = new URL(endpoint, window.location.origin);
            url.searchParams.set('key', getKey());
            Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

            try {
                const res = await fetch(url);
                const data = await res.json();
                if (res.ok) {
                    showStatus('Success: ' + (data.message || data.task || 'Done'));
                } else {
                    showStatus('Error: ' + (data.error || 'Failed'), true);
                }
            } catch (e) {
                showStatus('Error: ' + e.message, true);
            }
        }

        function setWorking() {
            const task = document.getElementById('taskInput').value;
            if (!task) return showStatus('Enter a task first', true);
            apiCall('/api/working', { task });
        }

        function clearWorking() {
            apiCall('/api/working');
        }

        function startCoffee() {
            apiCall('/api/coffee');
        }

        function endBreak() {
            apiCall('/api/back');
        }

        document.getElementById('taskInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') setWorking();
        });
    </script>
</body>
</html>'''
