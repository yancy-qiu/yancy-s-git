<script setup lang="ts">
import {Select as ASelect} from '@arco-design/web-vue'
import {IconRight} from '@arco-design/web-vue/es/icon'
defineProps<{theme:string}>()
const emit=defineEmits<{'update:theme':[string];model:[]}>()
</script>
<template>
 <section class="settings-panel">
  <h2>设置</h2>
  <h3 class="settings-group-title">通用设置</h3>
  <div class="settings-group">
   <div class="settings-row">
    <div class="settings-description"><label id="appearance-label">外观</label><p>选择界面显示风格</p></div>
    <div class="settings-appearance"><a-select :model-value="theme" @update:model-value="emit('update:theme',String($event))" aria-label="外观" size="medium" :options="[{value:'system',label:'跟随系统'},{value:'light',label:'浅色'},{value:'dark',label:'深色'}]"/></div>
   </div>
   <div class="settings-row">
    <div class="settings-description"><h4>模型配置</h4><p>管理模型服务与密钥</p></div>
    <a-button html-type="button" type="text" shape="circle" class="settings-model-link" aria-label="模型配置" title="模型配置" @click="emit('model')"><IconRight :size="18"/></a-button>
   </div>
  </div>
 </section>
</template>
<style scoped>
.settings-panel h2{margin:0 0 28px;font-size:20px;font-weight:600}
.settings-panel .settings-group-title{margin:0 0 12px;font-size:13px;font-weight:600}
.settings-group{border:1px solid var(--border);border-radius:8px;overflow:hidden}
.settings-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px;min-height:76px}
.settings-row+.settings-row{border-top:1px solid var(--border)}
.settings-description{min-width:0}
.settings-panel .settings-description label,.settings-description h4{display:block;margin:0;font-size:13px;line-height:22px;font-weight:500;color:var(--text)}
.settings-description p{margin:3px 0 0;font-size:11px;line-height:18px;color:var(--muted)}
.settings-appearance{width:128px;max-width:128px;flex:0 0 128px}
.settings-appearance :deep(input){border:0;padding:0;margin:0;background:transparent;box-shadow:none}
.settings-model-link.arco-btn{width:32px;height:32px;min-height:32px;flex-shrink:0;padding:0;display:inline-flex;align-items:center;justify-content:center;color:var(--muted)}
@media(max-width:420px){.settings-row{gap:10px;padding:14px 12px}.settings-appearance{width:116px;max-width:116px;flex-basis:116px}}
</style>
