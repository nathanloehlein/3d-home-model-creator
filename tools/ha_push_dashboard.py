"""Push ha/dashboard.yaml into Home Assistant as a storage-mode dashboard (no restart needed).

Creates the dashboard on first run, then just saves its config, so it is safe to re-run after every edit.
The model it loads is uploaded separately: copy ha/house.glb to /config/www/<folder>/house.glb on the box
(<folder> matches `path:` in the card config).

Usage:
    pip install websockets pyyaml
    python tools/ha_push_dashboard.py --env .env --url-path property-3d --title "Property 3D"

--env points at a file with HA_URL and HA_TOKEN lines (a long-lived access token). Never commit that file.
"""
import argparse
import asyncio
import json
from pathlib import Path

import websockets
import yaml

ROOT = Path(__file__).resolve().parent.parent


async def call(ws, msg_id, payload):
    await ws.send(json.dumps({'id': msg_id, **payload}))
    while True:
        msg = json.loads(await ws.recv())
        if msg.get('id') == msg_id and msg['type'] == 'result':
            return msg


async def main(args):
    env = dict(line.split('=', 1) for line in Path(args.env).read_text(encoding='utf-8').splitlines()
               if '=' in line and not line.startswith('#'))
    ws_url = env['HA_URL'].strip().rstrip('/').replace('https://', 'wss://').replace('http://', 'ws://') + '/api/websocket'
    config = yaml.safe_load((ROOT / args.yaml).read_text(encoding='utf-8'))
    async with websockets.connect(ws_url, max_size=None) as ws:
        await ws.recv()
        await ws.send(json.dumps({'type': 'auth', 'access_token': env['HA_TOKEN'].strip()}))
        if json.loads(await ws.recv())['type'] != 'auth_ok':
            raise SystemExit('auth failed')
        listing = await call(ws, 1, {'type': 'lovelace/dashboards/list'})
        if not any(d['url_path'] == args.url_path for d in listing['result']):
            created = await call(ws, 2, {
                'type': 'lovelace/dashboards/create', 'url_path': args.url_path, 'mode': 'storage',
                'title': args.title, 'icon': 'mdi:home-floor-3', 'show_in_sidebar': True, 'require_admin': False,
            })
            print('create:', 'ok' if created['success'] else created.get('error'))
        saved = await call(ws, 3, {'type': 'lovelace/config/save', 'url_path': args.url_path, 'config': config})
        print('save:', 'ok' if saved['success'] else saved.get('error'))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--env', required=True, help='file with HA_URL and HA_TOKEN')
    ap.add_argument('--yaml', default='ha/dashboard.yaml')
    ap.add_argument('--url-path', required=True, help='dashboard URL path; must contain a hyphen')
    ap.add_argument('--title', default='Property 3D')
    asyncio.run(main(ap.parse_args()))
