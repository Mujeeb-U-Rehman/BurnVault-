from __future__ import annotations

import uuid

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    public_key = models.TextField()
    encrypted_private_key = models.TextField(blank=True, default='')
    totp_secret = models.CharField(max_length=32, blank=True, default='')
    is_2fa_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f'Profile({self.user.username})'


class Message(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages')
    encrypted_content = models.TextField()
    encrypted_key = models.TextField()
    iv = models.CharField(max_length=64)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    def __str__(self) -> str:
        return f'Message({self.id})'


class FileTransfer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_files')
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_files')
    file_name = models.CharField(max_length=255)
    file = models.FileField(upload_to='encrypted_files/')
    file_size = models.PositiveIntegerField(default=0)
    encrypted_key = models.TextField()
    iv = models.CharField(max_length=64)
    is_downloaded = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    def __str__(self) -> str:
        return f'FileTransfer({self.id})'


class Contact(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='contacts')
    contact_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='contact_of')
    encrypted_shared_secret = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'contact_user')

    def __str__(self) -> str:
        return f'Contact({self.user.username}->{self.contact_user.username})'
