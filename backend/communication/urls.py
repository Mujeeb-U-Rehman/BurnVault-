from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    BurnVaultTokenObtainPairView,
    ContactListCreateView,
    FileDownloadView,
    FileListCreateView,
    MePublicKeyUpdateView,
    MeKeysView,
    MeProfileView,
    MessageListCreateView,
    MessageMarkAsReadView,
    RegisterView,
    UserProfileDetailView,
    UserSearchView,
    health,
)


urlpatterns = [
    path('health/', health),
    path('register/', RegisterView.as_view()),
    path('token/', BurnVaultTokenObtainPairView.as_view()),
    path('token/refresh/', TokenRefreshView.as_view()),
    path('profile/me/', MeProfileView.as_view()),
    path('profile/me/public_key/', MePublicKeyUpdateView.as_view()),
    path('profile/me/keys/', MeKeysView.as_view()),
    path('profile/search/', UserSearchView.as_view()),
    path('profile/<int:user_id>/', UserProfileDetailView.as_view()),
    path('messages/', MessageListCreateView.as_view()),
    path('messages/<uuid:message_id>/mark_as_read/', MessageMarkAsReadView.as_view()),
    path('files/', FileListCreateView.as_view()),
    path('files/<uuid:file_id>/download/', FileDownloadView.as_view()),
    path('contacts/', ContactListCreateView.as_view()),
]
