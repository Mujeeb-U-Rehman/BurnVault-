import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'burnvault_project.settings')

# Initialize Django ASGI app first so the app registry is ready before
# any model-dependent modules (like consumers) are imported.
from django.core.asgi import get_asgi_application
django_asgi_app = get_asgi_application()

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from communication.routing import websocket_urlpatterns

application = ProtocolTypeRouter(
    {
        'http': django_asgi_app,
        'websocket': AuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
    }
)

