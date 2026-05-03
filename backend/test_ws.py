import asyncio
import websockets
import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'burnvault_project.settings')
django.setup()

from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth.models import User

# Synchronous query
u = User.objects.first()
token = str(AccessToken.for_user(u))
print(f"Testing with user: {u.username}")

async def test():
    try:
        async with websockets.connect(f'ws://127.0.0.1:8000/ws/messages/?token={token}') as ws:
            print('Connected!')
    except Exception as e:
        print(f"Failed to connect: {e}")

asyncio.run(test())
