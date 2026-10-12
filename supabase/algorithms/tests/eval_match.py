import os
# Provider matching (match_providers_for_listing) and job recommendations (recommended_listings).
import json, subprocess
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out') + '/'
os.makedirs(D, exist_ok=True)
from local_db import psql_args, psql_env
I = json.load(open(D + 'ids.json'))
Lr = I['listings']; Pr = I['providers']
L = {v: k for k, v in Lr.items()}; P = {v: k for k, v in Pr.items()}

def sql(s):
    r = subprocess.run(psql_args() + ['-AtF', '\t', '-c', s],
                       capture_output=True, text=True, env=psql_env())
    if r.returncode: raise SystemExit(r.stderr)
    return [l.split('\t') for l in r.stdout.strip().split('\n') if l]

out = {'match': [], 'recommend': []}
MATCH = [
 ('struja4', 'Električar u Mostaru', ['p_struja_mo', 'p_struja_sa', 'p_struja_bl']),
 ('struja2', 'Električar u Banja Luci', ['p_struja_bl']),
 ('klima3', 'Klima curi, objavljeno kao "Majstor za sve", Zenica', ['p_vodo_ze', 'p_klima_sa', 'p_majstor_sa']),
 ('vodo5', 'Pukla cijev, "Majstor za sve", Sarajevo', ['p_vodo_sa', 'p_majstor_sa']),
 ('krecenje4', 'Moler za hodnik, kategorija Renoviranje, Mostar', ['p_moler_new_mo', 'p_moler_sa', 'p_moler_tz']),
 ('vodo3', 'WC šolja, Mostar', ['p_vodo_mo', 'p_vodo_sa', 'p_vodo_ze']),
 ('ljub3', 'Šišanje psa, Tuzla', ['p_ljub_sa']),
]
print('== match_providers_for_listing (top 5)')
for tag, label, good in MATCH:
    rows = sql(f"select user_id, display_name, city, match_score, array_to_string(reasons, ' | ') from match_providers_for_listing('{L[tag]}', 5)")
    top = [(Pr[r[0]], r[1], r[2], r[3]) for r in rows]
    ok = top[0][0] in good
    print(('OK ' if ok else 'XX '), label)
    for t in top: print('     ', t, '*' if t[0] in good else '')
    out['match'].append({'listing': tag, 'label': label, 'good': good, 'top': top, 'top1_ok': ok})

REC = [
 ('p_vodo_sa', 'Vodoinstalater iz Sarajeva', ['vodo1', 'vodo5', 'vodo4']),
 ('p_struja_bl', 'Električar iz "Banjaluka"', ['struja2']),
 ('p_vodo_ze', 'Vodoinstalater + klime iz Zenice', ['vodo2', 'klima3']),
 ('p_moler_new_mo', 'Novi moler iz Mostara', ['krecenje4']),
 ('p_majstor_sa', 'Majstor za sve iz Sarajeva', ['kombo1', 'vodo5', 'vodo1', 'struja3']),
]
print('== recommended_listings (top 5)')
for tag, label, good in REC:
    rows = sql(f"select set_config('request.jwt.claim.sub', '{P[tag]}', false), set_config('request.jwt.claims', json_build_object('sub', '{P[tag]}')::text, false); "
               f"select id, title, location, match_score, array_to_string(reasons, ' | ') from recommended_listings(5)")
    rows = [r for r in rows if len(r) == 5]
    top = [(Lr.get(r[0], '?'), r[1], r[2], r[3], r[4]) for r in rows]
    ok = bool(top) and top[0][0] in good
    print(('OK ' if ok else 'XX '), label)
    for t in top: print('     ', t[:4], '*' if t[0] in good else '')
    out['recommend'].append({'provider': tag, 'label': label, 'good': good, 'top': top, 'top1_ok': ok})
json.dump(out, open(D + 'match_results.json', 'w'), ensure_ascii=False, indent=1)
