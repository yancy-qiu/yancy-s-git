import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { Button, Input, Popover, Tooltip, Tag, ConfigProvider } from '@arco-design/web-vue'
import '@arco-design/web-vue/dist/arco.css'
import './style.css'
createApp(App).use(createPinia()).use(Button).use(Input).use(Popover).use(Tooltip).use(Tag).use(ConfigProvider).mount('#app')
