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
import WifiSettingsView from '../views/WifiSettingsView.vue'
import RfidSettingsView from '../views/RfidSettingsView.vue'
import LogsSettingsView from '../views/LogsSettingsView.vue'
import GeneralSettingsView from '../views/GeneralSettingsView.vue'

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
      path: '/settings/wifi',
      name: 'settings-wifi',
      component: WifiSettingsView
    },
    {
      path: '/settings/rfid',
      name: 'settings-rfid',
      component: RfidSettingsView
    },
    {
      path: '/settings/logs',
      name: 'settings-logs',
      component: LogsSettingsView
    },
    {
      path: '/settings/general',
      name: 'settings-general',
      component: GeneralSettingsView
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

let lastNavSource = 'touchscreen'

export function setLastNavSource(source: string) {
  lastNavSource = source
}

router.afterEach((to) => {
  if ((window as any).config && (window as any).config.reportRoute) {
    (window as any).config.reportRoute(to.name || to.path, lastNavSource)
  }
  lastNavSource = 'touchscreen'
})

export default router
