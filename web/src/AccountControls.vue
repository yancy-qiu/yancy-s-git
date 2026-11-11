<script setup lang="ts">
import {IconUser,IconSettings,IconExport} from '@arco-design/web-vue/es/icon'
defineProps<{email?:string;demo:boolean}>()
defineEmits<{settings:[];logout:[]}>()
</script>
<template>
 <div class="account-controls" aria-label="个人中心">
  <div class="account-identity"><span class="account-avatar"><IconUser :size="17"/></span><span class="account-name" :title="demo?'演示账号':email">{{ demo?'演示账号':email }}</span></div>
  <div class="account-buttons"><a-tooltip content="设置"><a-button html-type="button" type="text" aria-label="设置" @click="$emit('settings')"><IconSettings :size="17"/></a-button></a-tooltip><a-tooltip :content="demo?'退出演示':'退出登录'"><a-button html-type="button" type="text" :aria-label="demo?'退出演示':'退出登录'" @click="$emit('logout')"><IconExport :size="17"/></a-button></a-tooltip></div>
 </div>
</template>
