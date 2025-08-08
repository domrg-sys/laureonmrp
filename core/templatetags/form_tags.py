from django import template

register = template.Library()

@register.inclusion_tag('partials/_render_field.html')
def render_field(field):
    return {'field': field}