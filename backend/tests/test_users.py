def test_editor_cannot_list_users(client, editor_headers):
    assert client.get("/api/v1/users", headers=editor_headers).status_code == 403


def test_admin_can_create_a_user(client, admin_headers):
    response = client.post(
        "/api/v1/users",
        headers=admin_headers,
        json={"email": "new@example.com", "password": "newpass123", "role": "editor"},
    )
    assert response.status_code == 201
    assert response.json()["role"] == "editor"


def test_there_is_no_public_signup(client):
    response = client.post(
        "/api/v1/users",
        json={"email": "sneaky@example.com", "password": "sneaky123"},
    )
    assert response.status_code == 401


def test_duplicate_email_is_rejected(client, admin_headers):
    payload = {"email": "dupe@example.com", "password": "dupepass123"}
    assert client.post("/api/v1/users", headers=admin_headers, json=payload).status_code == 201
    assert client.post("/api/v1/users", headers=admin_headers, json=payload).status_code == 409


def test_short_password_is_rejected(client, admin_headers):
    response = client.post(
        "/api/v1/users",
        headers=admin_headers,
        json={"email": "short@example.com", "password": "abc"},
    )
    assert response.status_code == 422


def test_admin_cannot_deactivate_themselves(client, admin_headers, admin):
    response = client.patch(
        f"/api/v1/users/{admin.id}", headers=admin_headers, json={"is_active": False}
    )
    assert response.status_code == 400


def test_admin_cannot_delete_themselves(client, admin_headers, admin):
    assert client.delete(f"/api/v1/users/{admin.id}", headers=admin_headers).status_code == 400
