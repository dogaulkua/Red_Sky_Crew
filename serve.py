# Local test server that never lets the browser cache files: python3 serve.py  ->  http://localhost:8070
import http.server, socketserver, sys
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8070
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PORT), H) as s:
    print(f'Mars Colony running at http://localhost:{PORT}  (Ctrl+C to stop)')
    s.serve_forever()
