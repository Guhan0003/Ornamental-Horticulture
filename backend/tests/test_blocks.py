import pytest


@pytest.fixture
def plant_id(client, editor_headers):
    response = client.post(
        "/api/v1/plants",
        headers=editor_headers,
        json={"slug": "fiddle-leaf-fig", "common_name": "Fiddle Leaf Fig", "is_published": True},
    )
    return response.json()["id"]


def add_block(client, headers, plant_id, type_, data, position=0):
    return client.post(
        f"/api/v1/blocks/plant/{plant_id}",
        headers=headers,
        json={"type": type_, "position": position, "data": data},
    )


def test_blocks_come_back_in_position_order(client, editor_headers, plant_id):
    add_block(client, editor_headers, plant_id, "text", {"body": "second"}, position=1)
    add_block(client, editor_headers, plant_id, "heading", {"text": "first"}, position=0)

    blocks = client.get("/api/v1/plants/fiddle-leaf-fig").json()["blocks"]
    assert [b["type"] for b in blocks] == ["heading", "text"]


def test_block_data_is_stored_verbatim(client, editor_headers, plant_id):
    """The JSON column is what makes the page format dynamic — it must round-trip."""
    data = {"items": [{"label": "Light", "value": "Bright, indirect"}]}
    add_block(client, editor_headers, plant_id, "facts", data)

    blocks = client.get("/api/v1/plants/fiddle-leaf-fig").json()["blocks"]
    assert blocks[0]["data"] == data


def test_reorder_changes_display_order(client, editor_headers, plant_id):
    a = add_block(client, editor_headers, plant_id, "heading", {"text": "A"}, 0).json()
    b = add_block(client, editor_headers, plant_id, "text", {"body": "B"}, 1).json()

    response = client.put(
        f"/api/v1/blocks/plant/{plant_id}/reorder",
        headers=editor_headers,
        json={"block_ids": [b["id"], a["id"]]},
    )
    assert response.status_code == 200
    assert [x["id"] for x in response.json()] == [b["id"], a["id"]]


def test_reorder_rejects_a_partial_list(client, editor_headers, plant_id):
    a = add_block(client, editor_headers, plant_id, "heading", {"text": "A"}, 0).json()
    add_block(client, editor_headers, plant_id, "text", {"body": "B"}, 1)

    response = client.put(
        f"/api/v1/blocks/plant/{plant_id}/reorder",
        headers=editor_headers,
        json={"block_ids": [a["id"]]},
    )
    assert response.status_code == 400


def test_unknown_block_type_is_rejected(client, editor_headers, plant_id):
    response = add_block(client, editor_headers, plant_id, "carousel", {})
    assert response.status_code == 422


def test_blocks_require_auth(client, plant_id):
    response = client.post(
        f"/api/v1/blocks/plant/{plant_id}",
        json={"type": "text", "data": {"body": "x"}},
    )
    assert response.status_code == 401


def test_deleting_a_plant_removes_its_blocks(client, editor_headers, plant_id, db_session):
    from app.models.block import ContentBlock

    add_block(client, editor_headers, plant_id, "text", {"body": "x"})
    client.delete("/api/v1/plants/fiddle-leaf-fig", headers=editor_headers)

    assert db_session.query(ContentBlock).filter_by(plant_id=plant_id).count() == 0
