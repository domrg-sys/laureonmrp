from django.shortcuts import render
from django.contrib.auth.decorators import permission_required

@permission_required('sample_control.view_samplecontrol_page', raise_exception=True)
def sample_control_page(request):
    context = {}
    return render(request, 'sample_control/page.html', context)