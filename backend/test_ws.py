"""Test WebSocket connection."""
import os
import asyncio
import websockets
import django

# pylint: disable=wrong-import-position, invalid-name

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'burnvault_project.settings')
django.setup()

from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth.models import User

# Synchronous query
u = User.objects.first() # pylint: disable=no-member
TOKEN = str(AccessToken.for_user(u))
print(f"Testing with user: {u.username}")

async def test():
    """Attempt a test connection."""
    try:
        async with websockets.connect(f'ws://127.0.0.1:8000/ws/messages/?token={TOKEN}') as _ws:
            print('Connected!')
    except websockets.exceptions.WebSocketException as e:
        print(f"Failed to connect: {e}")
    except OSError as e:
        print(f"Failed to connect: {e}")

if __name__ == '__main__':
    asyncio.run(test())
