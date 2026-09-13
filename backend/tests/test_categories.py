def test_category_delete_is_blocked_while_plants_use_it(client, admin_headers):
    category = client.post(
        "/api/v1/categories",
        headers=admin_headers,
        json={"name": "Indoor", "slug": "indoor"},
    ).json()

    client.post(
        "/api/v1/plants",
        headers=admin_headers,
        json={"slug": "pothos", "common_name": "Pothos", "category_id": category["id"]},
    )

    response = client.delete(
        f"/api/v1/categories/{category['id']}", headers=admin_headers
    )
    assert response.status_code == 409


def test_empty_category_can_be_deleted(client, admin_headers):
    category = client.post(
        "/api/v1/categories",
        headers=admin_headers,
        json={"name": "Empty", "slug": "empty"},
    ).json()

    response = client.delete(
        f"/api/v1/categories/{category['id']}", headers=admin_headers
    )
    assert response.status_code == 204


def test_categories_can_nest(client, admin_headers):
    parent = client.post(
        "/api/v1/categories",
        headers=admin_headers,
        json={"name": "Plants", "slug": "plants"},
    ).json()

    child = client.post(
        "/api/v1/categories",
        headers=admin_headers,
        json={"name": "Trees", "slug": "trees", "parent_id": parent["id"]},
    )
    assert child.status_code == 201
    assert child.json()["parent_id"] == parent["id"]


def test_category_with_children_cannot_be_deleted(client, admin_headers):
    parent = client.post(
        "/api/v1/categories",
        headers=admin_headers,
        json={"name": "Plants", "slug": "plants"},
    ).json()
    client.post(
        "/api/v1/categories",
        headers=admin_headers,
        json={"name": "Trees", "slug": "trees", "parent_id": parent["id"]},
    )

    response = client.delete(
        f"/api/v1/categories/{parent['id']}", headers=admin_headers
    )
    assert response.status_code == 409


def make_category(client, headers, slug, parent_id=None):
    response = client.post(
        "/api/v1/categories",
        headers=headers,
        json={"name": slug.title(), "slug": slug, "parent_id": parent_id},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_category_cannot_be_its_own_parent(client, admin_headers):
    category = make_category(client, admin_headers, "indoor")

    response = client.patch(
        f"/api/v1/categories/{category['id']}",
        headers=admin_headers,
        json={"parent_id": category["id"]},
    )
    assert response.status_code == 400


def test_category_cannot_move_under_its_own_descendant(client, admin_headers):
    top = make_category(client, admin_headers, "plants")
    middle = make_category(client, admin_headers, "indoor", top["id"])
    bottom = make_category(client, admin_headers, "low-light", middle["id"])

    response = client.patch(
        f"/api/v1/categories/{top['id']}",
        headers=admin_headers,
        json={"parent_id": bottom["id"]},
    )
    assert response.status_code == 400


def test_category_can_move_to_a_valid_parent(client, admin_headers):
    a = make_category(client, admin_headers, "indoor")
    b = make_category(client, admin_headers, "outdoor")

    response = client.patch(
        f"/api/v1/categories/{b['id']}", headers=admin_headers, json={"parent_id": a["id"]}
    )
    assert response.status_code == 200
    assert response.json()["parent_id"] == a["id"]


def test_unknown_parent_is_rejected(client, admin_headers):
    response = client.post(
        "/api/v1/categories",
        headers=admin_headers,
        json={"name": "Orphan", "slug": "orphan", "parent_id": 999},
    )
    assert response.status_code == 400


def test_renaming_to_a_taken_slug_is_a_conflict(client, admin_headers):
    make_category(client, admin_headers, "indoor")
    other = make_category(client, admin_headers, "outdoor")

    response = client.patch(
        f"/api/v1/categories/{other['id']}", headers=admin_headers, json={"slug": "indoor"}
    )
    assert response.status_code == 409


def test_keeping_the_same_slug_is_not_a_conflict(client, admin_headers):
    category = make_category(client, admin_headers, "indoor")

    response = client.patch(
        f"/api/v1/categories/{category['id']}",
        headers=admin_headers,
        json={"name": "Indoor plants", "slug": "indoor"},
    )
    assert response.status_code == 200


def test_malformed_category_slug_is_rejected(client, admin_headers):
    response = client.post(
        "/api/v1/categories",
        headers=admin_headers,
        json={"name": "Indoor", "slug": "Indoor Plants"},
    )
    assert response.status_code == 422
