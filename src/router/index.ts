import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
  ],
})

// Navigation guard
router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()

  // Ensure auth is initialized from localStorage
  if (!authStore.token && !authStore.user) {
    const storedToken = localStorage.getItem('auth_token')
    if (storedToken) {
      // Auth store will auto-initialize on first use
      authStore.token = storedToken
    }
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return next('/login')
  }

  if (to.name === 'login' && authStore.isAuthenticated) {
    return next('/')
  }

  next()
})

export default router
