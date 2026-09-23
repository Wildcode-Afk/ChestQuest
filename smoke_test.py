#!/usr/bin/env python3
"""Vérification minimale de démarrage du projet ChestQuest.

Cette vérification ne dépend d'aucune librairie externe. Elle vérifie que les
fichiers attendus sont présents et qu'une page statique répond bien via un
serveur local de test.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = 8000
URL = f"http://127.0.0.1:{PORT}/"

REQUIRED_FILES = [
    "index.html",
    "style.css",
    "app.js",
    "chess-core.js",
    "chess-rules.js",
    "chess-history.js",
    "chess-ai.js",
    "chess-board-view.js",
    "chess-preferences.js",
    "chess-sound.js",
    "chess-feedback.js",
    "chess-messages.js",
    "chess-modal.js",
    "chess-clock.js",
    "chess-modes.js",
    "chess-mode-solitaire.js",
    "auth.js",
    "supabase-config.js",
    "setup.sql",
]


def fail(message: str) -> None:
    print(f"[FAIL] {message}")
    raise SystemExit(1)


def check_required_files() -> None:
    missing = [name for name in REQUIRED_FILES if not (ROOT / name).exists()]
    if missing:
        fail(f"Fichiers manquants : {', '.join(missing)}")
    print("[OK] Fichiers requis présents.")


def check_html_references() -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    expected = [
        "style.css",
        "app.js",
        "chess-core.js",
        "chess-rules.js",
        "chess-history.js",
        "chess-ai.js",
        "chess-board-view.js",
        "chess-preferences.js",
        "chess-sound.js",
        "chess-feedback.js",
        "chess-messages.js",
        "chess-modal.js",
        "chess-clock.js",
        "chess-modes.js",
        "chess-mode-solitaire.js",
        "auth.js",
        "supabase-config.js",
        "logo.png",
    ]
    for item in expected:
        if item not in html:
            fail(f"Référence absente dans index.html : {item}")
    print("[OK] Références HTML vérifiées.")


def wait_for_server() -> None:
    deadline = time.time() + 15
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(URL, timeout=2):
                return
        except Exception:
            time.sleep(0.5)
    fail(f"Le serveur local n'a pas répondu sur {URL}")


def run_server() -> subprocess.Popen[str]:
    return subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
        cwd=str(ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main() -> None:
    check_required_files()
    check_html_references()

    proc = run_server()
    try:
        wait_for_server()
        with urllib.request.urlopen(URL, timeout=10) as response:
            body = response.read().decode("utf-8", errors="replace")
            status = response.status
            if status != 200:
                fail(f"Code HTTP inattendu : {status}")
            if "<title>ChessQuest</title>" not in body:
                fail("Titre de la page non trouvé.")
            print(f"[OK] Page chargée : {URL} (HTTP {status})")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)


if __name__ == "__main__":
    try:
        main()
        print("[OK] Smoke test ChestQuest réussi.")
    except SystemExit:
        raise
    except Exception as exc:  # pragma: no cover
        fail(f"Erreur inattendue : {exc}")
