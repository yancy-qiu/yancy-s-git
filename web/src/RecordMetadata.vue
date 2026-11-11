<script setup lang="ts">
import {Select as ASelect,DatePicker as ADatePicker} from '@arco-design/web-vue'
import {IconApps,IconSort,IconCalendar} from '@arco-design/web-vue/es/icon'
defineProps<{category:string;priority:string;date:string;categories:Record<string,string>;disabled?:boolean;prefix:string}>()
const emit=defineEmits<{'update:category':[string];'update:priority':[string];'update:date':[string]}>()
</script>
<template>
 <div class="record-metadata" @keydown.enter.prevent>
  <a-tooltip content="任务类型"><a-select :model-value="category" @update:model-value="emit('update:category',String($event))" :disabled="disabled" :aria-label="prefix+'类型'" size="small" :options="Object.entries(categories).map(([value,label])=>({value,label}))"><template #prefix><IconApps/></template></a-select></a-tooltip>
  <a-tooltip content="优先级"><a-select :model-value="priority" @update:model-value="emit('update:priority',String($event))" :disabled="disabled" :aria-label="prefix+'优先级'" size="small" :options="[{value:'normal',label:'普通'},{value:'high',label:'重要'},{value:'low',label:'较低'}]"><template #prefix><IconSort/></template></a-select></a-tooltip>
  <a-date-picker :model-value="date" @update:model-value="emit('update:date',$event?String($event):'')" :disabled="disabled" :aria-label="prefix+'日期'" size="small" format="YYYY-MM-DD" value-format="YYYY-MM-DD" placeholder="安排日期" allow-clear><template #prefix><IconCalendar/></template></a-date-picker>
 </div>
</template>
