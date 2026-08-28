def test_category_delete_is_blocked_while_plants_use_it(client, editor_headers):
    category = client.post(
        "/api/v1/categories",
        headers=editor_headers,
        json={"name": "Indoor", "slug": "indoor"},
    ).json()

    client.post(
        "/api/v1/plants",
        headers=editor_headers,
        json={"slug": "pothos", "common_name": "Pothos", "category_id": category["id"]},
    )

    response = client.delete(
        f"/api/v1/categories/{category['id']}", headers=editor_headers
    )
    assert response.status_code == 409


def test_empty_category_can_be_deleted(client, editor_headers):
    category = client.post(
        "/api/v1/categories",
        headers=editor_headers,
        json={"name": "Empty", "slug": "empty"},
    ).json()

    response = client.delete(
        f"/api/v1/categories/{category['id']}", headers=editor_headers
    )
    assert response.status_code == 204


def test_categories_can_nest(client, editor_headers):
    parent = client.post(
        "/api/v1/categories",
        headers=editor_headers,
        json={"name": "Plants", "slug": "plants"},
    ).json()

    child = client.post(
        "/api/v1/categories",
        headers=editor_headers,
        json={"name": "Trees", "slug": "trees", "parent_id": parent["id"]},
    )
    assert child.status_code == 201
    assert child.json()["parent_id"] == parent["id"]


def test_category_with_children_cannot_be_deleted(client, editor_headers):
    parent = client.post(
        "/api/v1/categories",
        headers=editor_headers,
        json={"name": "Plants", "slug": "plants"},
    ).json()
    client.post(
        "/api/v1/categories",
        headers=editor_headers,
        json={"name": "Trees", "slug": "trees", "parent_id": parent["id"]},
    )

    response = client.delete(
        f"/api/v1/categories/{parent['id']}", headers=editor_headers
    )
    assert response.status_code == 409
