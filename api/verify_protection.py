import sys
import unittest
from unittest.mock import MagicMock, patch
import time

# --- Mocking Dependencies ---
# specific mocks for firebase_admin and others to prevent ImportErrors or runtime errors
sys.modules['firebase_admin'] = MagicMock()
sys.modules['firebase_admin.credentials'] = MagicMock()
sys.modules['firebase_admin.firestore'] = MagicMock()
sys.modules['firebase_admin.auth'] = MagicMock()
sys.modules['firebase'] = MagicMock()
sys.modules['firebase_models'] = MagicMock()
# Mocking local modules that might try to connect to things
sys.modules['firestore_models'] = MagicMock()
sys.modules['cannon_handler'] = MagicMock()
sys.modules['player_handler'] = MagicMock()
sys.modules['harpoon_handler'] = MagicMock()
sys.modules['projectile_manager'] = MagicMock()

# Now we can attempt to import app
# We need to patch os.environ to avoid KeyErrors if any, though load_dotenv handles that
with patch('dotenv.load_dotenv'):
    try:
        from api.app import app, socketio, players
    except Exception as e:
        print(f"Failed to import app: {e}")
        sys.exit(1)

class TestProtection(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.client = self.app.test_client()
        # Reset players dict
        players.clear()
        
        # Reset limiter (this is tricky with Flask-Limiter in memory, usually requires fresh app or storage reset)
        # For this test, we might just rely on the fact that it's a new process
        pass

    def test_rate_limit_players(self):
        print("\nTesting Rate Limit on /api/players...")
        # Hit the endpoint 55 times (limit is 50/minute)
        for i in range(50):
            rv = self.client.get('/api/players')
            self.assertEqual(rv.status_code, 200, f"Request {i+1} failed with {rv.status_code}")
        
        # The 51st request should fail
        rv = self.client.get('/api/players')
        print(f"51st Request Status: {rv.status_code}")
        self.assertEqual(rv.status_code, 429, "Rate limit did not trigger on 51st request")

    def test_player_cap_socket(self):
        print("\nTesting Player Cap (10 players)...")
        # Fill the server with 10 dummy players
        for i in range(10):
            players[f'dummy_{i}'] = {'active': True}
        
        # Mock the socketio emit to verify rejection message
        with patch('api.app.emit') as mock_emit:
            # Manually call the handler (simulating a socket event)
            # We need to import the handler logic or use a socketio test client.
            # Flask-SocketIO provides a test client.
            
            socket_client = socketio.test_client(self.app)
            # Try to connect/join
            # Note: our logic is in 'player_join', not 'connect'
            
            # Reset players from whatever test_client connection might have done
            players.clear()
            for i in range(10):
                players[f'dummy_{i}'] = {'active': True}

            # Send join event
            socket_client.emit('player_join', {'player_id': 'new_guy'})
            
            # Check for rejection response
            received = socket_client.get_received()
            
            # Should have 'connection_response' with error or just log warning?
            # My code emits 'connection_response' with error.
            
            connection_responses = [msg for msg in received if msg['name'] == 'connection_response']
            self.assertTrue(len(connection_responses) > 0, "No connection response received")
            self.assertIn('error', connection_responses[0]['args'][0], "No error in connection response")
            print("Player cap correctly rejected new connection.")
            socket_client.disconnect()

if __name__ == '__main__':
    unittest.main()
