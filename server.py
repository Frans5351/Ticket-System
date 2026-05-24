#!/usr/bin/env python3
"""
Park Manor - Local Development Server
Serves static files + handles attachments + proxies Supabase API (avoids CORS)
"""

import http.server
import os
import json
import base64
import urllib.parse
import urllib.request
from pathlib import Path

PORT = 8080
PUBLIC_DIR = Path(__file__).parent / 'public'
ATTACHMENTS_DIR = PUBLIC_DIR / 'park_manor_attachments'
ATTACHMENTS_DIR.mkdir(parents=True, exist_ok=True)

SUPA_URL = 'https://spagcmzhlngtqvrydzvi.supabase.co'
SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwYWdjbXpobG5ndHF2cnlkenZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTA1OTgsImV4cCI6MjA5NDA4NjU5OH0.TfRrz2iUPFm7AUL55BRNJtyhNl--s8yBbtejcD9yjPU'

http.server.BaseHTTPRequestHandler.timeout = 120

class ParkManorHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC_DIR), **kwargs)

    def log_message(self, format, *args):
        if args and (str(args[1]).startswith('4') or str(args[1]).startswith('5') or '/api/' in str(args[0])):
            super().log_message(format, *args)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS, PATCH')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, apikey, Authorization, Prefer')

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path.startswith('/supabase/'):
            self.proxy_supabase('GET')
        elif path == '/api/list-files':
            self.handle_list_files()
        elif path == '/api/ping':
            self.send_json({'ok': True})
        else:
            super().do_GET()

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if path.startswith('/supabase/'):
            self.proxy_supabase('POST')
        elif path == '/api/save-file':
            self.handle_save_file()
        elif path == '/api/delete-file':
            self.handle_delete_file()
        else:
            self.send_error(404)

    def do_DELETE(self):
        path = urllib.parse.urlparse(self.path).path
        if path.startswith('/supabase/'):
            self.proxy_supabase('DELETE')
        else:
            self.send_error(404)

    def proxy_supabase(self, method):
        """Proxy requests to Supabase to avoid CORS issues"""
        try:
            # Strip /supabase prefix and reconstruct URL
            rest = self.path[len('/supabase'):]
            target = SUPA_URL + rest

            headers = {
                'apikey': SUPA_KEY,
                'Authorization': 'Bearer ' + SUPA_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }

            # Copy Prefer header if present
            prefer = self.headers.get('Prefer')
            if prefer:
                headers['Prefer'] = prefer

            body = None
            if method in ('POST', 'PATCH'):
                length = int(self.headers.get('Content-Length', 0))
                if length:
                    body = self.rfile.read(length)

            req = urllib.request.Request(target, data=body, headers=headers, method=method)
            with urllib.request.urlopen(req) as resp:
                data = resp.read()
                self.send_response(resp.status)
                self.send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', len(data))
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            data = e.read()
            self.send_response(e.code)
            self.send_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', len(data))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_json({'error': str(e)}, 500)

    def handle_save_file(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_json({'error': 'No content'}, 400)
                return
            body = self.rfile.read(content_length)
            data = json.loads(body)
            filename = Path(data.get('filename', '')).name
            file_data = data.get('data', '')
            if not filename:
                self.send_json({'error': 'No filename'}, 400)
                return
            if ',' in file_data:
                file_data = file_data.split(',', 1)[1]
            file_bytes = base64.b64decode(file_data)
            filepath = ATTACHMENTS_DIR / filename
            with open(filepath, 'wb') as f:
                f.write(file_bytes)
            self.send_json({'success': True, 'filename': filename, 'url': f'/park_manor_attachments/{filename}', 'size': len(file_bytes)})
        except Exception as e:
            self.send_json({'error': str(e)}, 500)

    def handle_delete_file(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            data = json.loads(body)
            filename = Path(data.get('filename', '')).name
            filepath = ATTACHMENTS_DIR / filename
            if filepath.exists():
                filepath.unlink()
                self.send_json({'success': True})
            else:
                self.send_json({'error': 'File not found'}, 404)
        except Exception as e:
            self.send_json({'error': str(e)}, 500)

    def handle_list_files(self):
        try:
            files = [{'filename': f.name, 'url': f'/park_manor_attachments/{f.name}', 'size': f.stat().st_size}
                     for f in ATTACHMENTS_DIR.iterdir() if f.is_file() and not f.name.startswith('.')]
            self.send_json({'files': files})
        except Exception as e:
            self.send_json({'error': str(e)}, 500)

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    print('=' * 44)
    print('  Park Manor - Local Dev Server')
    print('=' * 44)
    print(f'  URL:      http://localhost:{PORT}')
    print(f'  Serving:  {PUBLIC_DIR}')
    print(f'  Supabase: proxied via /supabase/')
    print(f'  Press Ctrl+C to stop')
    print('=' * 44)
    server = http.server.HTTPServer(('', PORT), ParkManorHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n[OK] Server stopped')
