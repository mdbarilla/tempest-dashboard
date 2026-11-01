#!/usr/bin/env python3
"""Capture the dashboard's /eink page with headless Chromium and show it on the Inky Impression.

Drives Chromium over the DevTools protocol so the capture waits for the page to report
that its data has loaded (body[data-eink-ready="1"]) instead of guessing a delay.

A refresh takes ~30s of flashing on the Spectra 6 panel, so the panel is only redrawn
when the visible content changes (ignoring the "Updated" timestamp) or when the shown
image is older than --max-age minutes. If the page renders its error state, the last
good image stays on screen until it is older than --stale-after minutes.

Usage: inky_push.py [--url URL] [--force] [--dry-run] [--max-age 30] [--stale-after 60]
"""
import argparse
import base64
import hashlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

import websocket
from PIL import Image, ImageDraw

WIDTH, HEIGHT = 800, 480
STATE_DIR = os.path.expanduser("~/.local/state/eink")
STATE_FILE = os.path.join(STATE_DIR, "state.json")
LAST_IMAGE = os.path.join(STATE_DIR, "last.png")
LAST_CAPTURE = os.path.join(STATE_DIR, "capture.png")

PAGE_STATE_JS = """
(() => {
  const updated = document.querySelector('.eink-updated');
  const r = updated ? updated.getBoundingClientRect() : null;
  return JSON.stringify({
    ready: document.body.dataset.einkReady === '1',
    error: !!document.querySelector('.eink--error'),
    updatedRect: r ? [r.left, r.top, r.right, r.bottom] : null,
  });
})()
"""


def log(msg):
    print(msg, flush=True)


class DevTools:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=30, suppress_origin=True)
        self.next_id = 0

    def call(self, method, **params):
        self.next_id += 1
        msg_id = self.next_id
        self.ws.send(json.dumps({"id": msg_id, "method": method, "params": params}))
        while True:
            reply = json.loads(self.ws.recv())
            if reply.get("id") == msg_id:
                if "error" in reply:
                    raise RuntimeError(f"{method}: {reply['error']}")
                return reply["result"]

    def evaluate(self, expression, await_promise=False):
        result = self.call("Runtime.evaluate", expression=expression,
                           returnByValue=True, awaitPromise=await_promise)
        return result["result"].get("value")

    def close(self):
        self.ws.close()


def launch_chromium(profile_dir):
    proc = subprocess.Popen(
        ["chromium", "--headless=new", "--disable-gpu", "--hide-scrollbars",
         "--force-device-scale-factor=1", f"--window-size={WIDTH},{HEIGHT}",
         "--no-first-run", "--remote-debugging-port=0", f"--user-data-dir={profile_dir}",
         "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    port_file = os.path.join(profile_dir, "DevToolsActivePort")
    deadline = time.time() + 30
    while time.time() < deadline:
        if os.path.exists(port_file):
            with open(port_file) as f:
                port = f.readline().strip()
            if port:
                break
        if proc.poll() is not None:
            raise RuntimeError("chromium exited during startup")
        time.sleep(0.2)
    else:
        raise RuntimeError("chromium did not open a DevTools port")

    with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=10) as resp:
        targets = json.load(resp)
    page = next(t for t in targets if t.get("type") == "page")
    return proc, page["webSocketDebuggerUrl"]


def capture(url, timeout):
    profile_dir = tempfile.mkdtemp(prefix="eink-chromium-")
    proc = None
    try:
        proc, ws_url = launch_chromium(profile_dir)
        dt = DevTools(ws_url)
        dt.call("Emulation.setDeviceMetricsOverride", width=WIDTH, height=HEIGHT,
                deviceScaleFactor=1, mobile=False)
        dt.call("Page.enable")
        dt.call("Page.navigate", url=url)

        deadline = time.time() + timeout
        state = {}
        while time.time() < deadline:
            raw = dt.evaluate(PAGE_STATE_JS)
            state = json.loads(raw) if raw else {}
            if state.get("ready"):
                break
            time.sleep(0.5)
        else:
            raise RuntimeError(f"page not ready after {timeout}s")

        dt.evaluate("document.fonts.ready.then(() => true)", await_promise=True)
        time.sleep(0.5)
        state = json.loads(dt.evaluate(PAGE_STATE_JS))

        shot = dt.call("Page.captureScreenshot", format="png",
                       clip={"x": 0, "y": 0, "width": WIDTH, "height": HEIGHT, "scale": 1})
        dt.close()
        image = Image.open(io.BytesIO(base64.b64decode(shot["data"]))).convert("RGB")
        return image, state
    finally:
        if proc:
            proc.terminate()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()
        shutil.rmtree(profile_dir, ignore_errors=True)


def content_hash(image, updated_rect):
    """Hash the capture with the "Updated" timestamp blanked out."""
    masked = image.copy()
    if updated_rect:
        left, top, right, bottom = updated_rect
        ImageDraw.Draw(masked).rectangle([left - 2, top - 2, right + 2, bottom + 2], fill="white")
    return hashlib.sha256(masked.tobytes()).hexdigest()


def load_state():
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_state(state):
    os.makedirs(STATE_DIR, exist_ok=True)
    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f, indent=2)
    os.replace(tmp, STATE_FILE)


def show(image, saturation):
    from inky.auto import auto

    display = auto()
    display.set_image(image, saturation=saturation)
    display.show()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url", default="http://localhost/eink")
    parser.add_argument("--force", action="store_true", help="redraw even if nothing changed")
    parser.add_argument("--dry-run", action="store_true", help="capture and decide, but don't touch the panel")
    parser.add_argument("--max-age", type=float, default=30, help="minutes before an unchanged screen is redrawn")
    parser.add_argument("--stale-after", type=float, default=60,
                        help="minutes an error page is held back in favour of the last good image")
    parser.add_argument("--timeout", type=float, default=45, help="seconds to wait for the page to load")
    parser.add_argument("--saturation", type=float, default=0.5)
    args = parser.parse_args()

    state = load_state()
    now = time.time()
    age_min = (now - state.get("shown_at", 0)) / 60

    try:
        image, page = capture(args.url, args.timeout)
    except Exception as exc:
        log(f"capture failed: {exc}")
        return 1

    os.makedirs(STATE_DIR, exist_ok=True)
    image.save(LAST_CAPTURE)

    if page.get("error") and not args.force:
        if state.get("shown_ok", False) and age_min < args.stale_after:
            log(f"page shows an error; keeping last good image ({age_min:.0f} min old)")
            return 1
        log("page shows an error and the last good image is stale; showing the error page")

    digest = content_hash(image, page.get("updatedRect"))
    unchanged = digest == state.get("hash")
    if unchanged and age_min < args.max_age and not args.force:
        log(f"no visible change; skipping refresh (shown {age_min:.0f} min ago)")
        return 0

    reason = "forced" if args.force else ("max age reached" if unchanged else "content changed")
    if args.dry_run:
        log(f"dry run: would refresh ({reason})")
        return 0

    started = time.time()
    show(image, args.saturation)
    image.save(LAST_IMAGE)
    save_state({"hash": digest, "shown_at": now, "shown_ok": not page.get("error")})
    log(f"refreshed panel ({reason}) in {time.time() - started:.0f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
