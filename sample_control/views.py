from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import permission_required
from django.http import JsonResponse
from django.template.loader import render_to_string
from .models import Sample
from location_configuration.models import Location, LocationSpace

def _build_location_tree(locations):
    """Transforms a flat queryset of locations into a hierarchical tree."""
    location_map = {loc.id: {'location': loc, 'children': []} for loc in locations}
    root_nodes = []

    for loc in locations:
        node = location_map[loc.id]
        # If the location has a parent that exists in the map, add it as a child
        if loc.parent_id and loc.parent_id in location_map:
            location_map[loc.parent_id]['children'].append(node)
        # Otherwise, it's a root node
        else:
            root_nodes.append(node)
            
    return root_nodes

@permission_required('sample_control.view_samplecontrol_page', raise_exception=True)
def sample_control_page(request):
    """Renders the main sample control page with a navigable location tree."""
    locations = Location.objects.select_related('location_type').all()
    location_tree = _build_location_tree(locations)
    context = {'location_tree': location_tree}
    return render(request, 'sample_control/page.html', context)

@permission_required('sample_control.view_samplecontrol_page', raise_exception=True)
def get_location_details(request, location_id):
    """
    Fetches details for a specific location and returns it as an HTML partial.
    This is intended to be called via an AJAX request from the frontend.
    """
    location = get_object_or_404(
        Location.objects.select_related('location_type'), pk=location_id
    )
    context = {'location': location}

    if location.location_type.has_spaces:
        grid = [[None] * location.location_type.columns for _ in range(location.location_type.rows)]
        spaces = LocationSpace.objects.select_related('sample').filter(parent_location=location)
        for space in spaces:
            if (space.row - 1) < len(grid) and (space.column - 1) < len(grid[0]):
                grid[space.row - 1][space.column - 1] = space
        context['space_grid'] = grid

    html = render_to_string(
        'sample_control/partials/_location_details.html', context, request=request
    )
    return JsonResponse({'html': html})