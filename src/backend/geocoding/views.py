"""Views for looking up an address and for walking routes."""

from typing import cast, final

import geocoding.services as geocoding_services
from geocoding import routing
from geocoding.serializers import GeocodeQuerySerializer, WalkingRouteQuerySerializer
from geocoding.services import GeocoderError, Place
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView


def _rendered(place: Place) -> dict[str, object]:
    """Render one place in the shape `api/openapi.yaml` documents."""
    return {
        "address": place.address,
        "locality": place.locality,
        "latitude": place.latitude,
        "longitude": place.longitude,
    }


@final
class GeocodeView(APIView):
    """
    `GET /api/geocode?q=` - find places in Vilnius matching a typed address.

    Authenticated: this spends an external service's quota on the app's
    behalf, so it answers the app's users rather than anyone on the internet.
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        """Return the matching places, best match first."""
        query = GeocodeQuerySerializer(data=request.query_params)
        _ = query.is_valid(raise_exception=True)
        data = cast("dict[str, object]", query.validated_data)

        try:
            places = geocoding_services.search(
                cast("str", data["q"]),
                cast("int", data["limit"]),
            )
        except GeocoderError:
            return Response(
                {"detail": "Address lookup is unavailable right now."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # A `Place` is a plain tuple from an upstream service rather than a
        # model, so its four fields are rendered here instead of by a
        # serializer that would only copy them.
        return Response(
            [_rendered(place) for place in places],
            status=status.HTTP_200_OK,
        )


@final
class WalkingRouteView(APIView):
    """
    `GET /api/routes/walk?stops=lng,lat;lng,lat;...` - a walk along streets.

    Backs the route planner: the app chooses which problems to visit and in
    what order; this returns the path between them, with its length and
    walking time, overall and per leg. Authenticated for the same reason as
    address lookup: it spends an external service's quota.
    """

    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        """Return the walk through the stops, in the order given."""
        query = WalkingRouteQuerySerializer(data=request.query_params)
        _ = query.is_valid(raise_exception=True)
        stops = cast(
            "tuple[tuple[float, float], ...]",
            cast("dict[str, object]", query.validated_data)["stops"],
        )
        try:
            route = routing.walking_route(stops)
        except routing.RoutingError:
            return Response(
                {"detail": "Walking routes are unavailable right now."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(
            {
                "distance_m": round(route.distance_m),
                "duration_s": round(route.duration_s),
                "path": {"type": "LineString", "coordinates": route.path},
                "legs": [
                    {
                        "distance_m": round(leg.distance_m),
                        "duration_s": round(leg.duration_s),
                    }
                    for leg in route.legs
                ],
            },
            status=status.HTTP_200_OK,
        )
