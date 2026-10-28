"""Preview only: serve the standalone Maple site, never the parent Yere tree."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
ROOT = Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'")
        super().end_headers()
if __name__ == '__main__':
    port = int(os.environ.get('PORT', '4190'))
    print(f'Maple Dominion preview listening on 0.0.0.0:{port}', flush=True)
    ThreadingHTTPServer(('0.0.0.0', port), partial(Handler, directory=str(ROOT))).serve_forever()
