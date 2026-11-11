import type {Page} from '@playwright/test'
export async function choose(page:Page,name:string,label:string){await page.getByLabel(name,{exact:true}).click();await page.locator('.arco-select-option').filter({hasText:new RegExp(`^${label}$`)}).click()}
export async function manageTypes(page:Page){await page.getByRole('button',{name:'筛选类型',exact:true}).click();await page.getByRole('button',{name:'管理类型',exact:true}).click()}
