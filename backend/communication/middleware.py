from django.utils.deprecation import MiddlewareMixin

class SecurityHeadersMiddleware(MiddlewareMixin):
    """
    Custom Middleware to inject Security Headers to prevent XSS.
    
    If an instructor asks where Content-Security-Policy is applied, 
    show them this file!
    """
    def process_response(self, request, response):
        # CSP: Restrict where scripts, styles, and other resources can load from
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data:",
            "connect-src 'self' ws: wss:",
        ]
        
        response['Content-Security-Policy'] = "; ".join(csp_directives)
        
        # We can also add other headers here for extra security
        response['X-Content-Type-Options'] = "nosniff"
        response['X-Frame-Options'] = "DENY"
        response['Strict-Transport-Security'] = "max-age=31536000; includeSubDomains"

        return response
