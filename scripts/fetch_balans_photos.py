"""Downloads candidate photos for the balance card from Openverse and Wikimedia Commons.

Only licenses that allow commercial use (CC0, public domain, CC BY). Runs in CI, see .github/workflows/balans-foto.yml.
"""
import io
import json
import pathlib
import time
import urllib.parse

import requests
from PIL import Image

OUT = pathlib.Path('public/images/balans/kandidati')
UA = {'User-Agent': 'ZadatakPhotos/1.0 (https://bilalishakcanada-wq.github.io/websample/; ishajbilal@gmail.com)'}
TOPICS = {
    'electrician': ['electrician working', 'electrician wiring'],
    'plumber': ['plumber', 'plumbing repair'],
    'handyman': ['handyman tools', 'handyman repair'],
    'painter': ['painter painting wall', 'house painter'],
    'cleaning': ['cleaning service home', 'cleaning lady'],
    'carpenter': ['carpenter woodwork', 'carpenter workshop'],
    'moving': ['moving boxes movers', 'movers truck'],
    'handshake': ['worker handshake customer', 'handshake business'],
    'construction': ['construction worker helmet', 'construction worker'],
    'gardener': ['gardener garden work', 'gardener'],
    'tiler': ['tiler tiles', 'tiling floor'],
    'mechanic': ['mechanic repair car'],
}
PER_TOPIC = 5
MIN_W = 1600
OK_LICENSES = {'cc0', 'pdm', 'by'}


def openverse(query):
    url = 'https://api.openverse.org/v1/images/?' + urllib.parse.urlencode({
        'q': query, 'license': 'cc0,pdm,by', 'aspect_ratio': 'wide', 'size': 'large',
        'page_size': 20, 'mature': 'false', 'category': 'photograph',
    })
    r = requests.get(url, headers=UA, timeout=30)
    r.raise_for_status()
    for item in r.json().get('results', []):
        if (item.get('width') or 0) < MIN_W or item.get('license') not in OK_LICENSES:
            continue
        yield {
            'url': item['url'], 'source': f"openverse/{item.get('source')}", 'page': item.get('foreign_landing_url'),
            'author': item.get('creator'), 'license': f"{item['license']} {item.get('license_version') or ''}".strip(),
            'license_url': item.get('license_url'), 'title': item.get('title'), 'width': item.get('width'),
        }


def commons(query):
    url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({
        'action': 'query', 'generator': 'search', 'gsrnamespace': 6, 'gsrsearch': f'{query} filetype:bitmap',
        'gsrlimit': 30, 'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata', 'iiurlwidth': 1800, 'format': 'json',
    })
    r = requests.get(url, headers=UA, timeout=30)
    r.raise_for_status()
    pages = sorted(r.json().get('query', {}).get('pages', {}).values(), key=lambda p: p.get('index', 0))
    for page in pages:
        info = (page.get('imageinfo') or [{}])[0]
        meta = info.get('extmetadata', {})
        lic = (meta.get('LicenseShortName', {}).get('value') or '').strip()
        low = lic.lower()
        free = low in ('cc0', 'public domain') or (low.startswith('cc by ') and '-sa' not in low and '-nc' not in low and '-nd' not in low)
        if not free or (info.get('width') or 0) < MIN_W or info.get('width', 0) <= info.get('height', 0):
            continue
        yield {
            'url': info.get('thumburl') or info['url'], 'source': 'wikimedia', 'page': info.get('descriptionurl'),
            'author': meta.get('Artist', {}).get('value'), 'license': lic,
            'license_url': meta.get('LicenseUrl', {}).get('value'), 'title': page.get('title'), 'width': info.get('width'),
        }


def save(item, path):
    r = requests.get(item['url'], headers=UA, timeout=60)
    r.raise_for_status()
    img = Image.open(io.BytesIO(r.content)).convert('RGB')
    if img.width < MIN_W:
        return False
    if img.width > 1800:
        img = img.resize((1800, round(img.height * 1800 / img.width)), Image.LANCZOS)
    img.save(path, 'JPEG', quality=85, optimize=True)
    return True


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    credits, seen = [], set()
    for topic, queries in TOPICS.items():
        found = []
        for query in queries:
            for finder in (openverse, commons):
                try:
                    for item in finder(query):
                        if item['url'] not in seen:
                            seen.add(item['url'])
                            found.append(item)
                except Exception as error:  # noqa: BLE001
                    print('search failed', finder.__name__, query, error)
        n = 0
        for item in found:
            if n >= PER_TOPIC:
                break
            path = OUT / f'{topic}-{n + 1}.jpg'
            try:
                if save(item, path):
                    n += 1
                    credits.append({'file': path.name, **{k: v for k, v in item.items() if k != 'width'}})
                    print('ok', path.name, item['source'], item['license'], item['title'])
            except Exception as error:  # noqa: BLE001
                print('download failed', item['url'], error)
            time.sleep(0.5)
        print(topic, n, 'of', len(found), 'candidates')
    (OUT / 'credits.json').write_text(json.dumps(credits, indent=2, ensure_ascii=False))
    print('total', len(credits))


if __name__ == '__main__':
    main()
