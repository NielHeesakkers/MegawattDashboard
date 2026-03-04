#!/bin/bash
# Upload all local photos to the live server via API
set -e

BASE_URL="https://test.heesakkers.com"
UPLOADS_DIR="$(dirname "$0")/uploads"

echo "=== Megawatt Photo Uploader ==="

# Login
echo "Logging in..."
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"megawatt2026"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "ERROR: Login failed"
  exit 1
fi
echo "Logged in successfully"

# Photo mapping: "member name" -> "filename in uploads/"
declare -A PHOTO_MAP
PHOTO_MAP=(
  ["Stephan Kwast"]="stephan-kwast.jpg"
  ["Simon Coolen"]="simon-coolen.jpg"
  ["Richard Dillen"]="richard-dillen.jpg"
  ["Rachelle Berkelaar"]="rachelle-berkelaar.jpg"
  ["Gonnie Van der Kruijs"]="gonnie-wajon1.jpg"
  ["Jitte Kleinbekman"]="jitte-kleinbekman.jpg"
  ["Lisa Timmermans"]="lisa-timmermans.jpg"
  ["Bas van Heesch"]="bas-van-heesch.jpg"
  ["Laura Beenders"]="laura-mulckhuijse.jpg"
  ["Robin Nieuwkerk"]="robin-nieuwkerk.jpg"
  ["Jesse van Maanen"]="jesse-van-maanen.jpg"
  ["Bram van der Kroon"]="bram-van-der-kroon.jpg"
  ["Eva Storck"]="eva-storck.jpg"
  ["Ad van Ongeval"]="ad-van-ongeval.jpg"
  ["Joris Seghers"]="joris-seghers.jpg"
  ["Niel Heesakkers"]="niel-heesakkers.jpg"
  ["Erik Muijsenberg"]="erik-muisenberg.jpg"
  ["Sebastian van den Berg"]="sebastian-van-den-berg.jpg"
  ["Tim Savelkouls"]="tim-savelkouls.jpg"
  ["Richard Gravemaker"]="richard-gravemaker.jpg"
  ["Niels Sasharias"]="niels-sacharius.jpg"
  ["Tessa Maas"]="tessa-maas.jpg"
  ["Bram van der Burgt"]="bram-van-der-burgt.jpg"
  ["Bo Verbiest"]="bo-verbiest.jpg"
  ["Debby de Jonge"]="debby-de-jonge.jpg"
  ["Manon Heijens"]="manon-heijens.jpg"
  ["Pieter Claessens"]="pieter-claessens.jpg"
  ["Amber Franken"]="amber-franken.jpg"
  ["Paulien Kersjes"]="pauline-kersjes.jpg"
  ["Lynn Verhoeven"]="lynn-verhoeven.jpg"
  ["Manon Hermans"]="manon-hermans.jpg"
  ["Stacey Schleenstein"]="stacey-schleenstein.jpg"
  ["Rob Vercoelen"]="rob-vercoelen-groot.jpg"
  ["Mick Mulder"]="mick-mulder.jpg"
  ["Doyke van Genechten"]="doyke-van-genechten.jpg"
  ["Dirk Coolen"]="dirk-coolen.jpg"
  ["Stuie Franken"]="stuie-franken.jpg"
  ["Nordin Bihaki"]="nordin-bihaki.jpg"
  ["Romano Henar"]="romano-henar.jpg"
)

# Upload photos for executives
echo ""
echo "--- Uploading executive photos ---"
EXECUTIVES=$(curl -s "$BASE_URL/api/executives")
echo "$EXECUTIVES" | python3 -c "
import json, sys
for ex in json.load(sys.stdin):
    print(f\"{ex['id']}|{ex['name']}\")
" | while IFS='|' read -r id name; do
  filename="${PHOTO_MAP[$name]}"
  if [ -n "$filename" ] && [ -f "$UPLOADS_DIR/$filename" ]; then
    echo "  Uploading: $name -> $filename"
    curl -s -X PUT "$BASE_URL/api/executives/$id" \
      -H "Authorization: Bearer $TOKEN" \
      -F "name=$name" \
      -F "photo=@$UPLOADS_DIR/$filename" > /dev/null
    echo "    OK"
  else
    echo "  Skip: $name (no photo)"
  fi
done

# Upload photos for members
echo ""
echo "--- Uploading member photos ---"
MEMBERS=$(curl -s "$BASE_URL/api/members")
echo "$MEMBERS" | python3 -c "
import json, sys
for m in json.load(sys.stdin):
    vacancy = 'true' if m.get('isVacancy') else 'false'
    print(f\"{m['id']}|{m['name']}|{vacancy}\")
" | while IFS='|' read -r id name is_vacancy; do
  if [ "$is_vacancy" = "true" ]; then
    continue
  fi
  filename="${PHOTO_MAP[$name]}"
  if [ -n "$filename" ] && [ -f "$UPLOADS_DIR/$filename" ]; then
    echo "  Uploading: $name -> $filename"
    curl -s -X PUT "$BASE_URL/api/members/$id" \
      -H "Authorization: Bearer $TOKEN" \
      -F "name=$name" \
      -F "photo=@$UPLOADS_DIR/$filename" > /dev/null
    echo "    OK"
  else
    echo "  Skip: $name (no photo found)"
  fi
done

echo ""
echo "=== Done! ==="
