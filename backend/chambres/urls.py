from rest_framework.routers import DefaultRouter

from .views import CategorieViewSet, ChambreViewSet

router = DefaultRouter()
router.register("categories", CategorieViewSet, basename="categorie")
router.register("chambres", ChambreViewSet, basename="chambre")

urlpatterns = router.urls
