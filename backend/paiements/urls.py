from rest_framework.routers import DefaultRouter

from .views import PaiementViewSet

router = DefaultRouter()
router.register("paiements", PaiementViewSet, basename="paiement")

urlpatterns = router.urls
