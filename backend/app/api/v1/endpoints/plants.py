from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response, status

from app.api.deps import CurrentUser, DbSession
from app.models.plant import Plant, RetiredSlug
from app.schemas.plant import (
    PlantCreate,
    PlantRead,
    PlantSummary,
    PlantUpdate,
    price_problem,
)
from app.services import taps
from app.services.photos import discard_unused, photo_urls
from app.services.related import find_related
from app.services.views import looks_like_a_person, record_view

router = APIRouter()


def _get_or_404(db: DbSession, slug: str) -> Plant:
    plant = db.query(Plant).filter(Plant.slug == slug).first()
    if plant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found")
    return plant


# The shop's list and a plant's data are what the pages wait for, and they live in
# Sydney while the people reading them are mostly in India, so every visit used to
# spend about 0.7s travelling there and back. Everyone is shown the same thing, so
# the CDN keeps it close to them instead: for a minute, and then for an hour more it
# hands out the old copy instantly while fetching a new one.
#
# The hour is not about freshness, it is about the server sleeping. After a few
# quiet minutes the function in Sydney goes to sleep, and the first request to
# wake it was measured at up to 11 seconds. Serving the old copy while it wakes in
# the background means a visitor is never the one who waits, as long as someone
# has opened the page in the last hour. The price is that the first visitor after
# a quiet spell can see it as it was when the last one left, once; the next
# visitor sees the fresh one. A change in the dashboard therefore shows up within a
# minute when the shop is busy, and on the second visit when it is quiet.
#
# This is safe for a plant's data only because scans are no longer counted when the
# data is fetched. A cached answer never reaches the server, so counting there would
# stop working; the plant page reports itself with POST /plants/{slug}/view instead,
# which is never cached.
EDGE_CACHE = "public, max-age=0, s-maxage=60, stale-while-revalidate=3600"


def _cache(response: Response, fresh: bool) -> None:
    """
    Let the CDN keep this answer, or (`fresh`) not.

    Varies on Origin whoever asks. The API tells each website whether it may read
    the answer, and the cache has to keep a separate copy for each one, and one for
    a caller that sends no origin at all (a crawler, a sitemap build), or that copy
    would be handed to a browser with no permission in it.
    """
    response.headers["Vary"] = "Origin"
    response.headers["Cache-Control"] = "no-store" if fresh else EDGE_CACHE


@router.get("", response_model=list[PlantSummary])
def list_plants(db: DbSession, response: Response, fresh: bool = False):
    """
    Every plant, A–Z. Feeds the home page, the My list sheet and the admin list.

    `?fresh=1` skips the cache. The dashboard asks that way, so what you have
    just saved is never hidden behind a copy from a minute ago.
    """
    _cache(response, fresh)
    return db.query(Plant).order_by(Plant.common_name).all()


@router.get("/{slug}", response_model=PlantRead)
def get_plant(slug: str, db: DbSession, response: Response, fresh: bool = False):
    """
    Everything needed to render one plant page, in a single request.

    Reading a plant does not count as a view, so it can be kept at the CDN and so a
    page fetched ahead of time, in case a suggestion gets tapped, is not somebody
    looking at a plant. The page counts itself (POST /{slug}/view) when it is shown.
    `?fresh=1` skips the cache; the dashboard's editor asks that way.
    """
    plant = _get_or_404(db, slug)

    page = PlantRead.model_validate(plant)
    page.related = [PlantSummary.model_validate(other) for other in find_related(db, plant)]

    _cache(response, fresh)
    return page


@router.post("/{slug}/view", status_code=status.HTTP_204_NO_CONTENT)
def count_page_view(
    slug: str, db: DbSession, request: Request, background: BackgroundTasks
):
    """
    A plant's page was shown to someone: this is a scan.

    Sent by the page itself once it is on screen, which is what makes a scan mean
    "a person looked at this plant" rather than "something fetched its data".
    Quiet like the order-button tap: it answers with nothing and counts after the
    response has gone out, so nobody on a shop's Wi-Fi waits on analytics. A plant
    that does not exist, or a crawler, counts for nothing, so the numbers cannot be
    padded by guessing addresses or by link previews.
    """
    _get_or_404(db, slug)
    background.add_task(record_view, slug, request.headers.get("user-agent", ""))


@router.post("/{slug}/tap", status_code=status.HTTP_204_NO_CONTENT)
def count_order_tap(slug: str, db: DbSession, request: Request):
    """
    The WhatsApp order button on this plant's page was pressed.

    Public, like opening the page, and just as quiet: it answers with nothing. A
    plant that does not exist, or a crawler, counts for nothing, so the numbers
    cannot be padded by guessing addresses or by link previews.
    """
    _get_or_404(db, slug)
    if looks_like_a_person(request.headers.get("user-agent", "")):
        taps.record_tap(db, slug)


@router.post("", response_model=PlantRead, status_code=status.HTTP_201_CREATED)
def create_plant(payload: PlantCreate, db: DbSession, user: CurrentUser):
    if db.query(Plant).filter(Plant.slug == payload.slug).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Another plant already uses that address.",
        )
    if db.get(RetiredSlug, payload.slug):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That address belonged to a deleted plant and can't be reused — "
            "an old QR label may still point at it.",
        )

    plant = Plant(**payload.model_dump())
    db.add(plant)
    db.commit()
    db.refresh(plant)
    return plant


@router.patch("/{slug}", response_model=PlantRead)
def update_plant(slug: str, payload: PlantUpdate, db: DbSession, user: CurrentUser):
    plant = _get_or_404(db, slug)
    previous_photos = photo_urls(plant)
    changes = payload.model_dump(exclude_unset=True)

    # Checked against what the plant will look like afterwards, and before
    # anything is changed: a PATCH can send either price on its own.
    problem = price_problem(
        changes.get("price_minor", plant.price_minor),
        changes.get("original_price_minor", plant.original_price_minor),
    )
    if problem:
        # The constant's name changed between Starlette versions; the number did not.
        raise HTTPException(status_code=422, detail=problem)

    for field, value in changes.items():
        setattr(plant, field, value)

    db.commit()
    db.refresh(plant)

    # A photo taken out, or swapped for another, is left behind unused. One that
    # only moved — from the cover into the gallery, say — is still shown, and stays.
    discard_unused(db, previous_photos - photo_urls(plant))

    return plant


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plant(slug: str, db: DbSession, user: CurrentUser):
    plant = _get_or_404(db, slug)
    photos = photo_urls(plant)

    db.delete(plant)
    db.add(RetiredSlug(slug=slug))
    db.commit()

    # The row is gone either way; its photos are tidied up afterwards.
    discard_unused(db, photos)
