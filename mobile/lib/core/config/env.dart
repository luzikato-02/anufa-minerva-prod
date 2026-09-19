/// Build with `--dart-define=API_BASE_URL=https://minerva.anufa.my.id` for production.
const String kApiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'https://minerva-dev.anufa.my.id');
