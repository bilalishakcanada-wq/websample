# Connection to a LOCAL Postgres with the Zadatak schema. These scripts insert test jobs and people,
# so they refuse to run against the real Supabase project.
import os, sys

def _conn():
    host = os.environ.get('PGHOST', '127.0.0.1')
    if 'supabase' in host or 'supabase' in os.environ.get('DATABASE_URL', ''):
        sys.exit('Ovi testovi upisuju testne podatke: pokreni ih samo na lokalnoj bazi, nikad na produkciji.')
    return host, os.environ.get('PGPORT', '54399'), os.environ.get('PGUSER', 'postgres'), os.environ.get('PGDATABASE', 'postgres')

def psql_args():
    host, port, user, db = _conn()
    return ['psql', '-h', host, '-p', port, '-U', user, '-d', db]

def psql_env():
    return {'PGPASSWORD': os.environ.get('PGPASSWORD', 'postgres'), 'PATH': os.environ.get('PATH', '/usr/bin')}
