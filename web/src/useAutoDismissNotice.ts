import {customRef,onScopeDispose} from 'vue'

export function useAutoDismissNotice(duration=3000){
 let value='',timer:ReturnType<typeof setTimeout>|undefined
 onScopeDispose(()=>clearTimeout(timer))
 return customRef<string>((track,trigger)=>({
  get(){track();return value},
  set(next){
   clearTimeout(timer)
   value=next;trigger()
   if(next)timer=setTimeout(()=>{value='';trigger()},duration)
  },
 }))
}
