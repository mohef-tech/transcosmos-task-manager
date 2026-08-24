#!/bin/bash
# Smoke test untuk transcosmos-task-manager API
# Jalankan dari mana saja: bash smoke-test.sh
# PENTING: pastikan `php artisan serve` DAN `php artisan queue:work` sudah jalan di terminal terpisah

BASE_URL="http://127.0.0.1:8000/api"
PASS=0
FAIL=0

check() {
  local label="$1"
  local http_code="$2"
  local expected="$3"
  if [ "$http_code" == "$expected" ]; then
    echo "✅ PASS: $label (HTTP $http_code)"
    PASS=$((PASS+1))
  else
    echo "❌ FAIL: $label (expected $expected, got $http_code)"
    FAIL=$((FAIL+1))
  fi
}

echo "=== 1. LOGIN ==="
LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"email":"admin@contoh.com","password":"password"}')
HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)
BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')
TOKEN=$(echo "$BODY" | grep -o '"token":"[^"]*' | sed 's/"token":"//')
check "Login" "$HTTP_CODE" "200"
if [ -z "$TOKEN" ]; then
  echo "⚠️  Token kosong, stop di sini — cek response login:"
  echo "$BODY"
  exit 1
fi
echo "Token: ${TOKEN:0:20}..."

AUTH_HEADER="Authorization: Bearer $TOKEN"

echo ""
echo "=== 2. GET /auth/me ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/auth/me" -H "$AUTH_HEADER" -H "Accept: application/json")
check "Get current user" "$CODE" "200"

echo ""
echo "=== 3. CREATE TASK ==="
CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/tasks" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"title":"Smoke Test Task","description":"Testing task creation","status":"todo","priority":"high","due_date":"2026-09-01"}')
HTTP_CODE=$(echo "$CREATE_RESPONSE" | tail -n1)
BODY=$(echo "$CREATE_RESPONSE" | sed '$d')
TASK_ID=$(echo "$BODY" | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
check "Create task" "$HTTP_CODE" "201"
echo "Task ID: $TASK_ID"

echo ""
echo "=== 4. LIST TASKS (with pagination/filter) ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/tasks?page=1&status=todo" -H "$AUTH_HEADER" -H "Accept: application/json")
check "List tasks" "$CODE" "200"

echo ""
echo "=== 5. GET TASK DETAIL ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/tasks/$TASK_ID" -H "$AUTH_HEADER" -H "Accept: application/json")
check "Get task detail" "$CODE" "200"

echo ""
echo "=== 6. UPDATE TASK ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE_URL/tasks/$TASK_ID" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"title":"Smoke Test Task (updated)","status":"in_progress"}')
check "Update task" "$CODE" "200"

echo ""
echo "=== 7. UPLOAD ATTACHMENT ==="
echo "test file content" > /tmp/smoketest.txt
UPLOAD_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/tasks/$TASK_ID/attachments" \
  -H "$AUTH_HEADER" -H "Accept: application/json" \
  -F "file=@/tmp/smoketest.txt")
HTTP_CODE=$(echo "$UPLOAD_RESPONSE" | tail -n1)
BODY=$(echo "$UPLOAD_RESPONSE" | sed '$d')
ATTACHMENT_ID=$(echo "$BODY" | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
check "Upload attachment" "$HTTP_CODE" "201"
echo "Attachment ID: $ATTACHMENT_ID (kalau kosong/fail, cek nama field form-data di controller kamu — mungkin bukan 'file')"

if [ -n "$ATTACHMENT_ID" ]; then
  echo ""
  echo "=== 8. DOWNLOAD ATTACHMENT ==="
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/tasks/$TASK_ID/attachments/$ATTACHMENT_ID/download" -H "$AUTH_HEADER")
  check "Download attachment" "$CODE" "200"

  echo ""
  echo "=== 9. DELETE ATTACHMENT ==="
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/tasks/$TASK_ID/attachments/$ATTACHMENT_ID" -H "$AUTH_HEADER" -H "Accept: application/json")
  check "Delete attachment" "$CODE" "200"
fi

echo ""
echo "=== 10. DISPATCH CSV EXPORT ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/exports/tasks" -H "$AUTH_HEADER" -H "Accept: application/json")
check "Dispatch CSV export" "$CODE" "200,201,202"
echo "⚠️  Tunggu 2-3 detik biar queue worker sempat proses (pastikan 'php artisan queue:work' jalan)"
sleep 3

echo ""
echo "=== 11. LIST EXPORTS ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/exports/tasks" -H "$AUTH_HEADER" -H "Accept: application/json")
check "List CSV exports" "$CODE" "200"

echo ""
echo "=== 12. DELETE TASK ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/tasks/$TASK_ID" -H "$AUTH_HEADER" -H "Accept: application/json")
check "Delete task" "$CODE" "200,204"

echo ""
echo "=== 13. LOGOUT ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/auth/logout" -H "$AUTH_HEADER" -H "Accept: application/json")
check "Logout" "$CODE" "200"

echo ""
echo "=== 14. VERIFY TOKEN INVALIDATED ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/auth/me" -H "$AUTH_HEADER" -H "Accept: application/json")
check "Old token rejected after logout" "$CODE" "401"

echo ""
echo "========================================"
echo "HASIL: $PASS passed, $FAIL failed"
echo "========================================"
