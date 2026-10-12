# Runs realistic Bosnian queries through the live search_listings and scores them.
import json, subprocess, sys, os
FN = os.environ.get("FN", "search_listings"); OUT = os.environ.get("OUT", "search_results.json")
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out') + '/'
os.makedirs(D, exist_ok=True)
from local_db import psql_args, psql_env
ids = json.load(open(D + 'ids.json'))['listings']

def sql(s):
    r = subprocess.run(psql_args() + ['-AtF', '\t', '-c', s],
                       capture_output=True, text=True, env=psql_env())
    if r.returncode: raise SystemExit(r.stderr)
    return [l.split('\t') for l in r.stdout.strip().split('\n') if l]

def q(s): return "'" + s.replace("'", "''") + "'"

# (group, query, relevant tags, extra args)
TESTS = [
 ('tačna riječ', 'krečenje', ['krecenje1', 'krecenje3']),
 ('tačna riječ', 'selidba', ['selidba1', 'selidba2']),
 ('tačna riječ', 'bojler', ['vodo2']),
 ('bez kvačica', 'krecenje', ['krecenje1', 'krecenje3']),
 ('bez kvačica', 'ciscenje stana', ['ciscenje1']),
 ('bez kvačica', 'sisanje psa', ['ljub3']),
 ('padeži', 'selidbu', ['selidba1', 'selidba2']),
 ('padeži', 'kuhinju', ['krecenje3', 'namjestaj2', 'reno3']),
 ('padeži', 'klimu', ['klima1', 'klima2', 'klima3']),
 ('padeži', 'bojlera', ['vodo2']),
 ('padeži', 'ormar', ['namjestaj1', 'stolar1']),
 ('padeži', 'psa', ['ljub1', 'ljub3']),
 ('greške u kucanju', 'vodoinstalter', ['vodo1', 'vodo2', 'vodo3']),
 ('greške u kucanju', 'elektricar', ['struja1', 'struja2', 'struja4']),
 ('greške u kucanju', 'selibda', ['selidba1']),
 ('greške u kucanju', 'kuhnja', ['krecenje3', 'namjestaj2', 'reno3']),
 ('sinonimi', 'farbanje stana', ['krecenje1', 'krecenje2']),
 ('sinonimi', 'moler', ['krecenje1', 'krecenje2', 'krecenje3', 'krecenje4']),
 ('sinonimi', 'preseljenje', ['selidba1', 'selidba2', 'selidba3']),
 ('sinonimi', 'kombi prevoz', ['selidba1', 'selidba3']),
 ('sinonimi', 'čistačica', ['ciscenje1', 'ciscenje2']),
 ('sinonimi', 'spremačica', ['ciscenje1', 'ciscenje2']),
 ('sinonimi', 'dadilja', ['djeca1', 'djeca2']),
 ('sinonimi', 'frizer', ['ljepota1', 'ljepota2']),
 ('sinonimi', 'automehaničar', ['auto1', 'auto2', 'auto3']),
 ('sinonimi', 'servis auta', ['auto1', 'auto2', 'auto3']),
 ('sinonimi', 'majstor za struju', ['struja1', 'struja2', 'struja3', 'struja4']),
 ('sinonimi', 'popravka kompjutera', ['it1', 'it2']),
 ('sinonimi', 'kupatilo pločice', ['reno2', 'vodo3']),
 ('opis problema', 'curi voda', ['vodo1', 'vodo5', 'klima3']),
 ('opis problema', 'ne grije bojler', ['vodo2']),
 ('opis problema', 'izbacuje osigurač', ['struja3', 'struja1']),
 ('opis problema', 'auto ne pali', ['auto2']),
 ('prirodna rečenica', 'trebam nekoga da mi okreči stan', ['krecenje1', 'krecenje2']),
 ('prirodna rečenica', 'treba mi majstor da popravi slavinu', ['vodo1']),
 ('prirodna rečenica', 'tražim osobu za čišćenje', ['ciscenje1', 'ciscenje2']),
 ('prirodna rečenica', 'ko može prevesti frižider', ['selidba3']),
 ('grad u upitu', 'moler Tuzla', ['krecenje2']),
 ('grad u upitu', 'vodoinstalater Sarajevo', ['vodo1', 'vodo5']),
 ('grad u upitu', 'čišćenje Banja Luka', ['ciscenje2']),
 ('ekavica/ijekavica', 'prevod sa nemačkog', ['remote_ekav', 'jezik2']),
 ('ekavica/ijekavica', 'njemački', ['jezik2', 'remote_ekav']),
 ('ekavica/ijekavica', 'deca', ['djeca1', 'djeca2', 'event1']),
 ('ekavica/ijekavica', 'popravka laptopa', ['it1']),
 ('kategorija', 'Vodoinstalater', ['vodo1', 'vodo2', 'vodo3']),
 ('kategorija', 'IT podrška', ['it1', 'it2', 'it3']),
]

# Held-out: written after the synonyms were done and never used to tune them (SET=heldout).
HELDOUT = [
 ('nove', 'treba mi neko da sastavi ormar', ['namjestaj1']),
 ('nove', 'ne radi bojler', ['vodo2']),
 ('nove', 'pločice u kupatilu', ['reno2']),
 ('nove', 'kosilica trava dvorište', ['basta1']),
 ('nove', 'čuvanje psa', ['ljub1', 'ljub3']),
 ('nove', 'pomoć sa matematikom', ['instr1']),
 ('nove', 'wifi ne radi na spratu', ['it3']),
 ('nove', 'slikanje vjenčanja', ['foto1']),
 ('nove', 'promjena guma', ['auto1']),
 ('nove', 'akumulator prazan', ['auto2']),
 ('nove', 'knjigovodstvene usluge', ['knjig1']),
 ('nove', 'luster montaža', ['struja4']),
 ('nove', 'farbanje kose', ['ljepota2']),
 ('nove', 'tepih pranje', ['ciscenje4']),
 ('nove', 'logo za firmu', ['dizajn1']),
 ('nove', 'treba mi advokat', ['pravo1']),
]
if os.environ.get('SET') == 'heldout':
    TESTS = HELDOUT

rows_out = []
groups = {}
for grp, query, rel in TESTS:
    rows = sql(f"select id, title, round(score,2) from {FN}(p_query => {q(query)}, p_limit => 10)")
    got = [ids.get(r[0], '?') for r in rows]
    hits = [g for g in got[:5] if g in rel]
    recall5 = len(set(hits)) / len(rel)
    first = next((i + 1 for i, g in enumerate(got) if g in rel), None)
    rr = 1 / first if first else 0
    groups.setdefault(grp, []).append((recall5, rr, len(got)))
    rows_out.append({'group': grp, 'query': query, 'relevant': rel, 'top': [(ids.get(r[0], '?'), r[1], r[2]) for r in rows[:5]],
                     'n': len(rows), 'recall5': round(recall5, 2), 'rr': round(rr, 2)})

json.dump(rows_out, open(D + OUT, 'w'), ensure_ascii=False, indent=1)
tot_r = sum(r['recall5'] for r in rows_out) / len(rows_out)
tot_mrr = sum(r['rr'] for r in rows_out) / len(rows_out)
zero = sum(1 for r in rows_out if r['n'] == 0)
for g, v in groups.items():
    print(f"{g:22s} n={len(v):2d} recall@5={sum(x[0] for x in v)/len(v):.2f} MRR={sum(x[1] for x in v)/len(v):.2f} zero={sum(1 for x in v if x[2]==0)}")
print(f"UKUPNO n={len(rows_out)} recall@5={tot_r:.2f} MRR={tot_mrr:.2f} bez_rezultata={zero}")
for r in rows_out:
    flag = 'OK ' if r['rr'] == 1 and r['recall5'] >= 0.99 else ('-- ' if r['n'] == 0 else '~  ')
    print(flag, r['query'], '->', r['n'], [t[0] for t in r['top']], 'rel=', r['relevant'])
