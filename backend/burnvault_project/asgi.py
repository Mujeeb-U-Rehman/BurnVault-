"""ASGI config for burnvault_project."""
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'burnvault_project.settings')

# Initialize Django ASGI app first so the app registry is ready before
# any model-dependent modules (like consumers) are imported.
from django.core.asgi import get_asgi_application # pylint: disable=wrong-import-position
django_asgi_app = get_asgi_application()

from channels.auth import AuthMiddlewareStack # pylint: disable=wrong-import-position
from channels.routing import ProtocolTypeRouter, URLRouter # pylint: disable=wrong-import-position
from communication.routing import websocket_urlpatterns # pylint: disable=wrong-import-position, import-error

application = ProtocolTypeRouter(
    {
        'http': django_asgi_app,
        'websocket': AuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
    }
)
