from django.urls import path

from .consumers import MessagesConsumer


websocket_urlpatterns = [
    path('ws/messages/', MessagesConsumer.as_asgi()),
]
