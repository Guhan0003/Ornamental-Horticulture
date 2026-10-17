"""
"You may also like" — the three plants nearest this one.

A QR scan lands on one page and, until now, ended there. Three plants at the
bottom turn a scan into a session, which is the only way anyone sees a second
plant.

Nothing new has to be entered for this. A plant already says where it lives,
how much light it wants, what it is used for and which notes it carries, and
that is enough to tell which plants are alike. No similarity table to build,
nothing to keep in step, and it sharpens on its own as the catalogue grows.
"""

from sqlalchemy.orm import Session

from app.models.plant import Plant

SUGGESTIONS = 3

# What counts as alike, and by how much. Light is weighted hardest because it
# is the thing that decides whether a plant survives where someone will put it.
SAME_ENVIRONMENT = 3
SHARED_LIGHT_LEVEL = 4
SHARED_USE = 2
SHARED_TOPIC = 1


def _uses(profile: dict) -> set[str]:
    items = []
    for key in ("landscape_use", "home_use"):
        items += (profile.get(key) or {}).get("items") or []
    return {item.strip().lower() for item in items if item.strip()}


def _ideal_light(profile: dict) -> set[int]:
    return set((profile.get("light") or {}).get("ideal") or [])


def _topics(deep_dive: list[dict]) -> set[str]:
    return {point.get("icon", "") for point in deep_dive or []}


def _score(plant: Plant, other: Plant) -> int:
    profile, other_profile = plant.profile or {}, other.profile or {}

    score = 0
    environment = (profile.get("environment") or "").strip().lower()
    if environment and environment == (other_profile.get("environment") or "").strip().lower():
        score += SAME_ENVIRONMENT

    score += SHARED_LIGHT_LEVEL * len(_ideal_light(profile) & _ideal_light(other_profile))
    score += SHARED_USE * len(_uses(profile) & _uses(other_profile))
    score += SHARED_TOPIC * len(_topics(plant.deep_dive) & _topics(other.deep_dive))
    return score


def find_related(db: Session, plant: Plant, limit: int = SUGGESTIONS) -> list[Plant]:
    """
    The plants most like this one, best first.

    A plant with nothing in common with anything still gets suggestions: an
    empty shelf at the bottom of the page is worse than a loose match, and on
    a small catalogue almost everything is a loose match anyway. Ties fall back
    to the name so the order is stable between requests.
    """
    others = db.query(Plant).filter(Plant.slug != plant.slug).all()
    if not others:
        return []

    return sorted(others, key=lambda other: (-_score(plant, other), other.common_name))[:limit]
