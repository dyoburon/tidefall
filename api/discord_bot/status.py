"""
Working status management for stream overlays.
"""
import time
from . import config

def update_working_status(text, mode='working', duration_minutes=None):
    """Update the current working status and notify all subscribers."""
    # If switching to break mode, save the current working status
    if mode == 'break' and config.current_working_status.get('mode') == 'working':
        config.saved_working_status = {
            'text': config.current_working_status.get('text'),
            'timestamp': config.current_working_status.get('timestamp')
        }

    end_time = None
    if mode == 'break' and duration_minutes:
        end_time = time.time() + (duration_minutes * 60)

    config.current_working_status = {
        'text': text,
        'timestamp': time.time() if text else None,
        'mode': mode,
        'end_time': end_time
    }

    _notify_working_subscribers(config.current_working_status)

def restore_working_status():
    """Restore the saved working status (used when canceling a break)."""
    config.current_working_status = {
        'text': config.saved_working_status.get('text'),
        'timestamp': config.saved_working_status.get('timestamp'),
        'mode': 'working',
        'end_time': None
    }

    _notify_working_subscribers(config.current_working_status)
    return config.saved_working_status.get('text')

def _notify_working_subscribers(status):
    """Notify all SSE subscribers of a status update."""
    dead_subscribers = []
    for q in config.working_subscribers:
        try:
            q.put_nowait(status)
        except:
            dead_subscribers.append(q)

    for q in dead_subscribers:
        if q in config.working_subscribers:
            config.working_subscribers.remove(q)

def add_feed_item(item_type, author, message, url=None, project=None):
    """Add an item to the feed and notify all subscribers."""
    item = {
        'id': f"{item_type}_{int(time.time() * 1000)}",
        'type': item_type,
        'author': author,
        'message': message,
        'url': url,
        'project': project,
        'timestamp': time.time()
    }
    config.feed_items.append(item)

    dead_subscribers = []
    for q in config.feed_subscribers:
        try:
            q.put_nowait(item)
        except:
            dead_subscribers.append(q)

    for q in dead_subscribers:
        if q in config.feed_subscribers:
            config.feed_subscribers.remove(q)
