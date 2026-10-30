import {fireEvent,render,screen} from '@testing-library/react'
import {beforeEach,describe,expect,it,vi} from 'vitest'

const navigation=vi.hoisted(()=>({push:vi.fn(),search:''}))
vi.mock('next/navigation',()=>({
  useRouter:()=>({push:navigation.push}),
  usePathname:()=>'/thiet-bi-bep',
  useSearchParams:()=>new URLSearchParams(navigation.search),
}))

import {CategoryFilterPanel} from './category-filter-panel'

describe('CategoryFilterPanel snapshot mode',()=>{
  beforeEach(()=>{navigation.push.mockReset();navigation.search='';window.history.replaceState({},'','/thiet-bi-bep?page=2&sort=latest')})

  it('filters multiple real brand slugs and leaves historical price controls unavailable',()=>{
    const {rerender}=render(<CategoryFilterPanel mode="snapshot" brands={[
      {id:'brand-a',slug:'brand-a',name:'Brand A'},
      {id:'brand-b',slug:'brand-b',name:'Brand B'},
    ]} />)

    expect(screen.getByText('Liên hệ để nhận báo giá')).toBeVisible()
    expect(document.querySelectorAll('input[type="range"]')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button',{name:'Brand A'}))
    expect(window.location.search).toBe('?page=2&sort=latest&brands=brand-a')
    expect(navigation.push).not.toHaveBeenCalled()
    navigation.search='brands=brand-a'
    window.history.replaceState({},'','/thiet-bi-bep?page=2&sort=latest&brands=brand-a')
    rerender(<CategoryFilterPanel mode="snapshot" brands={[
      {id:'brand-a',slug:'brand-a',name:'Brand A'},
      {id:'brand-b',slug:'brand-b',name:'Brand B'},
    ]} />)
    expect(screen.getByRole('button',{name:'Brand A'})).toHaveAttribute('aria-pressed','true')
    fireEvent.click(screen.getByRole('button',{name:'Brand B'}))
    expect(window.location.search).toBe('?page=2&sort=latest&brands=brand-a%2Cbrand-b')
  })
})
