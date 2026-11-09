import { defineConfig } from '@playwright/test'
export default defineConfig({
 testDir:'./e2e',fullyParallel:false,workers:1,timeout:30000,
 use:{baseURL:'http://127.0.0.1:5174',headless:true,launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'},screenshot:'only-on-failure'},
 outputDir:'/tmp/qingji-playwright-results',
 webServer:{command:'npm run dev -- --port 5174 --strictPort',url:'http://127.0.0.1:5174',reuseExistingServer:false,env:{VITE_SUPABASE_URL:'https://qingji-test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_placeholder'}},
})
