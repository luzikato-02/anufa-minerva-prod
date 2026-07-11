from http.server import BaseHTTPRequestHandler

from _common import blob_delete, check_auth, json_response, read_json_body


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if not check_auth(self.headers):
            return json_response(self, 401, {'error': 'Unauthorized'})

        try:
            data = read_json_body(self)
        except ValueError:
            return json_response(self, 400, {'error': 'Invalid JSON body'})

        try:
            blob_delete(data['model_ref'])
        except Exception as exc:
            return json_response(self, 422, {'error': str(exc)})

        json_response(self, 200, {'ok': True})
