import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import WeatherView from '../views/WeatherView.vue'
import EventsView from '../views/EventsView.vue'
import BoardView from '../views/BoardView.vue'
import CallView from '../views/CallView.vue'

import SettingsWeatherView from '../views/SettingsWeatherView.vue'
import AudioSettingsView from '../views/AudioSettingsView.vue'
import AdminLoginView from '../views/AdminLogin.vue'
import LanguageSettingsView from '../views/LanguageSettingsView.vue'
import ButtonColorsSettingsView from '../views/ButtonColorsSettingsView.vue'
import NotificationsSettingsView from '../views/NotificationsSettingsView.vue'

import SettingsView from '../views/SettingsView.vue'



const router = createRouter({
  history: createWebHashHistory(), // Hash history works better with Electron local files
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/admin-login',
      name: 'admin-login',
      component: AdminLoginView
    },
    {
      path: '/settings',

      name: 'settings',
      component: SettingsView
    },
    {
      path: '/settings/weather',
      name: 'settings-weather',
      component: SettingsWeatherView
    },
    {
      path: '/settings/audio',
      name: 'settings-audio',
      component: AudioSettingsView
    },
    {
      path: '/settings/language',
      name: 'settings-language',
      component: LanguageSettingsView
    },
    {
      path: '/settings/colors',
      name: 'settings-colors',
      component: ButtonColorsSettingsView
    },
    {
      path: '/settings/notifications',
      name: 'settings-notifications',
      component: NotificationsSettingsView
    },

    {
      path: '/weather',

      name: 'weather',
      component: WeatherView
    },
    {
      path: '/events',
      name: 'events',
      component: EventsView
    },
    {
      path: '/board',
      name: 'board',
      component: BoardView
    },
    {
      path: '/call',
      name: 'call',
      component: CallView
    }
  ]
})

router.afterEach((to) => {
  if ((window as any).config && (window as any).config.reportRoute) {
    (window as any).config.reportRoute(to.name || to.path)
  }
})

export default router
