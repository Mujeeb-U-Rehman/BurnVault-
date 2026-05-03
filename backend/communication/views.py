from __future__ import annotations

import binascii

from django.contrib.auth.models import User
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Contact, FileTransfer, Message, UserProfile
from .serializers import (
    BurnVaultTokenObtainPairSerializer,
    ContactSerializer,
    FileTransferSerializer,
    MeKeysSerializer,
    MessageSerializer,
    ProfileSerializer,
    RegisterSerializer,
    UserSerializer,
)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({'message': 'User registered successfully', 'user_id': user.id}, status=status.HTTP_201_CREATED)


class BurnVaultTokenObtainPairView(TokenObtainPairView):
    serializer_class = BurnVaultTokenObtainPairSerializer


class MeProfileView(generics.RetrieveAPIView):
    serializer_class = ProfileSerializer

    def get_object(self):
        profile, _ = UserProfile.objects.get_or_create(user=self.request.user, defaults={'public_key': ''})
        return profile


class MePublicKeyUpdateView(APIView):
    def put(self, request):
        public_key = request.data.get('public_key')
        if public_key is None or not isinstance(public_key, str) or not public_key.strip():
            return Response({'detail': 'public_key is required'}, status=status.HTTP_400_BAD_REQUEST)

        profile, _ = UserProfile.objects.get_or_create(user=request.user, defaults={'public_key': ''})
        profile.public_key = public_key
        profile.save(update_fields=['public_key'])
        return Response(ProfileSerializer(profile).data)

    patch = put


class MeKeysView(APIView):
    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user, defaults={'public_key': ''})
        return Response(
            {
                'public_key': profile.public_key,
                'encrypted_private_key': profile.encrypted_private_key,
            }
        )

    def put(self, request):
        serializer = MeKeysSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        profile, _ = UserProfile.objects.get_or_create(user=request.user, defaults={'public_key': ''})
        data = serializer.validated_data

        update_fields = []
        if 'public_key' in data:
            profile.public_key = data.get('public_key', '')
            update_fields.append('public_key')
        if 'encrypted_private_key' in data:
            profile.encrypted_private_key = data.get('encrypted_private_key', '')
            update_fields.append('encrypted_private_key')

        if update_fields:
            profile.save(update_fields=update_fields)

        return Response(
            {
                'public_key': profile.public_key,
                'encrypted_private_key': profile.encrypted_private_key,
            }
        )

    patch = put


class UserProfileDetailView(generics.RetrieveAPIView):
    serializer_class = ProfileSerializer
    queryset = UserProfile.objects.select_related('user')

    def get_object(self):
        user_id = self.kwargs['user_id']
        profile, _ = UserProfile.objects.get_or_create(user_id=user_id, defaults={'public_key': ''})
        return profile


class UserSearchView(generics.ListAPIView):
    serializer_class = UserSerializer

    def get_queryset(self):
        q = (self.request.query_params.get('q') or '').strip()
        qs = User.objects.all().order_by('username')
        if not q:
            return qs.none()
        return qs.filter(Q(username__icontains=q) | Q(email__icontains=q))[:25]


class MessageListCreateView(generics.ListCreateAPIView):
    serializer_class = MessageSerializer

    def get_queryset(self):
        now = timezone.now()
        return (
            Message.objects.select_related('sender', 'recipient')
            .filter(recipient=self.request.user, expires_at__gt=now)
            .order_by('-created_at')
        )

    def perform_create(self, serializer):
        serializer.save()


class MessageMarkAsReadView(APIView):
    def post(self, request, message_id):
        try:
            msg = Message.objects.get(id=message_id, recipient=request.user)
        except Message.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        msg.delete()
        return Response({'message': 'Message read and deleted'})


class FileListCreateView(generics.ListCreateAPIView):
    serializer_class = FileTransferSerializer

    def get_queryset(self):
        now = timezone.now()
        return (
            FileTransfer.objects.select_related('sender', 'recipient')
            .filter(recipient=self.request.user, expires_at__gt=now)
            .order_by('-created_at')
        )


class FileDownloadView(APIView):
    def get(self, request, file_id):
        try:
            ft = FileTransfer.objects.select_related('sender', 'recipient').get(id=file_id, recipient=request.user)
        except FileTransfer.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        if not ft.file:
            return Response({'detail': 'File missing'}, status=status.HTTP_410_GONE)

        with ft.file.open('rb') as f:
            raw = f.read()

        encrypted_hex = binascii.hexlify(raw).decode('ascii')
        payload = {
            'id': str(ft.id),
            'file_name': ft.file_name,
            'encrypted_file': encrypted_hex,
            'encrypted_key': ft.encrypted_key,
            'iv': ft.iv,
        }

        storage = ft.file.storage
        file_name = ft.file.name
        ft.delete()
        if file_name:
            try:
                storage.delete(file_name)
            except Exception:
                pass

        return Response(payload)


class ContactListCreateView(generics.ListCreateAPIView):
    serializer_class = ContactSerializer

    def get_queryset(self):
        return Contact.objects.select_related('contact_user').filter(user=self.request.user).order_by('-created_at')


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def health(request):
    return Response({'status': 'ok'})
