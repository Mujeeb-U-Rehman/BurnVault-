from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Contact, FileTransfer, Message, UserProfile
import pyotp

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    public_key = serializers.CharField()
    encrypted_private_key = serializers.CharField(required=False, allow_blank=True)

    def validate_username(self, value: str) -> str:
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Username already exists')
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
        )
        UserProfile.objects.create(
            user=user,
            public_key=validated_data['public_key'],
            encrypted_private_key=validated_data.get('encrypted_private_key', ''),
        )
        return user


class ProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = UserProfile
        fields = ['user', 'public_key', 'encrypted_private_key', 'created_at', 'updated_at']


class MeKeysSerializer(serializers.Serializer):
    public_key = serializers.CharField(required=False, allow_blank=True)
    encrypted_private_key = serializers.CharField(required=False, allow_blank=True)


class MessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    recipient_username = serializers.CharField(source='recipient.username', read_only=True)

    class Meta:
        model = Message
        fields = [
            'id',
            'sender',
            'sender_username',
            'recipient',
            'recipient_username',
            'encrypted_content',
            'encrypted_key',
            'iv',
            'is_read',
            'created_at',
            'expires_at',
        ]
        read_only_fields = ['id', 'sender', 'is_read', 'created_at', 'expires_at']

    def create(self, validated_data):
        request = self.context['request']
        expires_at = timezone.now() + timedelta(seconds=settings.MESSAGE_EXPIRY_TIME)
        return Message.objects.create(sender=request.user, expires_at=expires_at, **validated_data)


class FileTransferSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    recipient_username = serializers.CharField(source='recipient.username', read_only=True)

    class Meta:
        model = FileTransfer
        fields = [
            'id',
            'sender',
            'sender_username',
            'recipient',
            'recipient_username',
            'file_name',
            'file_size',
            'encrypted_key',
            'iv',
            'is_downloaded',
            'created_at',
            'expires_at',
            'file',
        ]
        read_only_fields = ['id', 'sender', 'file_size', 'is_downloaded', 'created_at', 'expires_at']
        extra_kwargs = {'file': {'write_only': True}}

    def create(self, validated_data):
        request = self.context['request']
        expires_at = timezone.now() + timedelta(seconds=settings.FILE_EXPIRY_TIME)
        instance = FileTransfer.objects.create(
            sender=request.user,
            expires_at=expires_at,
            **validated_data,
        )
        instance.file_size = instance.file.size if instance.file else 0
        instance.save(update_fields=['file_size'])
        return instance


class ContactSerializer(serializers.ModelSerializer):
    contact_user_username = serializers.CharField(source='contact_user.username', read_only=True)

    class Meta:
        model = Contact
        fields = ['id', 'user', 'contact_user', 'contact_user_username', 'encrypted_shared_secret', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']

    def create(self, validated_data):
        request = self.context['request']
        return Contact.objects.create(user=request.user, **validated_data)


class BurnVaultTokenObtainPairSerializer(TokenObtainPairSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['totp_code'] = serializers.CharField(required=False, allow_blank=True)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        
        try:
            profile = user.profile
        except UserProfile.DoesNotExist:
            profile = None

        if profile and profile.is_2fa_enabled:
            totp_code = attrs.get('totp_code')
            if not totp_code:
                raise serializers.ValidationError({"totp_code": "2FA code is required."})
            
            totp = pyotp.TOTP(profile.totp_secret)
            if not totp.verify(totp_code):
                raise serializers.ValidationError({"totp_code": "Invalid 2FA code."})

        data['user_id'] = user.id
        data['username'] = user.username
        return data
