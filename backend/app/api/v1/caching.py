"""
How the public reads are kept at the CDN, shared by the plants and the shop's settings.
"""

from fastapi import Response

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


def cache_at_the_edge(response: Response, fresh: bool) -> None:
    """
    Let the CDN keep this answer, or (`fresh`) not.

    Varies on Origin whoever asks. The API tells each website whether it may read
    the answer, and the cache has to keep a separate copy for each one, and one for
    a caller that sends no origin at all (a crawler, a sitemap build), or that copy
    would be handed to a browser with no permission in it.
    """
    response.headers["Vary"] = "Origin"
    response.headers["Cache-Control"] = "no-store" if fresh else EDGE_CACHE
