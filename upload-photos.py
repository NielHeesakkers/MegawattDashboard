#!/usr/bin/env python3
"""Upload all local photos to the live server via API"""
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

BASE_URL = "https://test.heesakkers.com"
UPLOADS_DIR = Path(__file__).parent / "uploads"

PHOTO_MAP = {
    "Stephan Kwast": "stephan-kwast.jpg",
    "Simon Coolen": "simon-coolen.jpg",
    "Richard Dillen": "richard-dillen.jpg",
    "Rachelle Berkelaar": "rachelle-berkelaar.jpg",
    "Gonnie Van der Kruijs": "gonnie-wajon1.jpg",
    "Jitte Kleinbekman": "jitte-kleinbekman.jpg",
    "Lisa Timmermans": "lisa-timmermans.jpg",
    "Bas van Heesch": "bas-van-heesch.jpg",
    "Laura Beenders": "laura-mulckhuijse.jpg",
    "Robin Nieuwkerk": "robin-nieuwkerk.jpg",
    "Jesse van Maanen": "jesse-van-maanen.jpg",
    "Bram van der Kroon": "bram-van-der-kroon.jpg",
    "Eva Storck": "eva-storck.jpg",
    "Ad van Ongeval": "ad-van-ongeval.jpg",
    "Joris Seghers": "joris-seghers.jpg",
    "Niel Heesakkers": "niel-heesakkers.jpg",
    "Erik Muijsenberg": "erik-muisenberg.jpg",
    "Sebastian van den Berg": "sebastian-van-den-berg.jpg",
    "Tim Savelkouls": "tim-savelkouls.jpg",
    "Richard Gravemaker": "richard-gravemaker.jpg",
    "Niels Sasharias": "niels-sacharius.jpg",
    "Tessa Maas": "tessa-maas.jpg",
    "Bram van der Burgt": "bram-van-der-burgt.jpg",
    "Bo Verbiest": "bo-verbiest.jpg",
    "Debby de Jonge": "debby-de-jonge.jpg",
    "Manon Heijens": "manon-heijens.jpg",
    "Pieter Claessens": "pieter-claessens.jpg",
    "Amber Franken": "amber-franken.jpg",
    "Paulien Kersjes": "pauline-kersjes.jpg",
    "Lynn Verhoeven": "lynn-verhoeven.jpg",
    "Manon Hermans": "manon-hermans.jpg",
    "Stacey Schleenstein": "stacey-schleenstein.jpg",
    "Rob Vercoelen": "rob-vercoelen-groot.jpg",
    "Mick Mulder": "mick-mulder.jpg",
    "Doyke van Genechten": "doyke-van-genechten.jpg",
    "Dirk Coolen": "dirk-coolen.jpg",
    "Stuie Franken": "stuie-franken.jpg",
    "Nordin Bihaki": "nordin-bihaki.jpg",
    "Romano Henar": "romano-henar.jpg",
}


def multipart_upload(url, token, fields, file_field, file_path):
    """Upload a file using multipart/form-data with urllib (no dependencies)"""
    boundary = "----PythonUploadBoundary"
    body = b""

    # Add text fields
    for key, value in fields.items():
        body += f"--{boundary}\r\n".encode()
        body += f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode()
        body += f"{value}\r\n".encode()

    # Add file
    filename = os.path.basename(file_path)
    body += f"--{boundary}\r\n".encode()
    body += f'Content-Disposition: form-data; name="{file_field}"; filename="{filename}"\r\n'.encode()
    body += b"Content-Type: image/jpeg\r\n\r\n"
    with open(file_path, "rb") as f:
        body += f.read()
    body += b"\r\n"

    body += f"--{boundary}--\r\n".encode()

    req = urllib.request.Request(url, data=body, method="PUT")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")

    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"    ERROR {e.code}: {e.read().decode()}")
        return None


def main():
    print("=== Megawatt Photo Uploader ===\n")

    # Login
    print("Logging in...")
    login_data = json.dumps({"username": "admin", "password": "megawatt2026"}).encode()
    req = urllib.request.Request(
        f"{BASE_URL}/api/auth/login",
        data=login_data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        token = json.loads(resp.read())["token"]
    print("Logged in successfully\n")

    # Upload executive photos
    print("--- Uploading executive photos ---")
    with urllib.request.urlopen(f"{BASE_URL}/api/executives") as resp:
        executives = json.loads(resp.read())

    for ex in executives:
        name = ex["name"]
        filename = PHOTO_MAP.get(name)
        filepath = UPLOADS_DIR / filename if filename else None

        if filepath and filepath.exists():
            print(f"  Uploading: {name} -> {filename}")
            result = multipart_upload(
                f"{BASE_URL}/api/executives/{ex['id']}",
                token,
                {"name": name},
                "photo",
                str(filepath),
            )
            print(f"    {'OK' if result else 'FAILED'}")
        else:
            print(f"  Skip: {name} (no photo)")

    # Upload member photos
    print("\n--- Uploading member photos ---")
    with urllib.request.urlopen(f"{BASE_URL}/api/members") as resp:
        members = json.loads(resp.read())

    uploaded = 0
    skipped = 0
    for m in members:
        if m.get("isVacancy"):
            continue

        name = m["name"]
        filename = PHOTO_MAP.get(name)
        filepath = UPLOADS_DIR / filename if filename else None

        if filepath and filepath.exists():
            print(f"  Uploading: {name} -> {filename}")
            result = multipart_upload(
                f"{BASE_URL}/api/members/{m['id']}",
                token,
                {"name": name},
                "photo",
                str(filepath),
            )
            if result:
                uploaded += 1
                print(f"    OK")
            else:
                print(f"    FAILED")
        else:
            skipped += 1
            print(f"  Skip: {name} (no photo found)")

    print(f"\n=== Done! Uploaded: {uploaded}, Skipped: {skipped} ===")


if __name__ == "__main__":
    main()
