from http.server import BaseHTTPRequestHandler

from _common import check_auth, json_response, read_json_body, train_model


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if not check_auth(self.headers):
            return json_response(self, 401, {'error': 'Unauthorized'})

        try:
            data = read_json_body(self)
        except ValueError:
            return json_response(self, 400, {'error': 'Invalid JSON body'})

        lines = []
        try:
            result = train_model(
                data['model_id'],
                data.get('model_type', 'ridge'),
                data.get('hyperparams') or {},
                data['training'],
                lines,
                auto_tune=bool(data.get('auto_tune', False)),
            )
        except Exception as exc:
            return json_response(self, 422, {'lines': lines, 'error': str(exc)})

        json_response(self, 200, {'lines': lines, 'result': result})
