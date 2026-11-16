<script setup lang="ts">
import {Select as ASelect} from '@arco-design/web-vue'
import {IconRight} from '@arco-design/web-vue/es/icon'
defineProps<{theme:string}>()
const emit=defineEmits<{'update:theme':[string];model:[];save:[]}>()
</script>
<template>
 <form @submit.prevent="emit('save')">
  <p class="eyebrow">MAKE IT YOURS</p><h2>你的轻记，你来定义</h2>
  <div class="settings-appearance" @keydown.enter.prevent>
   <label id="appearance-label">外观</label>
   <a-select :model-value="theme" @update:model-value="emit('update:theme',String($event))" aria-label="外观" size="medium" :options="[{value:'system',label:'跟随系统'},{value:'light',label:'浅色'},{value:'dark',label:'深色'}]"/>
  </div>
  <hr>
  <div class="settings-model-row"><div><h3>模型配置</h3><p class="muted">管理模型服务与密钥。</p></div><a-button html-type="button" type="text" shape="circle" class="settings-model-link" aria-label="模型配置" title="模型配置" @click="emit('model')"><IconRight :size="18"/></a-button></div>
  <a-button html-type="submit" type="primary" class="primary full">保存设置</a-button>
 </form>
</template>
<style scoped>
.settings-appearance label{margin-bottom:8px}
.settings-appearance :deep(.arco-select-view){width:100%}
.settings-appearance :deep(input){border:0;padding:0;margin:0;background:transparent;box-shadow:none}
.settings-model-row{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px}
.settings-model-row h3{margin:0 0 8px}
.settings-model-row p{margin:0}
.settings-model-link.arco-btn{width:32px;height:32px;min-height:32px;flex-shrink:0;padding:0;display:inline-flex;align-items:center;justify-content:center;color:var(--muted)}
</style>
