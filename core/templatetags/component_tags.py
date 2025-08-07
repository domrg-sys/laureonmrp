from django import template

register = template.Library()

@register.inclusion_tag('partials/_tab_navigator.html')
def tab_navigator(tabs, active_tab):
    return {
        'tabs': tabs,
        'active_tab': active_tab,
    }