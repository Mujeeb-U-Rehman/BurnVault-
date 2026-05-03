from __future__ import annotations

from urllib.parse import parse_qs

import jwt
from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from django.contrib.auth.models import User


@sync_to_async
def _get_user_from_token(token: str):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
    except Exception as e:
        print(f"JWT decode error: {e}")
        return None

    user_id = payload.get('user_id')
    if not user_id:
        print("JWT payload missing user_id")
        return None
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        print(f"User {user_id} does not exist")
        return None


class MessagesConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        qs = parse_qs(self.scope.get('query_string', b'').decode('utf-8'))
        token = (qs.get('token') or [None])[0]
        if not token:
            print("No token in query string")
            await self.close(code=4401)
            return

        user = await _get_user_from_token(token)
        if user is None:
            print("Failed to get user from token")
            await self.close(code=4401)
            return

        self.user = user
        self.group_name = f'user_{user.id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        group = getattr(self, 'group_name', None)
        if group:
            await self.channel_layer.group_discard(group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        msg_type = content.get('type')
        if msg_type == 'encrypt_message':
            await self._handle_encrypt_message(content)
        elif msg_type == 'encrypt_file':
            await self._handle_encrypt_file(content)
        elif msg_type == 'key_exchange':
            await self._handle_key_exchange(content)
        else:
            await self.send_json({'type': 'error', 'message': 'Unknown message type'})

    async def _handle_encrypt_message(self, content):
        recipient_id = content.get('recipient_id')
        if not recipient_id:
            await self.send_json({'type': 'error', 'message': 'recipient_id is required'})
            return

        await self.channel_layer.group_send(
            f'user_{recipient_id}',
            {
                'type': 'message.received',
                'sender_id': self.user.id,
                'sender_username': self.user.username,
                'encrypted_content': content.get('encrypted_content'),
                'encrypted_key': content.get('encrypted_key'),
                'iv': content.get('iv'),
                'timestamp': content.get('timestamp'),
            },
        )
        await self.send_json({'type': 'message_sent'})

    async def _handle_encrypt_file(self, content):
        recipient_id = content.get('recipient_id')
        if not recipient_id:
            await self.send_json({'type': 'error', 'message': 'recipient_id is required'})
            return

        await self.channel_layer.group_send(
            f'user_{recipient_id}',
            {
                'type': 'file.received',
                'sender_id': self.user.id,
                'sender_username': self.user.username,
                'file_name': content.get('file_name'),
                'file_size': content.get('file_size'),
                'encrypted_key': content.get('encrypted_key'),
                'iv': content.get('iv'),
                'timestamp': content.get('timestamp'),
            },
        )
        await self.send_json({'type': 'file_metadata_sent'})

    async def _handle_key_exchange(self, content):
        recipient_id = content.get('recipient_id')
        if not recipient_id:
            await self.send_json({'type': 'error', 'message': 'recipient_id is required'})
            return

        await self.channel_layer.group_send(
            f'user_{recipient_id}',
            {
                'type': 'key_exchange.received',
                'sender_id': self.user.id,
                'sender_username': self.user.username,
                'public_key': content.get('public_key'),
                'encrypted_shared_secret': content.get('encrypted_shared_secret'),
            },
        )
        await self.send_json({'type': 'key_exchange_sent'})

    async def message_received(self, event):
        await self.send_json({'type': 'message_received', **event})

    async def file_received(self, event):
        await self.send_json({'type': 'file_received', **event})

    async def key_exchange_received(self, event):
        await self.send_json({'type': 'key_exchange_received', **event})
