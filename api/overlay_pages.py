"""
Overlay Pages for OBS Stream
Serves static HTML pages for stream overlays like BRB screens.
"""

from flask import Flask, Response

app = Flask(__name__)

# --- Coffee Break / BRB Page ---
BRB_HTML = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coffee Break - Be Right Back</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400&display=swap');

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

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

        // Latte color palette
        const colors = [
            { r: 139, g: 90, b: 43 },   // Coffee brown
            { r: 212, g: 165, b: 116 }, // Latte
            { r: 245, g: 240, b: 235 }, // Cream
            { r: 180, g: 130, b: 80 },  // Caramel
            { r: 100, g: 60, b: 30 },   // Dark roast
            { r: 230, g: 210, b: 180 }, // Milk foam
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

        // Simple noise function for organic movement
        function noise(x, y, t) {
            return Math.sin(x * 0.01 + t) * Math.cos(y * 0.01 + t * 0.7) *
                   Math.sin((x + y) * 0.005 + t * 0.5);
        }

        function drawSwirl(p) {
            const noiseVal = noise(p.x + p.noiseOffsetX, p.y + p.noiseOffsetY, time * 0.5);

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle + noiseVal * 0.5);

            // Create gradient for swirl
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
            gradient.addColorStop(0, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.opacity})`);
            gradient.addColorStop(0.5, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.opacity * 0.5})`);
            gradient.addColorStop(1, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, 0)`);

            ctx.fillStyle = gradient;

            // Draw organic swirl shape
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

                // Wrap around edges
                if (p.x < -p.size) p.x = width + p.size;
                if (p.x > width + p.size) p.x = -p.size;
                if (p.y < -p.size) p.y = height + p.size;
                if (p.y > height + p.size) p.y = -p.size;
            });
        }

        function draw() {
            // Dark coffee background with slight fade effect
            ctx.fillStyle = 'rgba(26, 22, 18, 0.08)';
            ctx.fillRect(0, 0, width, height);

            // Sort by size for depth effect
            particles.sort((a, b) => a.size - b.size);

            particles.forEach(drawSwirl);
        }

        function animate() {
            time += 0.016;
            update();
            draw();
            requestAnimationFrame(animate);
        }

        // Add flowing cream streams
        function addCreamStreams() {
            const streamCount = 5;
            for (let i = 0; i < streamCount; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    size: Math.random() * 300 + 200,
                    color: colors[2], // Cream color
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

        // Initial fill with dark background
        ctx.fillStyle = '#1a1612';
        ctx.fillRect(0, 0, width, height);

        animate();
    </script>
</body>
</html>'''


@app.route('/brb')
def serve_brb():
    """Serve the Coffee Break / BRB overlay page."""
    return BRB_HTML


@app.route('/health')
def health():
    """Health check endpoint."""
    return {'status': 'ok'}


if __name__ == "__main__":
    import os
    port = int(os.environ.get("OVERLAY_PORT", 5003))
    print(f"Starting overlay pages server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
