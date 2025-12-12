"""
Flask routes for overlays and API endpoints.
"""
import queue
import json as json_module
from flask import request, jsonify, Response, stream_with_context

from . import config
from .status import update_working_status, restore_working_status, add_feed_item
from .templates import FEED_HTML, WORKING_HTML, BRB_HTML, CONTROL_PANEL_HTML


def register_routes(app):
    """Register all Flask routes on the given app."""

    # --- Feed Overlay Routes ---
    @app.route('/feed')
    def serve_feed():
        """Serve the OBS overlay feed page."""
        return FEED_HTML

    @app.route('/feed/items')
    def get_feed_items():
        """Get recent feed items as JSON."""
        return jsonify(list(config.feed_items))

    @app.route('/feed/events')
    def feed_events():
        """Server-Sent Events endpoint for real-time feed updates."""
        def generate():
            q = queue.Queue()
            config.feed_subscribers.append(q)
            try:
                yield f"data: {json_module.dumps({'type': 'ping'})}\n\n"

                while True:
                    try:
                        item = q.get(timeout=30)
                        yield f"data: {json_module.dumps(item)}\n\n"
                    except queue.Empty:
                        yield f": ping\n\n"
            except GeneratorExit:
                pass
            finally:
                if q in config.feed_subscribers:
                    config.feed_subscribers.remove(q)

        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            }
        )

    # --- Working Status Overlay Routes ---
    @app.route('/working')
    def serve_working():
        """Serve the OBS overlay working status page."""
        return WORKING_HTML

    @app.route('/working/status')
    def get_working_status():
        """Get current working status as JSON."""
        return jsonify(config.current_working_status)

    @app.route('/working/events')
    def working_events():
        """Server-Sent Events endpoint for real-time working status updates."""
        def generate():
            q = queue.Queue()
            config.working_subscribers.append(q)
            try:
                yield f"data: {json_module.dumps({'type': 'ping'})}\n\n"

                while True:
                    try:
                        status = q.get(timeout=30)
                        yield f"data: {json_module.dumps(status)}\n\n"
                    except queue.Empty:
                        yield f": ping\n\n"
            except GeneratorExit:
                pass
            finally:
                if q in config.working_subscribers:
                    config.working_subscribers.remove(q)

        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            }
        )

    # --- BRB Page ---
    @app.route('/brb')
    def serve_brb():
        """Serve the Coffee Break / BRB overlay page."""
        return BRB_HTML

    # --- Control Panel ---
    @app.route('/controls')
    def serve_controls():
        """Serve the stream control panel. Requires key to access."""
        auth_key = request.args.get('key')
        if auth_key != config.SHARED_SECRET:
            return "Unauthorized", 401
        return CONTROL_PANEL_HTML

    # --- API Endpoints ---
    @app.route('/api/coffee', methods=['POST', 'GET'])
    def api_coffee():
        """Start coffee break via API call."""
        auth_secret = request.headers.get('X-Secret-Key') or request.args.get('key')
        if auth_secret != config.SHARED_SECRET:
            return jsonify({"error": "Unauthorized"}), 403

        update_working_status("Coffee Break", mode='break')
        config.logger.info("Coffee break started via API")
        return jsonify({"status": "success", "message": "Coffee break started"})

    @app.route('/api/back', methods=['POST', 'GET'])
    def api_back():
        """End break and restore status via API call."""
        auth_secret = request.headers.get('X-Secret-Key') or request.args.get('key')
        if auth_secret != config.SHARED_SECRET:
            return jsonify({"error": "Unauthorized"}), 403

        if config.current_working_status.get('mode') != 'break':
            return jsonify({"status": "no_break", "message": "No active break"})

        restored_text = restore_working_status()
        config.logger.info("Break ended via API")
        return jsonify({"status": "success", "restored": restored_text})

    @app.route('/api/working', methods=['POST', 'GET'])
    def api_working():
        """Set working status via API call."""
        auth_secret = request.headers.get('X-Secret-Key') or request.args.get('key')
        if auth_secret != config.SHARED_SECRET:
            return jsonify({"error": "Unauthorized"}), 403

        if request.method == 'POST':
            data = request.json or {}
            task = data.get('task')
        else:
            task = request.args.get('task')

        if task:
            update_working_status(task)
            config.logger.info(f"Working status set via API: {task}")
            return jsonify({"status": "success", "task": task})
        else:
            update_working_status(None)
            config.logger.info("Working status cleared via API")
            return jsonify({"status": "success", "message": "Status cleared"})
