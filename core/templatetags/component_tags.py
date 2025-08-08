from django import template

register = template.Library()

@register.inclusion_tag('partials/_tab_navigator.html')
def tab_navigator(tabs, active_tab):
    return {
        'tabs': tabs,
        'active_tab': active_tab,
    }

@register.inclusion_tag('partials/_form_error_summary.html')
def form_error_summary(form):
    """
    Renders a summary of form errors.
    Usage: {% form_error_summary form %}
    """
    return {'form': form}